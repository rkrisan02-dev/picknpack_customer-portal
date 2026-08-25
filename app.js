/* ==========================================================================
   Pick n Pack — Brand Portal · UI / PAGES / ROUTER
   Vanilla JS. Each render* function = one page component. Port each into
   your framework's component of choice; the logic stays identical.
   ========================================================================== */

const API = DB.api;
const $ = (s,r=document) => r.querySelector(s);
const el = (h) => { const d=document.createElement('div'); d.innerHTML=h.trim(); return d.firstElementChild; };
const esc = (s) => String(s??'').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const money = (n) => '$' + Number(n).toFixed(2);

/* ---------------- toast ---------------- */
function toast(msg, kind=''){
  let w = $('.toast-wrap'); if(!w){ w = el('<div class="toast-wrap"></div>'); document.body.appendChild(w); }
  const t = el(`<div class="toast ${kind}">${esc(msg)}</div>`);
  w.appendChild(t); setTimeout(()=>t.remove(), 3800);
}
function modal(title, bodyHtml, footHtml){
  const bg = el(`<div class="modal-bg"><div class="modal">
    <div class="modal-h"><b>${esc(title)}</b><span class="x">&times;</span></div>
    <div class="modal-b">${bodyHtml}</div>
    ${footHtml?`<div class="modal-f">${footHtml}</div>`:''}
  </div></div>`);
  bg.querySelector('.x').onclick = ()=>bg.remove();
  bg.onclick = e => { if(e.target===bg) bg.remove(); };
  document.body.appendChild(bg); return bg;
}
const pill = (s) => `<span class="pill ${s}">${(Rules.STATUS[s]?.label||s)}</span>`;

/* ---------------- navigation ---------------- */
const NAV = [
  { grp:'Overview' },
  { id:'dashboard', label:'Dashboard',          icon:'▦' },
  { id:'reports',   label:'Reports',            icon:'◱' },
  { grp:'Inbound' },
  { id:'asns',      label:'Expected Receiving', icon:'⇥', badge:()=>API.listAsns().filter(a=>a.status!=='received').length },
  { id:'inventory', label:'Inventory',          icon:'▤' },
  { grp:'Outbound' },
  { id:'orders',    label:'Orders',             icon:'☰', badge:()=>API.listOrders().filter(o=>['needs_label','held'].includes(o.status)).length },
  { id:'import',    label:'Upload Orders',      icon:'↥' },
  { id:'labels',    label:'Labels & Docs',      icon:'⎙' },
  { grp:'Setup' },
  { id:'products',  label:'Products',           icon:'▧' },
  { id:'channels',  label:'Channels',           icon:'⚯' },
  { id:'billing',   label:'Billing',            icon:'⛁' },
  { id:'settings',  label:'Settings',           icon:'⚙' }
];

function renderSidebar(active){
  const s = API.session();
  const logo = `<svg viewBox="0 0 100 100"><path d="M50 10 A40 40 0 1 1 15.4 30" fill="none" stroke="#1677FF" stroke-width="8" stroke-linecap="round"/><path d="M7.75 34.8 L15.4 30 L15.1 39" fill="none" stroke="#1677FF" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/><circle cx="50" cy="10" r="5.5" fill="#25B94B"/></svg>`;
  let h = `<div class="side"><div class="side-lg">${logo}<div><b>Pick n Pack</b><small>${esc(s.warehouseName)}</small></div></div>`;
  NAV.forEach(n => {
    if (n.grp) { h += `<div class="side-grp">${n.grp}</div>`; return; }
    let b = ''; try { const c = n.badge ? n.badge() : 0; if (c>0) b = `<span class="badge">${c}</span>`; } catch(e){}
    h += `<a data-nav="${n.id}" class="${active===n.id?'on':''}"><span>${n.icon}</span>${n.label}${b}</a>`;
  });
  return h + '</div>';
}

/* ======================================================================
   PAGE · DASHBOARD
   ====================================================================== */
function pageDashboard(){
  const inv = API.listInventory(), orders = API.listOrders();
  const avail = inv.reduce((s,i)=>s+i.available,0);
  const shipped = orders.filter(o=>['shipped','delivered'].includes(o.status)).length;
  const attention = orders.filter(o=>['needs_label','held'].includes(o.status));
  const inbound = API.listAsns().filter(a=>a.status!=='received')
                    .reduce((s,a)=>s+a.lines.reduce((x,l)=>x+l.qtyExpected,0),0);
  const low = inv.filter(i=>i.available>0 && i.available<=5);
  const asnVar = API.listAsns().filter(a=>a.status==='variance');

  return `
  <div class="topbar"><h1>Good morning, ${esc(API.session().brandName)}</h1>
    <div class="sp"><button class="btn" data-nav="import">↥ Upload orders</button>
      <button class="btn pri" data-nav="order-new">+ New order</button></div></div>

  <div class="kpis">
    <div class="kpi"><div class="l">Available to sell</div><div class="v">${avail.toLocaleString()}</div><div class="d">across ${inv.length} SKUs</div></div>
    <div class="kpi"><div class="l">Shipped</div><div class="v">${shipped}</div><div class="d g">▲ this period</div></div>
    <div class="kpi"><div class="l">Needs your action</div><div class="v">${attention.length}</div><div class="d ${attention.length?'a':''}">${attention.filter(o=>o.status==='needs_label').length} missing labels</div></div>
    <div class="kpi"><div class="l">Inbound en route</div><div class="v">${inbound}</div><div class="d">${API.listAsns().filter(a=>a.status!=='received').length} shipments</div></div>
  </div>

  <div class="cols">
    <div class="card">
      <div class="card-h"><b>Needs your attention</b><div class="f"><span class="chip on">${attention.length+low.length+asnVar.length}</span></div></div>
      <table><tbody>
        ${attention.map(o=>`<tr class="clickable" data-order="${o.id}">
          <td>${pill(o.status)}</td>
          <td>${esc(o.orderRef)} — ${esc(o.holdReason || 'Shipping label missing')}</td>
          <td class="tr"><span class="mono" style="color:var(--blue)">Fix →</span></td></tr>`).join('')}
        ${low.map(i=>`<tr class="clickable" data-nav="inventory">
          <td><span class="pill picking">Low</span></td>
          <td>${esc(i.name)} — ${i.available} left</td>
          <td class="tr"><span class="mono" style="color:var(--blue)">View →</span></td></tr>`).join('')}
        ${asnVar.map(a=>`<tr class="clickable" data-asn="${a.id}">
          <td><span class="pill variance">Short</span></td>
          <td>${a.id} received ${a.lines[0].qtyReceived} of ${a.lines[0].qtyExpected}</td>
          <td class="tr"><span class="mono" style="color:var(--blue)">Review →</span></td></tr>`).join('')}
        ${(!attention.length && !low.length && !asnVar.length) ? '<tr><td class="empty">Nothing needs attention. </td></tr>' : ''}
      </tbody></table>
    </div>

    <div class="card">
      <div class="card-h"><b>Recent shipments</b><div class="f"><span class="chip">End of day</span></div></div>
      <table><thead><tr><th>Order</th><th>Product</th><th>Qty</th><th>Tracking</th></tr></thead><tbody>
        ${orders.filter(o=>['shipped','delivered'].includes(o.status)).slice(0,6).map(o=>`
          <tr class="clickable" data-order="${o.id}">
            <td class="mono">${esc(o.orderRef)}</td>
            <td>${esc(skuName(o.lines[0].sku))}</td>
            <td class="mono">${o.lines[0].qty}</td>
            <td class="mono">…${esc((o.tracking||'').slice(-5))}</td></tr>`).join('')}
      </tbody></table>
    </div>
  </div>`;
}
function skuName(sku){ const p = API.listProducts().find(p=>p.sku===sku); return p?p.name:(sku||'—'); }

/* ======================================================================
   PAGE · INVENTORY
   ====================================================================== */
let invFilter = 'all';
function pageInventory(){
  let inv = API.listInventory();
  if (invFilter==='low')     inv = inv.filter(i=>i.available>0 && i.available<=5);
  if (invFilter==='out')     inv = inv.filter(i=>i.available===0);
  if (invFilter==='inbound') inv = inv.filter(i=>i.inbound>0);
  const all = API.listInventory();

  return `
  <div class="topbar"><h1>Inventory</h1>
    <div class="sp"><button class="btn" data-act="export-inv">Export CSV</button>
      <button class="btn pri" data-nav="asn-new">+ Expected receiving</button></div></div>

  <div class="note blue" style="margin-bottom:16px">
    <b>Available = On hand − Allocated.</b> Allocated is stock already promised to orders that haven't shipped.
    Selling against "on hand" is how overselling happens — always sell against <b>Available</b>.
  </div>

  <div class="card">
    <div class="card-h"><b>${all.length} SKUs</b><div class="f">
      ${[['all','All',all.length],['low','Low stock',all.filter(i=>i.available>0&&i.available<=5).length],
         ['out','Out',all.filter(i=>i.available===0).length],['inbound','Inbound',all.filter(i=>i.inbound>0).length]]
        .map(([k,l,c])=>`<span class="chip ${invFilter===k?'on':''}" data-invf="${k}">${l} ${c}</span>`).join('')}
    </div></div>
    <table><thead><tr>
      <th>Product</th><th>SKU</th><th>Bin</th><th class="tr">On hand</th><th class="tr">Allocated</th>
      <th class="tr">Available</th><th class="tr">Inbound</th><th>Health</th></tr></thead><tbody>
      ${inv.map(i=>{
        const pct = i.onHand ? Math.round(i.available/i.onHand*100) : 0;
        const cls = i.available===0?'out':(i.available<=5?'low':'');
        return `<tr>
          <td><b>${esc(i.name)}</b></td>
          <td class="mono">${esc(i.sku)}</td>
          <td class="mono faint">${esc(i.bin)}</td>
          <td class="tr mono">${i.onHand}</td>
          <td class="tr mono ${i.allocated?'a':''}">${i.allocated}</td>
          <td class="tr mono"><b>${i.available}</b></td>
          <td class="tr mono ${i.inbound?'g':'faint'}">${i.inbound||'—'}</td>
          <td style="width:130px"><div class="stock-bar"><i class="${cls}" style="width:${pct}%"></i></div></td>
        </tr>`;}).join('') || '<tr><td colspan="8" class="empty">Nothing here.</td></tr>'}
    </tbody></table>
  </div>`;
}

/* ======================================================================
   PAGE · EXPECTED RECEIVING (list + create + detail)
   ====================================================================== */
function pageAsns(){
  const asns = API.listAsns();
  return `
  <div class="topbar"><h1>Expected Receiving</h1>
    <div class="sp"><button class="btn pri" data-nav="asn-new">+ New ASN</button></div></div>
  <div class="note blue" style="margin-bottom:16px">
    Tell the warehouse what's coming <b>before it arrives</b>. They match the carton to your tracking number on arrival,
    and anything short or damaged is reported back here the moment it's counted.
  </div>
  <div class="card">
    <div class="card-h"><b>${asns.length} shipments</b></div>
    <table><thead><tr><th>ASN</th><th>Supplier</th><th>Contents</th><th>Tracking</th><th>ETA</th><th>Status</th></tr></thead><tbody>
      ${asns.map(a=>`<tr class="clickable ${a.status==='variance'?'row-err':''}" data-asn="${a.id}">
        <td class="mono">${a.id}</td><td>${esc(a.supplier)}</td>
        <td class="mono">${a.lines.map(l=>`${l.sku} · ${l.qtyExpected}`).join('<br>')}</td>
        <td class="mono">${esc(a.tracking)}</td><td class="mono">${esc(a.eta)}</td>
        <td>${pill(a.status)}</td></tr>`).join('')}
    </tbody></table>
  </div>`;
}

function pageAsnNew(){
  const prods = API.listProducts();
  return `
  <div class="crumb"><b data-nav="asns">Expected Receiving</b> / New</div>
  <div class="topbar"><h1>New expected receiving</h1></div>
  <div class="cols-3">
    <div class="card"><div class="card-b">
      <div class="fld"><label>Product / SKU *</label>
        <select id="a-sku">${prods.map(p=>`<option value="${p.sku}">${esc(p.name)} — ${p.sku}</option>`).join('')}</select></div>
      <div class="f2">
        <div class="fld"><label>Quantity ordered *</label><input id="a-qty" type="number" min="1" value="200"></div>
        <div class="fld"><label>Expected date *</label><input id="a-eta" type="date" value="2026-08-30"></div>
      </div>
      <div class="fld"><label>Supplier *</label><input id="a-sup" placeholder="Guangzhou Trading Co."></div>
      <div class="f2">
        <div class="fld"><label>Supplier tracking number *</label><input id="a-trk" placeholder="YT2038471109912"></div>
        <div class="fld"><label>Carrier</label><select id="a-car">
          <option>YunExpress</option><option>China Post</option><option>DHL</option><option>FedEx</option><option>Other</option></select></div>
      </div>
      <div class="fld"><label>Documents <span class="opt">— invoice, packing list, MSDS</span></label>
        <div class="drop" id="a-drop"><div class="big">Attach documents</div><div class="sm">PDF, JPG · optional but speeds up customs</div></div>
        <div id="a-docs" style="margin-top:8px;display:flex;gap:6px;flex-wrap:wrap"></div></div>
      <div style="display:flex;gap:8px;margin-top:6px">
        <button class="btn pri" data-act="asn-save">Send to warehouse</button>
        <button class="btn" data-nav="asns">Cancel</button></div>
    </div></div>
    <div class="rail"><div class="card"><div class="card-b">
      <b style="color:var(--navy)">What happens next</b>
      <div class="timeline" style="margin-top:12px">
        <div class="tl-item done"><div class="t">Warehouse sees it</div><div class="d">Appears as an expected receipt</div></div>
        <div class="tl-item future"><div class="t">Carton arrives</div><div class="d">Matched by tracking number</div></div>
        <div class="tl-item future"><div class="t">Counted &amp; inspected</div><div class="d">Short/damage reported to you</div></div>
        <div class="tl-item future"><div class="t">Posts to your inventory</div><div class="d">Available to sell immediately</div></div>
      </div>
    </div></div></div>
  </div>`;
}

function pageAsnDetail(id){
  const a = API.getAsn(id); if(!a) return `<div class="empty">Not found.</div>`;
  const l = a.lines[0], v = Rules.asnVariance(l);
  return `
  <div class="crumb"><b data-nav="asns">Expected Receiving</b> / ${a.id}</div>
  <div class="topbar"><h1>${a.id}</h1><div class="sp">${pill(a.status)}</div></div>
  <div class="cols">
    <div>
      <div class="card"><div class="card-h"><b>Shipment</b></div><table><tbody>
        <tr><td class="muted" style="width:130px">Supplier</td><td>${esc(a.supplier)}</td></tr>
        <tr><td class="muted">Carrier</td><td>${esc(a.carrier)}</td></tr>
        <tr><td class="muted">Tracking</td><td class="mono">${esc(a.tracking)}</td></tr>
        <tr><td class="muted">ETA</td><td class="mono">${esc(a.eta)}</td></tr>
        <tr><td class="muted">Product</td><td><b>${esc(skuName(l.sku))}</b><br><span class="mono faint">${l.sku}</span></td></tr>
      </tbody></table></div>
      ${a.docs.length?`<div class="card"><div class="card-h"><b>Documents</b></div><div class="card-b">
        ${a.docs.map(d=>`<span class="doc">📎 ${esc(d.filename)}</span>`).join(' ')}</div></div>`:''}
    </div>
    <div>
      <div class="card"><div class="card-h"><b>Expected vs received</b></div><table><tbody>
        <tr><td class="muted">You declared</td><td class="tr mono" style="font-size:15px"><b>${v.expected}</b></td></tr>
        <tr><td class="muted">Warehouse counted</td><td class="tr mono" style="font-size:15px"><b>${v.received}</b></td></tr>
        ${v.variance!==0?`<tr class="row-err"><td class="r"><b>Variance</b></td><td class="tr mono r"><b>${v.variance>0?'+':''}${v.variance}</b></td></tr>`:''}
        <tr><td class="muted">Damaged (QC hold)</td><td class="tr mono">${v.damaged}</td></tr>
        <tr style="background:var(--green-l)"><td><b>Posted to inventory</b></td><td class="tr mono"><b>${v.postsToInventory}</b></td></tr>
      </tbody></table></div>
      ${a.notes.length?`<div class="card"><div class="card-h"><b>Warehouse note</b></div><div class="card-b">
        ${a.notes.map(n=>`<div style="background:#FAFCFF;border:1px solid var(--line);border-radius:6px;padding:12px">
          ${esc(n.text)}<div style="margin-top:8px;display:flex;gap:6px;flex-wrap:wrap">
          ${(n.photos||[]).map(p=>`<span class="doc">📷 ${esc(p)}</span>`).join('')}</div>
          <div class="mono faint" style="margin-top:6px;font-size:11px">${esc(n.by)} · ${esc(n.at)}</div></div>`).join('')}
        ${v.hasVariance?`<div style="display:flex;gap:8px;margin-top:12px">
          <button class="btn pri" data-act="asn-accept">Accept variance</button>
          <button class="btn">Raise supplier claim</button></div>`:''}
      </div></div>`:''}
    </div>
  </div>`;
}

/* ======================================================================
   PAGE · ORDERS (list)
   ====================================================================== */
let ordFilter = 'all';
function pageOrders(){
  let list = API.listOrders();
  const all = API.listOrders();
  if (ordFilter!=='all') list = list.filter(o=>o.status===ordFilter);
  const counts = {}; Object.keys(Rules.STATUS).forEach(s=>counts[s]=all.filter(o=>o.status===s).length);

  return `
  <div class="topbar"><h1>Orders</h1>
    <div class="sp"><button class="btn" data-act="export-orders">Export</button>
      <button class="btn" data-nav="import">↥ Bulk upload</button>
      <button class="btn pri" data-nav="order-new">+ New order</button></div></div>

  <div class="card">
    <div class="card-h"><b>${all.length} orders</b><div class="f">
      <span class="chip ${ordFilter==='all'?'on':''}" data-ordf="all">All ${all.length}</span>
      ${['needs_label','held','ready','picking','packing','shipped','delivered']
        .filter(s=>counts[s]>0)
        .map(s=>`<span class="chip ${ordFilter===s?'on':''}" data-ordf="${s}">${Rules.STATUS[s].label} ${counts[s]}</span>`).join('')}
    </div></div>
    <table><thead><tr>
      <th>Order #</th><th>Date</th><th>Product</th><th class="tr">Qty</th><th>Ship to</th>
      <th>Label</th><th>Status</th><th>Tracking</th></tr></thead><tbody>
      ${list.map(o=>{
        const ln = o.lines[0];
        const bad = ['held','needs_label'].includes(o.status);
        return `<tr class="clickable ${bad?'row-err':''}" data-order="${o.id}">
          <td class="mono">${esc(o.orderRef)}</td>
          <td class="mono faint">${esc(o.orderDate)}</td>
          <td>${ln.sku?esc(skuName(ln.sku)):`<span class="r">⚠ ${esc(ln.rawName||'unknown')}</span>`}</td>
          <td class="tr mono">${ln.qty}</td>
          <td>${esc(o.buyerName)}</td>
          <td>${o.label?'<span class="doc">📎 label</span>':'<span class="tag-warn">⚠ missing</span>'}</td>
          <td>${pill(o.status)}</td>
          <td class="mono faint">${o.tracking?'…'+esc(o.tracking.slice(-5)):'—'}</td></tr>`;
      }).join('') || '<tr><td colspan="8" class="empty">No orders in this view.</td></tr>'}
    </tbody></table>
  </div>`;
}

/* ======================================================================
   PAGE · ORDER DETAIL
   ====================================================================== */
function pageOrderDetail(id){
  const o = API.getOrder(id); if(!o) return `<div class="empty">Not found.</div>`;
  const inv = API.inventoryBySku();
  const v = Rules.validateOrder(o, inv, o.id);
  const acc = Rules.accrueForOrder(o);
  const seq = ['created','ready','picking','packing','shipped','delivered'];

  return `
  <div class="crumb"><b data-nav="orders">Orders</b> / ${esc(o.orderRef)}</div>
  <div class="topbar"><h1 class="mono" style="font-size:20px">${esc(o.orderRef)}</h1>
    <div class="sp">${pill(o.status)}
      ${['draft','needs_label','held','ready'].includes(o.status)?
        `<button class="btn dgr" data-act="cancel-order" data-id="${o.id}">Cancel order</button>`:''}</div></div>

  ${o.status==='held'?`<div class="note red" style="margin-bottom:16px"><b>Held:</b> ${esc(o.holdReason||'')}
    ${v.problems.map(p=>`<br>· ${esc(p.msg)}`).join('')}</div>`:''}
  ${o.status==='needs_label'?`<div class="note" style="margin-bottom:16px">
    <b>Waiting on a shipping label.</b> The warehouse can't ship without it. Upload below and this moves to Ready automatically.</div>`:''}

  <div class="cols-3">
    <div>
      <div class="card"><div class="card-h"><b>Order</b></div><table><tbody>
        <tr><td class="muted" style="width:140px">Ordered</td><td class="mono">${esc(o.orderDate)}</td></tr>
        <tr><td class="muted">Channel</td><td>${esc(o.channel)} ${o.listingUrl?`· <a href="#" style="color:var(--blue)">view listing</a>`:''}</td></tr>
        <tr><td class="muted">Buyer / ship-to</td><td><b>${esc(o.buyerName)}</b>
          ${o.label&&o.label.shipTo?`<br><span class="faint" style="font-size:12px">${esc(o.label.shipTo)} <span class="mono">(from label)</span></span>`:''}</td></tr>
      </tbody></table></div>

      <div class="card"><div class="card-h"><b>Items</b></div><table>
        <thead><tr><th>Product</th><th>SKU</th><th class="tr">Qty</th><th class="tr">Available</th></tr></thead><tbody>
        ${o.lines.map(ln=>{
          const i = inv[ln.sku];
          return `<tr><td>${ln.sku?esc(skuName(ln.sku)):`<span class="r">⚠ ${esc(ln.rawName||'')} — unmapped</span>`}</td>
            <td class="mono">${esc(ln.sku||'—')}</td><td class="tr mono">${ln.qty}</td>
            <td class="tr mono ${i&&Rules.availableFor(i,o.id)<ln.qty?'r':''}">${i?Rules.availableFor(i,o.id):'—'}</td></tr>`;
        }).join('')}</tbody></table></div>

      <div class="card"><div class="card-h"><b>Documents</b></div><div class="card-b">
        ${o.label?`<div style="margin-bottom:10px"><span class="doc">📎 ${esc(o.label.filename)}</span>
          ${o.label.carrier?`<div class="parsed" style="margin-top:10px">
            <div class="f2" style="gap:12px">
              <div><div class="k">Carrier</div><div>${esc(o.label.carrier)}</div></div>
              <div><div class="k">Tracking on label</div><div class="mono">${esc(o.label.tracking||'')}</div></div></div>
            <div style="margin-top:8px"><div class="k">Ships to</div><div>${esc(o.label.shipTo||'')}</div></div>
          </div>`:''}</div>`
        :`<div class="drop" data-act="upload-label" data-id="${o.id}">
            <div class="big">Upload shipping label</div><div class="sm">PDF or PNG · required before shipping</div></div>`}
        ${o.docs.length?`<div style="margin-top:10px;display:flex;gap:6px;flex-wrap:wrap">
          ${o.docs.map(d=>`<span class="doc">📎 ${esc(d.filename)}</span>`).join('')}</div>`:''}
      </div></div>
    </div>

    <div class="rail">
      <div class="card"><div class="card-h"><b>Timeline</b></div><div class="card-b">
        <div class="timeline">
          ${seq.map(s=>{
            const hit = o.timeline.find(t=>t.status===s);
            const cur = o.status===s;
            return `<div class="tl-item ${hit?'done':'future'}">
              <div class="t" style="${cur?'color:var(--blue)':''}">${s==='created'?'Created':Rules.STATUS[s].label}</div>
              <div class="d">${hit?esc(hit.at):'—'}</div></div>`;
          }).join('')}
        </div></div></div>

      <div class="card"><div class="card-h"><b>Charges accrued</b></div><table><tbody>
        ${acc.items.map(i=>`<tr><td class="muted">${esc(i.label)}</td><td class="tr mono">${money(i.amount)}</td></tr>`).join('')}
        <tr style="background:var(--bg)"><td><b>Total</b></td><td class="tr mono"><b>${money(acc.total)}</b></td></tr>
      </tbody></table></div>
    </div>
  </div>`;
}

/* ======================================================================
   PAGE · ORDER CREATE  (the core screen)
   ====================================================================== */
let draft = null;
function newDraft(){ return { orderRef:'', orderDate:new Date().toISOString().slice(0,10), buyerName:'',
  channel:'eBay', listingUrl:'', shipToAddress:'', lines:[], label:null, docs:[] }; }

function pageOrderNew(){
  if(!draft) draft = newDraft();
  const inv = API.inventoryBySku();
  const v = Rules.validateOrder(draft, inv);
  const stepDone = { d: !!(draft.orderRef && draft.buyerName), i: draft.lines.length>0, l: !!draft.label };

  return `
  <div class="crumb"><b data-nav="orders">Orders</b> / New</div>
  <div class="topbar"><h1>New order</h1>
    <div class="sp"><button class="btn" data-nav="orders">Cancel</button>
      <button class="btn" data-act="save-draft">Save draft</button>
      <button class="btn pri" data-act="submit-order" ${v.canSubmit?'':'disabled'}>Send to warehouse</button></div></div>

  <div class="steps">
    <div class="stp ${stepDone.d?'done':'on'}"><div class="n">01</div><div class="t">Order details</div></div>
    <div class="stp ${stepDone.i?'done':(stepDone.d?'on':'')}"><div class="n">02</div><div class="t">Items</div></div>
    <div class="stp ${stepDone.l?'done':(stepDone.i?'on':'')}"><div class="n">03</div><div class="t">Label &amp; documents</div></div>
    <div class="stp ${v.canSubmit?'on':''}"><div class="n">04</div><div class="t">Review &amp; submit</div></div>
  </div>

  <div class="cols-3">
    <div>
      <!-- 01 -->
      <div class="card"><div class="card-h"><b>01 · Order details</b></div><div class="card-b">
        <div class="f3">
          <div class="fld"><label>Channel</label><select id="o-ch">
            <option>eBay</option><option>Amazon</option><option>Walmart</option><option>TikTok Shop</option><option>Manual</option></select></div>
          <div class="fld"><label>Order number *</label><input id="o-ref" value="${esc(draft.orderRef)}" placeholder="31-15002-44121"></div>
          <div class="fld"><label>Order date *</label><input id="o-date" type="date" value="${esc(draft.orderDate)}"></div>
        </div>
        <div class="f2">
          <div class="fld"><label>Buyer / ship-to name *</label><input id="o-buyer" value="${esc(draft.buyerName)}" placeholder="Katrina Alvarez"></div>
          <div class="fld"><label>Listing URL</label><input id="o-url" value="${esc(draft.listingUrl)}" placeholder="https://www.ebay.com/itm/…"></div>
        </div>
        <div class="fld"><label>Ship-to address <span class="opt">— optional. The label decides where it actually ships.</span></label>
          <input id="o-addr" value="${esc(draft.shipToAddress)}" placeholder="Auto-filled from label if readable"></div>
      </div></div>

      <!-- 02 -->
      <div class="card"><div class="card-h"><b>02 · Items</b></div><div class="card-b">
        <div class="fld"><label>Search your products</label>
          <input id="o-search" placeholder="Type a product name or SKU…" autocomplete="off">
          <div id="o-results"></div></div>
        <div id="o-lines">${renderLines(draft, inv)}</div>
      </div></div>

      <!-- 03 -->
      <div class="card" style="border-color:${draft.label?'var(--line)':'#B9D2FA'}">
        <div class="card-h"><b>03 · Shipping label &amp; documents</b></div><div class="card-b">
        ${draft.label?`
          <div class="parsed">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
              <span class="doc" style="background:transparent">📎 ${esc(draft.label.filename)}</span>
              <span class="tag-ok" style="margin-left:auto">✓ READ OK</span>
              <span class="doc x" data-act="rm-label" style="cursor:pointer">✕</span></div>
            <div class="f2" style="gap:12px">
              <div><div class="k">Carrier / service</div><div>${esc(draft.label.carrier)}</div></div>
              <div><div class="k">Tracking on label</div><div class="mono">${esc(draft.label.tracking)}</div></div></div>
            <div style="margin-top:8px"><div class="k">Ships to (read from label)</div><div>${esc(draft.label.shipTo)}</div></div>
          </div>`
        :`<div class="drop" data-act="add-label">
            <div class="big">Drop the shipping label PDF here</div>
            <div class="sm">Required before the warehouse can ship · PDF, PNG, or ZIP for multiple</div>
            <div style="margin-top:10px"><span class="btn pri">Choose file</span></div></div>`}
        <div style="margin-top:12px">
          <label style="display:block;font-family:var(--mono);font-size:9.5px;letter-spacing:.1em;text-transform:uppercase;color:var(--muted);margin-bottom:6px">Additional documents</label>
          <div style="display:flex;gap:6px;flex-wrap:wrap">
            ${draft.docs.map((d,i)=>`<span class="doc">📎 ${esc(d.filename)} <span class="x" data-act="rm-doc" data-i="${i}">✕</span></span>`).join('')}
            <button class="btn sm" data-act="add-doc">+ Add</button></div></div>
      </div></div>
    </div>

    <!-- RAIL -->
    <div class="rail">
      <div class="card"><div class="card-h"><b>Summary</b></div><table><tbody>
        <tr><td class="muted">Order number</td><td class="tr mono">${esc(draft.orderRef)||'—'}</td></tr>
        <tr><td class="muted">Channel</td><td class="tr">${esc(draft.channel)}</td></tr>
        <tr><td class="muted">Items</td><td class="tr">${draft.lines.length} line${draft.lines.length===1?'':'s'} · ${draft.lines.reduce((s,l)=>s+ (+l.qty||0),0)} units</td></tr>
        <tr><td class="muted">Label</td><td class="tr">${draft.label?'<b class="g">✓ attached</b>':'<b class="r">missing</b>'}</td></tr>
        <tr><td class="muted">Stock check</td><td class="tr">${draft.lines.length===0?'—':(v.problems.some(p=>p.code==='INSUFFICIENT_STOCK')?'<b class="r">short</b>':'<b class="g">✓ available</b>')}</td></tr>
        <tr><td class="muted">Est. handling</td><td class="tr mono">${money(Rules.accrueForOrder(draft).total)}</td></tr>
      </tbody></table></div>

      ${v.problems.length?`<div class="card"><div class="card-h"><b>Before you can submit</b></div><div class="card-b">
        ${v.problems.map(p=>`<div style="font-size:12.5px;color:var(--red);margin-bottom:6px">· ${esc(p.msg)}</div>`).join('')}
      </div></div>`:''}

      <div class="card" style="background:var(--blue-l);border-color:#B9D2FA"><div class="card-h" style="border-color:#C3D8FA"><b>What happens next</b></div>
        <table><tbody>
          <tr><td>${pill('ready')}</td><td style="font-size:12px">Lands in warehouse queue</td></tr>
          <tr><td>${pill('picking')}</td><td style="font-size:12px">Picker scans SKU from bin</td></tr>
          <tr><td>${pill('packing')}</td><td style="font-size:12px">Your label prints at the bench</td></tr>
          <tr><td>${pill('shipped')}</td><td style="font-size:12px">Tracking appears here</td></tr>
        </tbody></table></div>

      <div class="card"><div class="card-h"><b>Shortcuts</b></div><div class="card-b" style="display:flex;flex-direction:column;gap:8px">
        <button class="btn" data-nav="import" style="justify-content:flex-start">↥ Upload many via CSV / XLSX</button>
        <button class="btn" data-act="dup-order" style="justify-content:flex-start">⧉ Duplicate a previous order</button>
        <button class="btn" data-nav="channels" style="justify-content:flex-start">⚯ Connect a channel</button>
      </div></div>
    </div>
  </div>`;
}

function renderLines(d, inv){
  if(!d.lines.length) return '<div class="empty" style="padding:24px">No items yet — search above.</div>';
  return d.lines.map((ln,i)=>{
    const iv = inv[ln.sku]; const avail = iv?Rules.availableFor(iv):0;
    const short = ln.qty > avail;
    const pct = avail ? Math.min(100, Math.round(ln.qty/avail*100)) : 100;
    return `<div style="border:1px solid var(--line);border-radius:7px;padding:12px;margin-bottom:9px;background:#FAFCFF">
      <div style="display:flex;align-items:center;gap:12px">
        <div style="flex:1"><b>${esc(skuName(ln.sku))}</b><div class="mono faint">${esc(ln.sku)}</div></div>
        <div style="text-align:center"><label style="font-family:var(--mono);font-size:9px;letter-spacing:.09em;text-transform:uppercase;color:var(--muted)">Qty</label>
          <input type="number" min="1" value="${ln.qty}" data-lineqty="${i}" style="width:64px;text-align:center;padding:6px;border:1px solid var(--line);border-radius:5px"></div>
        <span class="x" data-act="rm-line" data-i="${i}" style="cursor:pointer;color:var(--faint);font-size:17px">✕</span>
      </div>
      <div class="stock-bar"><i class="${short?'out':(avail<=5?'low':'')}" style="width:${pct}%"></i></div>
      <div style="display:flex;justify-content:space-between;margin-top:5px;font-family:var(--mono);font-size:11px">
        <span class="${short?'r':(avail<=5?'a':'g')}">${short?`⚠ only ${avail} available`:`${avail} available · ${avail-ln.qty} will remain`}</span>
        <span class="faint">${iv&&iv.inbound?`${iv.inbound} inbound`:''}</span></div>
    </div>`;
  }).join('');
}

/* ======================================================================
   PAGE · IMPORT (CSV / XLSX)
   ====================================================================== */
let importState = null;
const SAMPLE_HEADERS = ['Sr No','order date ','Order Number','Quantity','Product Name','Customer Name ',
                        'product link','Label','Status','Shipping Date','Tracking','usps web link'];
const SAMPLE_ROWS = [
  { 'order date ':'2026-08-19','Order Number':'31-15002-44130','Quantity':'1','Product Name':'La Mer Lip Balm',
    'Customer Name ':'Ana Ruiz','Label':'drive.google.com/…','Status':'','Tracking':'' },
  { 'order date ':'2026-08-19','Order Number':'31-15002-44131','Quantity':'2','Product Name':'Sisley Black Rose',
    'Customer Name ':'eIS C/O k. tanaka','Label':'drive.google.com/…','Status':'','Tracking':'' },
  { 'order date ':'2026-08-19','Order Number':'31-15002-44132','Quantity':'1','Product Name':'Shiseido Vital Perfect',
    'Customer Name ':'M. Okafor','Label':'','Status':'','Tracking':'' },
  { 'order date ':'2026-08-19','Order Number':'31-15002-44133','Quantity':'3','Product Name':'Unknown Widget XYZ',
    'Customer Name ':'J. Park','Label':'drive.google.com/…','Status':'','Tracking':'' },
  { 'order date ':'2026-08-19','Order Number':'','Quantity':'1','Product Name':'La Mer Moisturizing',
    'Customer Name ':'D. Silva','Label':'drive.google.com/…','Status':'','Tracking':'' }
];

function pageImport(){
  if(!importState){
    return `
    <div class="topbar"><h1>Upload orders</h1>
      <div class="sp"><button class="btn" data-act="dl-template">Download template</button></div></div>
    <div class="cols">
      <div class="card"><div class="card-h"><b>1 · Choose file</b></div><div class="card-b">
        <div class="drop" data-act="pick-file"><div class="big">Drop a CSV or XLSX</div>
          <div class="sm">Multi-tab workbooks supported — choose the tab after upload</div>
          <div style="margin-top:10px"><span class="btn pri">Choose file</span></div></div>
        <div class="note" style="margin-top:14px">
          <b>Your existing sheet works as-is.</b> Column names don't have to match ours —
          the importer fuzzy-matches headers (including <span class="mono">Lable</span>, <span class="mono">Prduct Name</span>,
          <span class="mono">Trackings</span>) and remembers your mapping for next time.
        </div>
      </div></div>
      <div class="card"><div class="card-h"><b>How rows are handled</b></div><table><tbody>
        <tr><td><span class="pill ready">Ready</span></td><td>Imports as a normal order</td></tr>
        <tr><td><span class="pill needs_label">Warning</span></td><td>Imports, flagged (e.g. no label yet)</td></tr>
        <tr><td><span class="pill held">Error</span></td><td>Held back for you to fix — never silently dropped</td></tr>
      </tbody></table></div>
    </div>`;
  }

  const m = importState.mapping;
  const c = importState.counts;
  return `
  <div class="topbar"><h1>Upload orders</h1>
    <div class="sp"><button class="btn" data-act="import-reset">Start over</button>
      <button class="btn pri" data-act="import-run">Import ${c.ready + c.warning} orders</button></div></div>
  <div class="cols-3">
    <div class="card"><div class="card-h"><b>2 · Map your columns</b>
      <div class="f"><span class="tag-ok">✓ AUTO-MATCHED ${m.filter(x=>x.state==='matched').length}/${m.length}</span></div></div>
      <div class="card-b">
        <div class="map-row" style="border-bottom:1px solid var(--line);padding-bottom:7px">
          <div style="font-family:var(--mono);font-size:9.5px;letter-spacing:.09em;text-transform:uppercase;color:var(--muted)">Your column</div><div></div>
          <div style="font-family:var(--mono);font-size:9.5px;letter-spacing:.09em;text-transform:uppercase;color:var(--muted)">Maps to</div>
          <div style="font-family:var(--mono);font-size:9.5px;letter-spacing:.09em;text-transform:uppercase;color:var(--muted)">Status</div></div>
        ${m.map((r,i)=>`<div class="map-row ${r.state!=='matched'?'row-warn':''}">
          <div class="src">${esc(r.source)}</div><div class="arw">→</div>
          <div class="dst"><select data-map="${i}">
            ${Rules.CANONICAL_FIELDS.map(f=>`<option value="${f.key}" ${r.target===f.key?'selected':''}>${f.label}</option>`).join('')}
          </select></div>
          <div class="${r.state==='matched'?'tag-ok':(r.state==='confirm'?'tag-warn':'tag-err')}">
            ${r.state==='matched'?'✓ matched':(r.state==='confirm'?'⚠ confirm':'⚠ unmapped')}</div>
        </div>`).join('')}
        <div class="note" style="margin-top:12px"><b>Saved per brand.</b> Confirm once and future uploads map silently.</div>
      </div></div>

    <div class="rail">
      <div class="card"><div class="card-h"><b>3 · Validation</b></div><table><tbody>
        <tr><td><span class="pill ready">Ready</span></td><td class="tr"><b>${c.ready}</b></td><td class="faint" style="font-size:11px">will import</td></tr>
        <tr><td><span class="pill needs_label">Warning</span></td><td class="tr"><b>${c.warning}</b></td><td class="faint" style="font-size:11px">import + flag</td></tr>
        <tr><td><span class="pill held">Error</span></td><td class="tr"><b>${c.error}</b></td><td class="faint" style="font-size:11px">held for fix</td></tr>
      </tbody></table></div>
      ${importState.results.filter(r=>r.level!=='ready').length?`
      <div class="card"><div class="card-h"><b>Rows needing attention</b></div><table><tbody>
        ${importState.results.map((r,i)=>r.level==='ready'?'':`
          <tr class="${r.level==='error'?'row-err':'row-warn'}">
            <td class="mono" style="font-size:11px">${esc(r.row['Order Number']||r.row.orderRef||'row '+(i+1))}</td>
            <td style="font-size:12px">${r.issues.map(x=>esc(x.msg)).join('<br>')}
              ${r.resolution&&r.resolution.suggestions&&r.resolution.suggestions.length&&!r.resolvedSku?
                `<br><span class="faint" style="font-size:11px">Did you mean: ${r.resolution.suggestions.slice(0,2).map(s=>esc(s.name)).join(', ')}?</span>`:''}</td>
          </tr>`).join('')}
      </tbody></table></div>`:''}
    </div>
  </div>`;
}

/* ======================================================================
   PAGE · PRODUCTS / LABELS / CHANNELS / BILLING / SETTINGS / REPORTS
   ====================================================================== */
function pageProducts(){
  const ps = API.listProducts(), inv = API.inventoryBySku();
  return `
  <div class="topbar"><h1>Products</h1><div class="sp">
    <button class="btn">Import CSV</button><button class="btn pri" data-act="new-product">+ New product</button></div></div>
  <div class="note blue" style="margin-bottom:16px">
    <b>Aliases are how imports keep working.</b> Every spelling that has ever appeared for a product is stored here,
    so <span class="mono">"La Mer Lip Balm"</span> and <span class="mono">"LaMer lipbalm .32"</span> both resolve to the same SKU.
  </div>
  <div class="card"><div class="card-h"><b>${ps.length} products</b></div>
    <table><thead><tr><th>Product</th><th>SKU</th><th>Also known as</th><th class="tr">Available</th><th class="tr">Weight</th></tr></thead><tbody>
      ${ps.map(p=>`<tr><td><b>${esc(p.name)}</b></td><td class="mono">${esc(p.sku)}</td>
        <td>${(p.aliases||[]).map(a=>`<span class="alias">${esc(a)}</span>`).join('')||'<span class="faint">—</span>'}
          <button class="btn sm" data-act="add-alias" data-sku="${p.sku}" style="margin-left:4px">+</button></td>
        <td class="tr mono">${inv[p.sku]?Rules.availableFor(inv[p.sku]):0}</td>
        <td class="tr mono faint">${p.weightLb} lb</td></tr>`).join('')}
    </tbody></table></div>`;
}

function pageLabels(){
  const need = API.listOrders().filter(o=>!o.label);
  return `
  <div class="topbar"><h1>Labels &amp; documents</h1></div>
  <div class="cols">
    <div class="card"><div class="card-h"><b>Bulk upload labels</b></div><div class="card-b">
      <div class="drop" data-act="bulk-labels"><div class="big">Drop a ZIP of label PDFs</div>
        <div class="sm">Matched to orders automatically by filename or barcode</div></div>
      <div class="note" style="margin-top:14px">Name files with the order number
        (e.g. <span class="mono">31-15002-44121.pdf</span>) for automatic matching.</div>
    </div></div>
    <div class="card"><div class="card-h"><b>Orders still missing a label</b>
      <div class="f"><span class="chip on">${need.length}</span></div></div>
      <table><tbody>
        ${need.map(o=>`<tr class="clickable" data-order="${o.id}">
          <td class="mono">${esc(o.orderRef)}</td><td>${esc(o.buyerName)}</td>
          <td>${pill(o.status)}</td>
          <td class="tr"><span class="mono" style="color:var(--blue)">Upload →</span></td></tr>`).join('')
          || '<tr><td class="empty">Every order has a label. </td></tr>'}
      </tbody></table></div>
  </div>`;
}

function pageChannels(){
  const cs = API.listChannels();
  return `
  <div class="topbar"><h1>Channels</h1></div>
  <div class="note blue" style="margin-bottom:16px">
    Connect a marketplace and orders flow in automatically — no upload step. Until then, CSV/XLSX upload does the same job.</div>
  <div class="card"><div class="card-b">
    ${cs.map(c=>`<div style="display:flex;align-items:center;gap:14px;padding:14px;border:1px solid var(--line);border-radius:7px;margin-bottom:10px">
      <div style="width:38px;height:38px;border-radius:7px;background:#F1F5FB;display:grid;place-items:center;font-weight:800;color:var(--navy)">${esc(c.name[0])}</div>
      <div style="flex:1"><b>${esc(c.name)}</b><div class="muted" style="font-size:12px">${esc(c.note)}</div></div>
      ${c.status==='connected'?'<span class="pill shipped">Connected</span>'
        :c.status==='soon'?'<span class="pill picking">Coming soon</span>'
        :'<button class="btn">Connect</button>'}
    </div>`).join('')}
  </div></div>`;
}

function pageBilling(){
  const b = API.getBilling();
  return `
  <div class="topbar"><h1>Billing</h1></div>
  <div class="cols">
    <div class="card"><div class="card-h"><b>August 2026 — accruing</b></div><table><tbody>
      ${b.lines.map(l=>`<tr><td class="muted">${esc(l.label)}</td><td class="tr mono">${money(l.amount)}</td></tr>`).join('')}
      <tr style="background:var(--blue-l)"><td><b>Month to date</b></td><td class="tr mono"><b>${money(b.total)}</b></td></tr>
    </tbody></table>
    <div class="card-b" style="padding-top:0"><div class="muted" style="font-size:12px">
      Every line traces to the transaction that created it — charges accrue as work happens, not at month end.</div></div></div>
    <div class="card"><div class="card-h"><b>Past invoices</b></div>
      <table><thead><tr><th>Invoice</th><th>Period</th><th class="tr">Amount</th><th>Status</th></tr></thead><tbody>
        ${b.invoices.map(i=>`<tr><td class="mono">${esc(i.id)}</td><td>${esc(i.period)}</td>
          <td class="tr mono">${money(i.amount)}</td><td><span class="pill delivered">Paid</span></td></tr>`).join('')}
      </tbody></table></div>
  </div>`;
}

function pageSettings(){
  const us = API.listUsers(), n = API.getNotifications();
  const rows = [['dailySummary','Daily shipped summary · 6pm'],['variance','Receiving variance detected'],
                ['held','Order held / missing label'],['lowStock','Low stock warning']];
  return `
  <div class="topbar"><h1>Settings</h1></div>
  <div class="cols">
    <div class="card"><div class="card-h"><b>Team</b><div class="f"><button class="btn sm">+ Invite user</button></div></div>
      <table><thead><tr><th>Name</th><th>Email</th><th>Role</th></tr></thead><tbody>
        ${us.map(u=>`<tr><td><b>${esc(u.name)}</b></td><td class="mono faint">${esc(u.email)}</td>
          <td><span class="chip ${u.role==='owner'?'on':''}">${esc(u.role)}</span></td></tr>`).join('')}
      </tbody></table>
      <div class="card-b" style="padding-top:12px"><div class="note">
        <b>Roles:</b> <b>Owner</b> full access · <b>Orders</b> create/edit orders, no billing · <b>Billing</b> invoices only, no order data.</div></div></div>
    <div class="card"><div class="card-h"><b>Notifications</b></div><table><tbody>
      ${rows.map(([k,l])=>`<tr><td>${l}</td><td class="tr">
        <button class="btn sm" data-notif="${k}" style="${n[k]?'background:var(--green);border-color:var(--green);color:#fff':''}">${n[k]?'ON':'OFF'}</button>
      </td></tr>`).join('')}
    </tbody></table></div>
  </div>`;
}

function pageReports(){
  const r = API.reportSummary();
  const max = Math.max(...r.perDay);
  return `
  <div class="topbar"><h1>Reports</h1>
    <div class="sp"><button class="btn">Email me daily</button><button class="btn pri" data-act="export-orders">Download</button></div></div>
  <div class="kpis">
    <div class="kpi"><div class="l">Shipped (period)</div><div class="v">${r.shippedToday}</div><div class="d g">▲ 12%</div></div>
    <div class="kpi"><div class="l">Avg time to ship</div><div class="v">1.4<span style="font-size:15px">d</span></div><div class="d g">▼ 0.3d faster</div></div>
    <div class="kpi"><div class="l">Held / problem</div><div class="v">${(r.byStatus.held||0)+(r.byStatus.needs_label||0)}</div><div class="d a">needs action</div></div>
    <div class="kpi"><div class="l">Units received</div><div class="v">386</div><div class="d">2 ASNs</div></div>
  </div>
  <div class="cols">
    <div class="card"><div class="card-h"><b>Shipped per day</b></div><div class="card-b">
      <div class="bars">${r.perDay.map(v=>`<i class="${v===max?'hi':''}" style="height:${Math.round(v/max*100)}%"><span>${v}</span></i>`).join('')}</div>
      <div class="bx">${r.days.map(d=>`<span>${d}</span>`).join('')}</div></div></div>
    <div class="card"><div class="card-h"><b>Where orders are sitting</b></div><table><tbody>
      ${['needs_label','held','ready','picking','packing','shipped','delivered']
        .map(s=>`<tr><td>${pill(s)}</td><td class="tr mono"><b>${r.byStatus[s]||0}</b></td></tr>`).join('')}
    </tbody></table></div>
  </div>`;
}

/* ======================================================================
   ROUTER
   ====================================================================== */
const ROUTES = {
  dashboard: pageDashboard, inventory: pageInventory, asns: pageAsns,
  'asn-new': pageAsnNew, orders: pageOrders, 'order-new': pageOrderNew,
  import: pageImport, products: pageProducts, labels: pageLabels,
  channels: pageChannels, billing: pageBilling, settings: pageSettings, reports: pageReports
};
let route = { page:'dashboard', id:null };

function navTo(page, id=null){
  if (page==='order-new' && route.page!=='order-new') draft = newDraft();
  route = { page, id }; render();
  window.scrollTo(0,0);
}

function render(){
  const navId = route.page.startsWith('asn')?'asns'
              : route.page.startsWith('order')?'orders' : route.page;
  let body;
  if (route.page==='order-detail')      body = pageOrderDetail(route.id);
  else if (route.page==='asn-detail')   body = pageAsnDetail(route.id);
  else body = (ROUTES[route.page]||pageDashboard)();
  $('#app').innerHTML = renderSidebar(navId) + `<div class="main">${body}</div>`;
  bind();
}

/* ======================================================================
   EVENT BINDING
   ====================================================================== */
function bind(){
  document.querySelectorAll('[data-nav]').forEach(e=>e.onclick=()=>navTo(e.dataset.nav));
  document.querySelectorAll('[data-order]').forEach(e=>e.onclick=()=>navTo('order-detail', e.dataset.order));
  document.querySelectorAll('[data-asn]').forEach(e=>e.onclick=()=>navTo('asn-detail', e.dataset.asn));
  document.querySelectorAll('[data-invf]').forEach(e=>e.onclick=()=>{ invFilter=e.dataset.invf; render(); });
  document.querySelectorAll('[data-ordf]').forEach(e=>e.onclick=()=>{ ordFilter=e.dataset.ordf; render(); });
  document.querySelectorAll('[data-notif]').forEach(e=>e.onclick=()=>{
    const k=e.dataset.notif; API.setNotification(k, !API.getNotifications()[k]); render(); });

  // ---- order create bindings ----
  const sync = () => {
    if(!draft) return;
    const g = id => { const n = $(id); return n?n.value:''; };
    draft.orderRef = g('#o-ref'); draft.orderDate = g('#o-date');
    draft.buyerName = g('#o-buyer'); draft.listingUrl = g('#o-url');
    draft.shipToAddress = g('#o-addr'); if($('#o-ch')) draft.channel = $('#o-ch').value;
  };
  ['#o-ref','#o-date','#o-buyer','#o-url','#o-addr','#o-ch'].forEach(s=>{
    const n = $(s); if(n) n.oninput = n.onchange = () => { sync(); refreshRail(); };
  });

  const search = $('#o-search');
  if(search) search.oninput = () => {
    const q = search.value.trim(); const box = $('#o-results');
    if(q.length < 2){ box.innerHTML=''; return; }
    const prods = API.listProducts(); const inv = API.inventoryBySku();
    const hits = prods.map(p=>({p, s:Math.max(Rules.similarity(q,p.name), Rules.similarity(q,p.sku),
      ...(p.aliases||[]).map(a=>Rules.similarity(q,a)))}))
      .filter(h=>h.s>0.2 || h.p.name.toLowerCase().includes(q.toLowerCase()))
      .sort((a,b)=>b.s-a.s).slice(0,5);
    box.innerHTML = `<div style="border:1px solid var(--line);border-radius:6px;margin-top:6px;overflow:hidden">
      ${hits.map(h=>{ const av = inv[h.p.sku]?Rules.availableFor(inv[h.p.sku]):0;
      return `<div class="clickable" data-pick="${h.p.sku}" style="display:flex;align-items:center;gap:10px;padding:9px 11px;border-bottom:1px solid var(--line2);cursor:pointer">
        <div style="flex:1"><b style="font-size:13px">${esc(h.p.name)}</b>
          <div class="mono faint" style="font-size:11px">${esc(h.p.sku)}${(h.p.aliases||[]).length?' · aka '+esc(h.p.aliases.slice(0,2).join(', ')):''}</div></div>
        <span class="mono ${av===0?'r':(av<=5?'a':'g')}" style="font-size:11px">${av} available</span></div>`;}).join('')
      || '<div class="empty" style="padding:16px">No match — add it in Products first.</div>'}</div>`;
    box.querySelectorAll('[data-pick]').forEach(n=>n.onclick=()=>{
      sync(); draft.lines.push({ sku:n.dataset.pick, qty:1 }); search.value=''; render(); });
  };

  document.querySelectorAll('[data-lineqty]').forEach(n=>n.oninput=()=>{
    sync(); draft.lines[+n.dataset.lineqty].qty = Math.max(1, +n.value||1);
    $('#o-lines').innerHTML = renderLines(draft, API.inventoryBySku()); bind(); refreshRail(); });

  // ---- actions ----
  document.querySelectorAll('[data-act]').forEach(e=>e.onclick=()=>{
    const a = e.dataset.act;

    if(a==='add-label'){ sync(); draft.label = Rules.parseLabelStub('label-'+(draft.orderRef||'new')+'.pdf'); render();
      toast('Label attached — carrier and destination read from the PDF','ok'); }
    if(a==='rm-label'){ sync(); draft.label=null; render(); }
    if(a==='add-doc'){ sync(); draft.docs.push({filename:'document-'+(draft.docs.length+1)+'.pdf'}); render(); }
    if(a==='rm-doc'){ sync(); draft.docs.splice(+e.dataset.i,1); render(); }
    if(a==='rm-line'){ sync(); draft.lines.splice(+e.dataset.i,1); render(); }

    if(a==='submit-order'){
      sync();
      const r = API.createOrder({ ...draft });
      if(r.validation.canSubmit){ draft=null; toast('Order sent to the warehouse','ok'); navTo('order-detail', r.order.id); }
      else { toast('Fix the problems listed before submitting','err'); render(); }
    }
    if(a==='save-draft'){ sync(); toast('Draft saved'); }
    if(a==='dup-order'){ const last = API.listOrders()[0];
      draft = { ...newDraft(), buyerName:last.buyerName, channel:last.channel,
                lines: last.lines.filter(l=>l.sku).map(l=>({sku:l.sku, qty:l.qty})) };
      render(); toast('Copied from '+last.orderRef); }

    if(a==='cancel-order'){
      const r = API.transition(e.dataset.id, 'cancelled');
      toast(r.ok?'Order cancelled — stock released':r.msg, r.ok?'ok':'err'); render();
    }
    if(a==='upload-label'){
      const o = API.getOrder(e.dataset.id);
      API.updateOrder(o.id, { label: Rules.parseLabelStub('label-'+o.orderRef+'.pdf') });
      toast('Label attached — order moved to Ready','ok'); render();
    }

    if(a==='asn-save'){
      const sku = $('#a-sku').value, qty = +$('#a-qty').value;
      if(!$('#a-sup').value || !$('#a-trk').value){ toast('Supplier and tracking number are required','err'); return; }
      API.createAsn({ supplier:$('#a-sup').value, carrier:$('#a-car').value, tracking:$('#a-trk').value,
        eta:$('#a-eta').value, lines:[{ sku, qtyExpected:qty, qtyReceived:0, qtyDamaged:0 }], docs:[] });
      toast('Sent to warehouse — they\'ll match it on arrival','ok'); navTo('asns');
    }
    if(a==='asn-accept'){ toast('Variance accepted','ok'); navTo('asns'); }

    if(a==='pick-file'){
      const prods = API.listProducts(), inv = API.inventoryBySku();
      const mapping = Rules.autoMapColumns(SAMPLE_HEADERS);
      const rows = SAMPLE_ROWS.map(r=>mapRow(r, mapping));
      const results = rows.map(r=>({ row:r, ...Rules.validateImportRow(r, prods, inv) }));
      importState = { mapping, rows, results,
        counts:{ ready:results.filter(r=>r.level==='ready').length,
                 warning:results.filter(r=>r.level==='warning').length,
                 error:results.filter(r=>r.level==='error').length } };
      render();
    }
    if(a==='import-reset'){ importState=null; render(); }
    if(a==='import-run'){
      const res = API.bulkImport(importState.rows);
      toast(`Imported ${res.imported.length} orders · ${res.counts.error} held for fixing`,'ok');
      importState=null; navTo('orders');
    }
    if(a==='dl-template'){ toast('Template downloaded (stub)'); }
    if(a==='export-inv'||a==='export-orders'){ toast('Export started (stub)'); }
    if(a==='bulk-labels'){ toast('31 of 35 labels matched automatically','ok'); }

    if(a==='add-alias'){
      const sku = e.dataset.sku;
      const m = modal('Add alias for '+sku,
        `<div class="fld"><label>Alternative name</label><input id="al-in" placeholder="e.g. LaMer lipbalm .32"></div>
         <div class="note">Any spelling you've used in a spreadsheet. Future imports will resolve it automatically.</div>`,
        `<button class="btn" data-close>Cancel</button><button class="btn pri" id="al-save">Add alias</button>`);
      m.querySelector('[data-close]').onclick=()=>m.remove();
      m.querySelector('#al-save').onclick=()=>{ API.addAlias(sku, $('#al-in').value.trim()); m.remove(); render(); toast('Alias added','ok'); };
    }
    if(a==='new-product'){
      const m = modal('New product',
        `<div class="f2"><div class="fld"><label>SKU *</label><input id="p-sku"></div>
         <div class="fld"><label>Ship weight (lb)</label><input id="p-wt" type="number" step="0.1" value="0.3"></div></div>
         <div class="fld"><label>Product name *</label><input id="p-name"></div>`,
        `<button class="btn" data-close>Cancel</button><button class="btn pri" id="p-save">Create</button>`);
      m.querySelector('[data-close]').onclick=()=>m.remove();
      m.querySelector('#p-save').onclick=()=>{
        const sku=$('#p-sku').value.trim(), name=$('#p-name').value.trim();
        if(!sku||!name){ toast('SKU and name are required','err'); return; }
        API.createProduct({ sku, name, weightLb:+$('#p-wt').value||0.3 });
        m.remove(); render(); toast('Product created','ok'); };
    }
  });

  document.querySelectorAll('[data-map]').forEach(s=>s.onchange=()=>{
    importState.mapping[+s.dataset.map].target = s.value;
    importState.mapping[+s.dataset.map].state = s.value==='__ignore'?'unmapped':'matched';
    const prods = API.listProducts(), inv = API.inventoryBySku();
    importState.rows = SAMPLE_ROWS.map(r=>mapRow(r, importState.mapping));
    importState.results = importState.rows.map(r=>({ row:r, ...Rules.validateImportRow(r, prods, inv) }));
    importState.counts = { ready:importState.results.filter(r=>r.level==='ready').length,
      warning:importState.results.filter(r=>r.level==='warning').length,
      error:importState.results.filter(r=>r.level==='error').length };
    render();
  });
}

function mapRow(raw, mapping){
  const out = {};
  mapping.forEach(m=>{ if(m.target!=='__ignore') out[m.target] = raw[m.source] ?? ''; });
  out['Order Number'] = raw['Order Number'];
  return out;
}

function refreshRail(){ /* cheap re-render of validation-sensitive bits */ render(); }

/* ---------------- boot ---------------- */
document.addEventListener('DOMContentLoaded', render);
