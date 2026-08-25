/* ==========================================================================
   Pick n Pack — Brand Portal · DATA LAYER
   --------------------------------------------------------------------------
   Every function here mirrors a real REST endpoint (see docs/API-CONTRACT.md).
   Swap the bodies for fetch() calls and the UI keeps working unchanged.

   Seed data is modelled on the real customer workbook: brand names, product
   names, eBay-style order refs (e.g. 24-14818-97616) and buyer names
   including "eIS C/O ..." (eBay International Shipping).
   ========================================================================== */

const DB = (() => {

  const SESSION = { brandId:'br_madiha', userId:'u_1', role:'owner',
                    warehouseName:'Saqib Sohail Warehousing' };

  const brands = [
    { id:'br_madiha',   name:'Madiha Ecomm',   warehouseId:'wh_1' },
    { id:'br_zyad',     name:'Zyad Trading',   warehouseId:'wh_1' },
    { id:'br_bastidas', name:'BASTIDAS LLC',   warehouseId:'wh_1' }
  ];

  const products = [
    { id:'p1', brandId:'br_madiha', sku:'LMR-LB-032', name:'La Mer The Lip Balm 0.32oz',
      aliases:['La Mer Lip Balm','LaMer lipbalm .32','lip balm la mer'], weightLb:0.2, image:null },
    { id:'p2', brandId:'br_madiha', sku:'LMR-MC-1', name:'La Mer The Moisturizing Cream 1oz',
      aliases:['La Mer Moisturizing','LM Cream 1oz'], weightLb:0.6, image:null },
    { id:'p3', brandId:'br_madiha', sku:'SIS-BRM-1', name:'Sisley Black Rose Cream Mask',
      aliases:['Sisley Black Rose'], weightLb:0.5, image:null },
    { id:'p4', brandId:'br_madiha', sku:'EA-CER-60', name:'Elizabeth Arden Ceramide Capsules',
      aliases:['Elizabeth Arden Ceramide','EA Ceramide'], weightLb:0.3, image:null },
    { id:'p5', brandId:'br_madiha', sku:'SHI-VP-30', name:'Shiseido Vital Perfection Serum',
      aliases:['Shiseido Vital Perfect','Shiseido VP'], weightLb:0.4, image:null },
    { id:'p6', brandId:'br_madiha', sku:'SKC-PTX-15', name:'Skinceuticals P-TIOX',
      aliases:['Skinceuticals PTIOX'], weightLb:0.25, image:null }
  ];

  const inventory = [
    { brandId:'br_madiha', sku:'LMR-LB-032',  name:'La Mer The Lip Balm 0.32oz',      onHand:15, allocated:11, inbound:200, bin:'TPL-C1', allocations:{} },
    { brandId:'br_madiha', sku:'LMR-MC-1',    name:'La Mer The Moisturizing Cream 1oz',onHand:86, allocated:12, inbound:0,   bin:'TPL-C1', allocations:{} },
    { brandId:'br_madiha', sku:'SIS-BRM-1',   name:'Sisley Black Rose Cream Mask',    onHand:42, allocated:3,  inbound:0,   bin:'TPL-C1', allocations:{} },
    { brandId:'br_madiha', sku:'EA-CER-60',   name:'Elizabeth Arden Ceramide Capsules',onHand:0, allocated:0,  inbound:120, bin:'TPL-C2', allocations:{} },
    { brandId:'br_madiha', sku:'SHI-VP-30',   name:'Shiseido Vital Perfection Serum', onHand:28, allocated:6,  inbound:140, bin:'TPL-C2', allocations:{} },
    { brandId:'br_madiha', sku:'SKC-PTX-15',  name:'Skinceuticals P-TIOX',            onHand:7,  allocated:5,  inbound:0,   bin:'TPL-C2', allocations:{} }
  ];

  const asns = [
    { id:'ASN-1046', brandId:'br_madiha', supplier:'Guangzhou Trading Co.', carrier:'YunExpress',
      tracking:'YT2038471109912', eta:'2026-08-24', createdAt:'2026-08-10', status:'in_transit',
      lines:[{ sku:'LMR-LB-032', qtyExpected:200, qtyReceived:0, qtyDamaged:0 }],
      docs:[{ filename:'invoice-8842.pdf' },{ filename:'packing-list.pdf' }], notes:[] },
    { id:'ASN-1045', brandId:'br_madiha', supplier:'Shenzhen Beauty', carrier:'YunExpress',
      tracking:'YT2038471107741', eta:'2026-08-22', createdAt:'2026-08-09', status:'arriving',
      lines:[{ sku:'EA-CER-60', qtyExpected:120, qtyReceived:0, qtyDamaged:0 }],
      docs:[], notes:[] },
    { id:'ASN-1044', brandId:'br_madiha', supplier:'Guangzhou Trading Co.', carrier:'YunExpress',
      tracking:'YT2038471105510', eta:'2026-08-27', createdAt:'2026-08-12', status:'in_transit',
      lines:[{ sku:'SHI-VP-30', qtyExpected:140, qtyReceived:0, qtyDamaged:0 }],
      docs:[], notes:[] },
    { id:'ASN-1043', brandId:'br_madiha', supplier:'Shenzhen Beauty', carrier:'YunExpress',
      tracking:'YT2038471103320', eta:'2026-08-18', createdAt:'2026-08-02', status:'variance',
      lines:[{ sku:'LMR-MC-1', qtyExpected:200, qtyReceived:194, qtyDamaged:2 }],
      docs:[{ filename:'invoice-8801.pdf' }],
      notes:[{ by:'Dan Rivera', at:'2026-08-18 11:04',
               text:'Carton 3 of 5 arrived opened, 6 units missing. 2 more with crushed boxes moved to QC hold. Photos attached.',
               photos:['carton3-a.jpg','carton3-b.jpg'] }] }
  ];

  let orderSeq = 44122;
  const orders = [
    mkOrder('31-15002-44120','2026-08-19','Katrina Alvarez','eBay',[{sku:'LMR-LB-032',qty:1}],null,'needs_label'),
    mkOrder('31-15002-44119','2026-08-19','T. Nguyen','eBay',[{sku:null,rawName:'Shiseido Vital Perfect',qty:2}],lbl(),'held'),
    mkOrder('31-15001-98833','2026-08-19','Dina Benedetto','eBay',[{sku:'SIS-BRM-1',qty:1}],lbl(),'ready'),
    mkOrder('30-14990-21004','2026-08-18','eIS C/O antonina koleva','eBay',[{sku:'LMR-MC-1',qty:1}],lbl(),'picking'),
    mkOrder('30-14989-77412','2026-08-18','M. Costa','eBay',[{sku:'SHI-VP-30',qty:3}],lbl(),'packing'),
    mkOrder('30-14988-10265','2026-08-18','Sandra Canzone','eBay',[{sku:'EA-CER-60',qty:1}],lbl(),'shipped','9400108106245726360'),
    mkOrder('29-14971-55190','2026-08-17','Jacob Brummett','eBay',[{sku:'LMR-LB-032',qty:2}],lbl(),'delivered','9434608106244612'),
    mkOrder('29-14970-33108','2026-08-17','Maria Reyes','eBay',[{sku:'LMR-MC-1',qty:1}],lbl(),'delivered','9400108106244902425'),
    mkOrder('28-14955-77201','2026-08-16','Pallas Huang','eBay',[{sku:'SIS-BRM-1',qty:2}],lbl(),'shipped','9400108106245921624')
  ];

  function lbl(){ return { filename:'shipping-label.pdf', uploadedAt:'2026-08-18',
      carrier:'USPS Ground Advantage', tracking:'9400 1081 0624 5921 6244 60',
      shipTo:'1420 Bergen St, Brooklyn NY 11213' }; }

  function mkOrder(ref, date, buyer, channel, lines, label, status, tracking){
    return { id:'o_'+ref, brandId:'br_madiha', orderRef:ref, orderDate:date,
      buyerName:buyer, channel, listingUrl:'https://www.ebay.com/itm/…',
      shipToAddress:null, lines, label:label||null, docs:[], status,
      tracking:tracking||null, shipDate: status==='shipped'||status==='delivered' ? date : null,
      holdReason: status==='held' ? 'Unrecognised product name' : null,
      timeline: buildTimeline(status, date), createdAt:date };
  }

  function buildTimeline(status, date){
    const seq = ['ready','picking','packing','shipped','delivered'];
    const at = ['09:12','14:02','15:40','17:20','next day'];
    const tl = [{ status:'created', at:`${date} 09:00`, note:'Created' }];
    const idx = seq.indexOf(status);
    if (idx >= 0) seq.slice(0, idx+1).forEach((s,i) => tl.push({ status:s, at:`${date} ${at[i]}`, note:'' }));
    return tl;
  }

  const billing = {
    brandId:'br_madiha', period:'2026-08',
    lines:[
      { code:'STORAGE',   label:'Storage · 6 pallets × $18',      amount:108.00 },
      { code:'RECEIVING', label:'Receiving · 386 units × $0.35',  amount:135.10 },
      { code:'PICKPACK',  label:'Pick & pack · 214 orders',       amount:331.70 },
      { code:'LABEL',     label:'Label printing · 214',           amount:21.40  },
      { code:'FREIGHT',   label:'Freight (at cost + 10%)',        amount:1204.60 }
    ],
    invoices:[
      { id:'INV-2207', period:'Jul 2026', amount:1642.30, status:'paid' },
      { id:'INV-2154', period:'Jun 2026', amount:1489.75, status:'paid' },
      { id:'INV-2098', period:'May 2026', amount:1655.20, status:'paid' }
    ]
  };

  const users = [
    { id:'u_1', brandId:'br_madiha', name:'Madiha K.',      email:'madiha@brand.test', role:'owner'  },
    { id:'u_2', brandId:'br_madiha', name:'Ops assistant',  email:'ops@brand.test',    role:'orders' },
    { id:'u_3', brandId:'br_madiha', name:'Accountant',     email:'acct@brand.test',   role:'billing'}
  ];

  const channels = [
    { key:'ebay',    name:'eBay',                  status:'connected', note:'Auto-import orders + push tracking back' },
    { key:'amazon',  name:'Amazon Seller Central', status:'available', note:'FBM orders, auto-confirm shipment' },
    { key:'walmart', name:'Walmart Marketplace',   status:'available', note:'Order import + tracking sync' },
    { key:'tiktok',  name:'TikTok Shop',           status:'soon',      note:'Order import' },
    { key:'shopify', name:'Shopify',               status:'available', note:'Own storefront orders' }
  ];

  let savedMapping = null;   // per-brand saved column mapping
  const notifications = { dailySummary:true, variance:true, held:true, lowStock:false };

  /* ---------- recompute allocations from current orders ---------- */
  function recomputeAllocations(){
    inventory.forEach(i => { i.allocations = {}; i.allocated = 0; });
    orders.forEach(o => {
      if (!Rules.ALLOCATING.includes(o.status)) return;
      o.lines.forEach(ln => {
        if (!ln.sku) return;
        const inv = inventory.find(i => i.sku === ln.sku && i.brandId === o.brandId);
        if (inv) Rules.applyAllocation(inv, o.id, (inv.allocations[o.id]||0) + ln.qty);
      });
    });
  }
  recomputeAllocations();

  /* =====================================================================
     API SURFACE — each maps 1:1 to a REST endpoint
     ===================================================================== */
  const api = {
    session: () => ({ ...SESSION, brandName: brands.find(b=>b.id===SESSION.brandId).name }),

    // GET /products
    listProducts: () => Rules.scope(products, SESSION.brandId),
    // POST /products
    createProduct: (p) => { const np = { id:'p'+Date.now(), brandId:SESSION.brandId, aliases:[], ...p };
                            products.push(np); return np; },
    // PATCH /products/:id  (add alias)
    addAlias: (sku, alias) => { const p = products.find(x=>x.sku===sku && x.brandId===SESSION.brandId);
                                if(p && alias && !p.aliases.includes(alias)) p.aliases.push(alias); return p; },

    // GET /inventory
    listInventory: () => Rules.scope(inventory, SESSION.brandId).map(i => ({
      ...i, available: Rules.availableFor(i)
    })),
    inventoryBySku: () => {
      const m = {}; Rules.scope(inventory, SESSION.brandId).forEach(i => m[i.sku] = i); return m;
    },

    // GET /asns
    listAsns: () => Rules.scope(asns, SESSION.brandId).map(a => ({ ...a, status: Rules.asnStatus(a) })),
    getAsn: (id) => { const a = asns.find(x=>x.id===id); const c = Rules.assertOwned(a, SESSION.brandId);
                      return c.ok ? { ...a, status: Rules.asnStatus(a) } : null; },
    // POST /asns
    createAsn: (data) => {
      const id = 'ASN-' + (1047 + asns.filter(a=>a.brandId===SESSION.brandId).length);
      const a = { id, brandId:SESSION.brandId, createdAt:today(), status:'in_transit',
                  notes:[], docs:data.docs||[], ...data };
      asns.unshift(a);
      const inv = inventory.find(i=>i.sku===a.lines[0].sku && i.brandId===SESSION.brandId);
      if (inv) inv.inbound = (inv.inbound||0) + (a.lines[0].qtyExpected||0);
      return a;
    },

    // GET /orders
    listOrders: () => Rules.scope(orders, SESSION.brandId),
    getOrder: (id) => { const o = orders.find(x=>x.id===id);
                        return Rules.assertOwned(o, SESSION.brandId).ok ? o : null; },

    // POST /orders
    createOrder: (data) => {
      const invMap = api.inventoryBySku();
      const draft = { id:'o_'+(++orderSeq), brandId:SESSION.brandId, createdAt:today(),
                      docs:[], timeline:[{status:'created',at:now(),note:'Created in portal'}], ...data };
      const v = Rules.validateOrder(draft, invMap);
      draft.status = v.status;
      draft.holdReason = v.status==='held' ? v.problems.filter(p=>!p.soft||p.code==='INSUFFICIENT_STOCK')[0]?.msg : null;
      orders.unshift(draft);
      recomputeAllocations();
      return { order:draft, validation:v };
    },

    // PATCH /orders/:id
    updateOrder: (id, patch) => {
      const o = orders.find(x=>x.id===id);
      if (!Rules.assertOwned(o, SESSION.brandId).ok) return null;
      Object.assign(o, patch);
      const v = Rules.validateOrder(o, api.inventoryBySku(), o.id);
      if (!['picking','packing','shipped','delivered','cancelled'].includes(o.status)) {
        o.status = v.status;
        o.holdReason = v.status==='held' ? v.problems[0]?.msg : null;
      }
      recomputeAllocations();
      return o;
    },

    // POST /orders/:id/transition  — guarded by the status machine
    transition: (id, to) => {
      const o = orders.find(x=>x.id===id);
      if (!Rules.assertOwned(o, SESSION.brandId).ok) return { ok:false, msg:'Not found' };
      if (!Rules.canBrandSet(to)) return { ok:false, msg:'That status is set by the warehouse, not the brand.' };
      const t = Rules.canTransition(o.status, to);
      if (!t.ok) return t;
      o.status = to;
      o.timeline.push({ status:to, at:now(), note:'' });
      recomputeAllocations();
      return { ok:true, order:o };
    },

    // POST /orders/bulk-import
    bulkImport: (rows) => {
      const prods = api.listProducts(); const invMap = api.inventoryBySku();
      const results = rows.map(r => ({ row:r, ...Rules.validateImportRow(r, prods, invMap) }));
      const imported = [];
      results.forEach(res => {
        if (res.level === 'error') return;
        const o = api.createOrder({
          orderRef:res.row.orderRef, orderDate:res.row.orderDate, buyerName:res.row.buyerName,
          channel:'import', listingUrl:res.row.listingUrl||null,
          lines:[{ sku:res.resolvedSku, qty:parseInt(res.row.qty,10) }],
          label: res.row.labelUrl ? { filename:'from-import.pdf', uploadedAt:today() } : null
        });
        imported.push(o.order);
      });
      return { results, imported,
               counts:{ ready:results.filter(r=>r.level==='ready').length,
                        warning:results.filter(r=>r.level==='warning').length,
                        error:results.filter(r=>r.level==='error').length } };
    },

    getMapping: () => savedMapping,
    saveMapping: (m) => { savedMapping = m; return m; },

    // GET /billing
    getBilling: () => ({ ...billing, total: Rules.round2(billing.lines.reduce((s,l)=>s+l.amount,0)) }),
    // GET /users
    listUsers: () => Rules.scope(users, SESSION.brandId),
    getNotifications: () => notifications,
    setNotification: (k,v) => { notifications[k] = v; return notifications; },
    listChannels: () => channels,

    // GET /reports/summary
    reportSummary: () => {
      const all = api.listOrders();
      const byStatus = {};
      Object.keys(Rules.STATUS).forEach(s => byStatus[s] = all.filter(o=>o.status===s).length);
      return {
        byStatus,
        shippedToday: all.filter(o => (o.status==='shipped'||o.status==='delivered')).length,
        perDay:[12,19,11,24,31,9,6],
        days:['Wed','Thu','Fri','Sat','Sun','Mon','Tue']
      };
    }
  };

  function today(){ return new Date().toISOString().slice(0,10); }
  function now(){ return new Date().toISOString().slice(0,16).replace('T',' '); }

  return { api, recomputeAllocations, _raw:{ orders, inventory, asns, products } };
})();
