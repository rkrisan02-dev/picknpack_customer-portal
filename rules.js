/* ==========================================================================
   Pick n Pack — Brand Portal · BUSINESS RULES ENGINE
   --------------------------------------------------------------------------
   THIS IS THE MOST IMPORTANT FILE FOR THE DEV TEAM.

   Every rule below must ALSO be enforced server-side. The client copy exists
   only to give the brand instant feedback; it is not a security boundary.
   A brand user can trivially bypass anything enforced only here.

   Port order for the backend:
     1. TENANT SCOPING      (security — do this first)
     2. STATUS MACHINE      (data integrity)
     3. STOCK ALLOCATION    (prevents overselling — the core value prop)
     4. SKU RESOLUTION      (makes imports work)
     5. RECEIVING VARIANCE  (inbound trust)
     6. BILLING ACCRUAL     (revenue)
   ========================================================================== */

const Rules = (() => {

  /* ======================================================================
     1. TENANT SCOPING
     ----------------------------------------------------------------------
     Every single query must be filtered by brandId. A brand must never be
     able to read or write another brand's data, including by guessing IDs.

     SERVER: derive brandId from the session/JWT — NEVER from a request
     parameter. If brandId arrives in the body or query string, ignore it.
     ====================================================================== */
  function scope(rows, brandId) {
    if (!brandId) throw new Error('SECURITY: brandId missing from scope()');
    return rows.filter(r => r.brandId === brandId);
  }

  function assertOwned(entity, brandId) {
    if (!entity) return { ok: false, code: 404, msg: 'Not found' };
    if (entity.brandId !== brandId) {
      // Return 404 not 403 — do not confirm the record exists to a stranger.
      return { ok: false, code: 404, msg: 'Not found' };
    }
    return { ok: true };
  }

  /* ======================================================================
     2. ORDER STATUS MACHINE
     ----------------------------------------------------------------------
     Statuses fall into two groups:
       BRAND-CONTROLLED : draft, needs_label, held, ready, cancelled
       WAREHOUSE-CONTROLLED : picking, packing, shipped, delivered

     The brand can NEVER set picking/packing/shipped/delivered. Those come
     from the warehouse system only. Conversely the warehouse never sets
     needs_label/held — those are portal-side validation states.
     ====================================================================== */
  const STATUS = {
    draft:       { label:'Draft',        who:'brand',     terminal:false },
    needs_label: { label:'Needs label',  who:'system',    terminal:false },
    held:        { label:'Held',         who:'system',    terminal:false },
    ready:       { label:'Ready',        who:'system',    terminal:false },
    picking:     { label:'Picking',      who:'warehouse', terminal:false },
    packing:     { label:'Packing',      who:'warehouse', terminal:false },
    shipped:     { label:'Shipped',      who:'warehouse', terminal:false },
    delivered:   { label:'Delivered',    who:'warehouse', terminal:true  },
    cancelled:   { label:'Cancelled',    who:'brand',     terminal:true  }
  };

  // Allowed transitions. Anything not listed is rejected.
  const TRANSITIONS = {
    draft:       ['needs_label','held','ready','cancelled'],
    needs_label: ['ready','held','cancelled','draft'],
    held:        ['ready','needs_label','cancelled','draft'],
    ready:       ['picking','held','cancelled'],
    picking:     ['packing','held'],          // held = warehouse found a problem
    packing:     ['shipped','held'],
    shipped:     ['delivered'],
    delivered:   [],
    cancelled:   []
  };

  // Statuses at which stock is committed to this order.
  const ALLOCATING = ['ready','picking','packing'];
  // Statuses at which stock has permanently left.
  const CONSUMED   = ['shipped','delivered'];

  function canTransition(from, to) {
    const allowed = TRANSITIONS[from] || [];
    if (!allowed.includes(to)) {
      return { ok:false, msg:`Cannot move an order from ${STATUS[from]?.label||from} to ${STATUS[to]?.label||to}.` };
    }
    return { ok:true };
  }

  function canBrandSet(to) {
    return ['draft','ready','cancelled'].includes(to);
  }

  /* ======================================================================
     3. ORDER VALIDATION → derives the correct status
     ----------------------------------------------------------------------
     An order is only 'ready' (visible to the warehouse floor) when ALL of:
       a) at least one line item
       b) every line resolves to a real SKU in this brand's catalog
       c) a shipping label is attached
       d) sufficient AVAILABLE stock exists for every line

     Precedence when several fail: held (data problem) beats needs_label
     (missing asset), because a held order can't be fixed by uploading a PDF.
     ====================================================================== */
  function validateOrder(order, inventoryBySku, ignoreOrderId) {
    const problems = [];

    if (!order.lines || order.lines.length === 0) {
      problems.push({ code:'NO_LINES', field:'lines', msg:'Add at least one item.' });
    }
    if (!order.orderRef) {
      problems.push({ code:'NO_REF', field:'orderRef', msg:'Order number is required.' });
    }
    if (!order.buyerName) {
      problems.push({ code:'NO_BUYER', field:'buyerName', msg:'Buyer / ship-to name is required.' });
    }

    // (b) SKU resolution
    (order.lines || []).forEach((ln, i) => {
      if (!ln.sku) {
        problems.push({ code:'SKU_UNRESOLVED', field:`lines[${i}]`,
          msg:`"${ln.rawName || 'item'}" doesn't match any product in your catalog.` });
      } else if (!inventoryBySku[ln.sku]) {
        problems.push({ code:'SKU_UNKNOWN', field:`lines[${i}]`,
          msg:`SKU ${ln.sku} is not in your catalog.` });
      }
      if (!ln.qty || ln.qty < 1) {
        problems.push({ code:'BAD_QTY', field:`lines[${i}]`, msg:'Quantity must be at least 1.' });
      }
    });

    // (d) stock availability — checked against AVAILABLE, not on-hand
    (order.lines || []).forEach((ln, i) => {
      const inv = inventoryBySku[ln.sku];
      if (!inv) return;
      const avail = availableFor(inv, ignoreOrderId);
      if (ln.qty > avail) {
        problems.push({ code:'INSUFFICIENT_STOCK', field:`lines[${i}]`, soft:true,
          msg:`Only ${avail} available of ${inv.name} — you asked for ${ln.qty}.` });
      }
    });

    // (c) label
    const hasLabel = !!(order.label && order.label.filename);

    const hard = problems.filter(p => !p.soft);
    const stockShort = problems.some(p => p.code === 'INSUFFICIENT_STOCK');

    let status;
    if (hard.length > 0 || stockShort) status = 'held';
    else if (!hasLabel)                status = 'needs_label';
    else                               status = 'ready';

    return { status, problems, hasLabel, canSubmit: status === 'ready' };
  }

  /* ======================================================================
     4. STOCK ALLOCATION
     ----------------------------------------------------------------------
     available = onHand - allocated
     'allocated' is the sum of qty across all orders sitting in an
     ALLOCATING status. Shipping DECREMENTS onHand and releases allocation.

     THE RULE THAT MATTERS: never allocate against onHand. Brands oversell
     because their spreadsheet's "Remaining" column counts stock that is
     already promised to unshipped orders.

     CONCURRENCY (server): allocation must happen inside a transaction with
     a row lock on the inventory record, or two simultaneous orders will
     both pass the check and oversell the last unit.
        SELECT ... FOR UPDATE  →  re-check  →  write  →  COMMIT
     ====================================================================== */
  function availableFor(inv, ignoreOrderId) {
    // ignoreOrderId lets an order being edited not block itself.
    let allocated = inv.allocated || 0;
    if (ignoreOrderId && inv.allocations) {
      allocated -= (inv.allocations[ignoreOrderId] || 0);
    }
    return Math.max(0, (inv.onHand || 0) - allocated);
  }

  function applyAllocation(inv, orderId, qty) {
    inv.allocations = inv.allocations || {};
    const prev = inv.allocations[orderId] || 0;
    inv.allocations[orderId] = qty;
    inv.allocated = (inv.allocated || 0) - prev + qty;
    return inv;
  }

  function releaseAllocation(inv, orderId) {
    inv.allocations = inv.allocations || {};
    const prev = inv.allocations[orderId] || 0;
    delete inv.allocations[orderId];
    inv.allocated = Math.max(0, (inv.allocated || 0) - prev);
    return inv;
  }

  function consumeStock(inv, orderId, qty) {
    // called on SHIP: stock physically leaves
    releaseAllocation(inv, orderId);
    inv.onHand = Math.max(0, (inv.onHand || 0) - qty);
    return inv;
  }

  /* ======================================================================
     5. SKU RESOLUTION (alias matching)
     ----------------------------------------------------------------------
     Orders arrive with free-text product names that drift between uploads:
       "La Mer The Lip Balm 0.32oz" / "La Mer Lip Balm" / "LaMer lipbalm .32"

     Strategy, in order:
       1. exact SKU match
       2. exact name match (normalised)
       3. known alias match (normalised)
       4. fuzzy score >= threshold → suggest, do NOT auto-accept
       5. no match → order goes to 'held', brand maps it once, alias is
          saved so it never fails again.
     ====================================================================== */
  function normalise(s) {
    return String(s || '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .replace(/\b(the|a|an|of|for)\b/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function similarity(a, b) {
    a = normalise(a); b = normalise(b);
    if (!a || !b) return 0;
    if (a === b) return 1;
    const at = new Set(a.split(' ')), bt = new Set(b.split(' '));
    let inter = 0;
    at.forEach(t => { if (bt.has(t)) inter++; });
    return (2 * inter) / (at.size + bt.size);   // Dice coefficient
  }

  const FUZZY_ACCEPT  = 0.92;  // auto-accept at or above
  const FUZZY_SUGGEST = 0.55;  // offer as a suggestion at or above

  function resolveSku(rawName, products) {
    const raw = String(rawName || '').trim();
    if (!raw) return { sku:null, confidence:0, method:'empty', suggestions:[] };

    // 1. exact SKU
    const bySku = products.find(p => p.sku.toLowerCase() === raw.toLowerCase());
    if (bySku) return { sku:bySku.sku, confidence:1, method:'sku', suggestions:[] };

    const n = normalise(raw);

    // 2. exact name
    const byName = products.find(p => normalise(p.name) === n);
    if (byName) return { sku:byName.sku, confidence:1, method:'name', suggestions:[] };

    // 3. alias
    const byAlias = products.find(p => (p.aliases||[]).some(a => normalise(a) === n));
    if (byAlias) return { sku:byAlias.sku, confidence:1, method:'alias', suggestions:[] };

    // 4. fuzzy
    const scored = products.map(p => {
      const best = Math.max(
        similarity(raw, p.name),
        ...(p.aliases||[]).map(a => similarity(raw, a))
      );
      return { sku:p.sku, name:p.name, score:best };
    }).sort((x,y) => y.score - x.score);

    const top = scored[0];
    if (top && top.score >= FUZZY_ACCEPT) {
      return { sku:top.sku, confidence:top.score, method:'fuzzy-auto', suggestions:scored.slice(0,3) };
    }
    if (top && top.score >= FUZZY_SUGGEST) {
      return { sku:null, confidence:top.score, method:'fuzzy-suggest', suggestions:scored.slice(0,3) };
    }
    return { sku:null, confidence:0, method:'none', suggestions:scored.slice(0,3) };
  }

  /* ======================================================================
     6. COLUMN MAPPING for CSV / XLSX import
     ----------------------------------------------------------------------
     Real headers observed across the 35 brand tabs — note the misspellings.
     Mapping is SAVED PER BRAND after first confirmation so later uploads
     from the same brand map silently.
     ====================================================================== */
  const CANONICAL_FIELDS = [
    { key:'orderDate',  label:'Order date',       required:true  },
    { key:'orderRef',   label:'Order number',     required:true  },
    { key:'qty',        label:'Quantity',         required:true  },
    { key:'productName',label:'Product / SKU',    required:true  },
    { key:'buyerName',  label:'Buyer name',       required:true  },
    { key:'listingUrl', label:'Listing URL',      required:false },
    { key:'labelUrl',   label:'Label file / link',required:false },
    { key:'status',     label:'Status',           required:false },
    { key:'shipDate',   label:'Shipping date',    required:false },
    { key:'tracking',   label:'Tracking number',  required:false },
    { key:'notes',      label:'Notes',            required:false },
    { key:'__ignore',   label:'— ignore —',       required:false }
  ];

  // Header synonyms taken verbatim from the real workbook, misspellings included.
  const HEADER_SYNONYMS = {
    orderDate:   ['order date','orderdate','date','order_date'],
    orderRef:    ['order number','order no','order #','ordernumber','order id','order_ref','sales record'],
    qty:         ['quantity','qty','units','quantity sold','no of units'],
    productName: ['product name','prduct name','product','products','item','item name','product sku','sku','product title'],
    buyerName:   ['customer name','buyer name','customer','buyer','ship to','shipto','recipient'],
    listingUrl:  ['product link','products link','item link','listing','listing url','link'],
    labelUrl:    ['label','lable','labels','shipping label','label link'],
    status:      ['status','order status','shipment status'],
    shipDate:    ['shipping date','ship date','shipped date','date shipped','shipping'],
    tracking:    ['tracking','trackings','tracking number','tracking no','tracking #','usps web link'],
    notes:       ['notes','note','comment','comments','remarks']
  };

  function autoMapColumns(headers) {
    const used = new Set();
    return headers.map(h => {
      const n = normalise(h);
      let best = { key:'__ignore', score:0 };
      for (const [key, syns] of Object.entries(HEADER_SYNONYMS)) {
        if (used.has(key)) continue;
        for (const s of syns) {
          const score = normalise(s) === n ? 1 : similarity(h, s);
          if (score > best.score) best = { key, score };
        }
      }
      const confident = best.score >= 0.85;
      if (confident) used.add(best.key);
      return {
        source: h,
        target: confident ? best.key : '__ignore',
        score: best.score,
        state: confident ? 'matched' : (best.score >= 0.5 ? 'confirm' : 'unmapped')
      };
    });
  }

  /* ======================================================================
     7. IMPORT ROW VALIDATION
     ----------------------------------------------------------------------
     Rows are bucketed, never silently dropped:
       ready   → imports as a normal order
       warning → imports but lands in needs_label / flagged
       error   → held back, listed for the brand to fix
     ====================================================================== */
  function validateImportRow(row, products, inventoryBySku) {
    const issues = [];
    if (!row.orderRef)   issues.push({ level:'error', msg:'Missing order number' });
    if (!row.buyerName)  issues.push({ level:'error', msg:'Missing buyer name' });
    const qty = parseInt(row.qty, 10);
    if (!qty || qty < 1) issues.push({ level:'error', msg:'Invalid quantity' });

    const res = resolveSku(row.productName, products);
    if (!res.sku) {
      issues.push({ level:'error', msg:`Unrecognised product "${row.productName || ''}"`, resolution:res });
    } else {
      const inv = inventoryBySku[res.sku];
      if (inv && qty > availableFor(inv)) {
        issues.push({ level:'warning', msg:`Only ${availableFor(inv)} available` });
      }
    }
    if (!row.labelUrl) issues.push({ level:'warning', msg:'No label attached' });

    const level = issues.some(i => i.level === 'error') ? 'error'
                : issues.some(i => i.level === 'warning') ? 'warning' : 'ready';
    return { level, issues, resolvedSku: res.sku, resolution: res };
  }

  /* ======================================================================
     8. RECEIVING (ASN) VARIANCE
     ----------------------------------------------------------------------
     Brand declares expected qty. Warehouse counts actual. Any difference is
     surfaced to BOTH sides immediately, with the warehouse's note attached.
     Only good units post to inventory; damaged go to QC hold.
     ====================================================================== */
  function asnVariance(line) {
    const expected = line.qtyExpected || 0;
    const received = line.qtyReceived || 0;
    const damaged  = line.qtyDamaged  || 0;
    const good     = Math.max(0, received - damaged);
    return {
      expected, received, damaged, good,
      variance: received - expected,
      hasVariance: received !== expected || damaged > 0,
      postsToInventory: good
    };
  }

  function asnStatus(asn) {
    if (asn.status === 'cancelled') return 'cancelled';
    const lines = asn.lines || [];
    const anyReceived = lines.some(l => (l.qtyReceived || 0) > 0);
    const allReceived = lines.length > 0 && lines.every(l => (l.qtyReceived || 0) >= (l.qtyExpected || 0));
    const anyVariance = lines.some(l => asnVariance(l).hasVariance);
    if (!anyReceived) {
      const eta = asn.eta ? new Date(asn.eta) : null;
      const soon = eta && (eta - new Date()) / 86400000 <= 2;
      return soon ? 'arriving' : 'in_transit';
    }
    if (anyVariance) return 'variance';
    return allReceived ? 'received' : 'in_transit';
  }

  /* ======================================================================
     9. BILLING ACCRUAL
     ----------------------------------------------------------------------
     Charges accrue per event as work happens, not reconstructed monthly.
     Rate card is per-brand (contract terms differ per client).
     ====================================================================== */
  const DEFAULT_RATES = {
    storagePerPalletMonth: 18.00,
    receivingPerUnit:       0.35,
    pickPackPerOrder:       1.25,
    pickPackPerLine:        0.30,
    labelPrint:             0.10,
    freightMarkupPct:      10
  };

  function accrueForOrder(order, rates = DEFAULT_RATES) {
    const lines = (order.lines || []).length;
    const items = [
      { code:'PICKPACK', label:'Pick & pack',  amount: rates.pickPackPerOrder },
      { code:'LINES',    label:`${lines} line${lines===1?'':'s'}`, amount: lines * rates.pickPackPerLine },
      { code:'LABEL',    label:'Label print',  amount: rates.labelPrint }
    ];
    const total = items.reduce((s,i) => s + i.amount, 0);
    return { items, total: round2(total) };
  }

  function accrueForReceipt(totalUnits, rates = DEFAULT_RATES) {
    return { code:'RECEIVING', label:`Receiving ${totalUnits} units`,
             amount: round2(totalUnits * rates.receivingPerUnit) };
  }

  function round2(n){ return Math.round(n * 100) / 100; }

  /* ======================================================================
     10. LABEL PARSING
     ----------------------------------------------------------------------
     The workbook has NO shipping-address column — the address only exists
     inside the label PDF, and some buyers are "eIS C/O ..." (eBay
     International Shipping), so the parcel goes to eBay's hub, not the buyer.

     THEREFORE: the label is the source of truth for destination. The typed
     address field is optional metadata for the brand's own reference.

     SERVER: use a PDF text-extraction lib; fall back to OCR for image
     labels; if BOTH fail, accept the file anyway and leave fields blank —
     never block a shipment because parsing failed.
     ====================================================================== */
  function parseLabelStub(filename) {
    // Placeholder. Replace with real extraction server-side.
    return {
      parsed: true,
      carrier: 'USPS Ground Advantage',
      tracking: '9400 1081 0624 5921 6244 60',
      shipTo: 'KATRINA ALVAREZ · 1420 Bergen St, Brooklyn NY 11213',
      confidence: 0.94,
      filename
    };
  }

  return {
    scope, assertOwned,
    STATUS, TRANSITIONS, ALLOCATING, CONSUMED, canTransition, canBrandSet,
    validateOrder,
    availableFor, applyAllocation, releaseAllocation, consumeStock,
    normalise, similarity, resolveSku, FUZZY_ACCEPT, FUZZY_SUGGEST,
    CANONICAL_FIELDS, HEADER_SYNONYMS, autoMapColumns,
    validateImportRow,
    asnVariance, asnStatus,
    DEFAULT_RATES, accrueForOrder, accrueForReceipt, round2,
    parseLabelStub
  };
})();

if (typeof module !== 'undefined') module.exports = Rules;
