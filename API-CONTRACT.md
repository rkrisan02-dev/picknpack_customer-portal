# Brand Portal — API Contract

Base: `/api/v1` · Auth: bearer JWT · All responses JSON.

## Golden rule: tenant scoping

**`brandId` is ALWAYS derived from the JWT. Never from the URL, query string, or body.**
If a client sends `brandId`, ignore it. Every query gets `WHERE brand_id = :sessionBrandId`.

When a record exists but belongs to another brand, return **404, not 403** — a 403 confirms
the record exists, which leaks data.

```
JWT claims: { sub: userId, brand_id, warehouse_id, role, exp }
roles: owner | orders | billing
```

| Role | Can read | Can write |
|---|---|---|
| `owner` | everything for their brand | everything |
| `orders` | products, inventory, ASNs, orders | ASNs, orders, labels |
| `billing` | invoices, billing lines | nothing |

---

## Session

### `GET /session`
```json
{ "userId":"u_1","brandId":"br_madiha","brandName":"Madiha Ecomm",
  "warehouseName":"Saqib Sohail Warehousing","role":"owner" }
```

---

## Products

### `GET /products`
```json
[{ "id":"p1","sku":"LMR-LB-032","name":"La Mer The Lip Balm 0.32oz",
   "aliases":["La Mer Lip Balm","LaMer lipbalm .32"],"weightLb":0.2 }]
```

### `POST /products`
```json
{ "sku":"LMR-LB-032", "name":"...", "weightLb":0.2, "aliases":[] }
```
`409` if SKU already exists for this brand. SKU unique per `(brand_id, sku)`, **not** globally.

### `POST /products/:id/aliases`
```json
{ "alias":"LaMer lipbalm .32" }
```
Aliases are how imports keep working — see BUSINESS-RULES §4.

---

## Inventory

### `GET /inventory`
```json
[{ "sku":"LMR-LB-032","name":"...","onHand":15,"allocated":11,
   "available":4,"inbound":200,"bin":"TPL-C1" }]
```

**`available` is computed, never stored:** `available = onHand - allocated`.
`allocated` = SUM(qty) of all order lines whose order status ∈ `{ready, picking, packing}`.

Recommended: a DB view or materialised column refreshed inside the same transaction
that changes order status. Do **not** let the client compute this for anything
authoritative — it's shown client-side only for instant feedback.

---

## Expected Receiving (ASN)

### `GET /asns` · `GET /asns/:id`
```json
{ "id":"ASN-1043","supplier":"Shenzhen Beauty","carrier":"YunExpress",
  "tracking":"YT2038471103320","eta":"2026-08-18","status":"variance",
  "lines":[{"sku":"LMR-MC-1","qtyExpected":200,"qtyReceived":194,"qtyDamaged":2}],
  "docs":[{"filename":"invoice-8801.pdf","url":"..."}],
  "notes":[{"by":"Dan Rivera","at":"2026-08-18 11:04","text":"...","photos":[...]}] }
```
`status` ∈ `in_transit | arriving | received | variance | cancelled` — **derived**, see BUSINESS-RULES §5.

### `POST /asns`
```json
{ "supplier":"...","carrier":"...","tracking":"...","eta":"2026-08-24",
  "lines":[{"sku":"LMR-LB-032","qtyExpected":200}], "docs":[] }
```
**Side effect:** creates an *expected receipt* in the warehouse system
(`Purchasing → Item Receipts`) tagged with `ownerBrandId`, and increments
`inventory.inbound`.

### `POST /asns/:id/receive` — **warehouse only, not the brand**
```json
{ "lines":[{"sku":"LMR-MC-1","qtyReceived":194,"qtyDamaged":2}],
  "note":"Carton 3 of 5 arrived opened...", "photos":["..."] }
```
Posts `qtyReceived - qtyDamaged` to `inventory.onHand`; damaged → QC hold;
decrements `inbound`; recomputes ASN status; notifies the brand if variance ≠ 0.

---

## Orders

### `GET /orders?status=&from=&to=&q=`
```json
[{ "id":"o_1","orderRef":"31-15002-44120","orderDate":"2026-08-19",
   "buyerName":"Katrina Alvarez","channel":"eBay","status":"needs_label",
   "lines":[{"sku":"LMR-LB-032","qty":1}],
   "label":null,"tracking":null,"holdReason":null }]
```

### `POST /orders`
```json
{ "orderRef":"31-15002-44121","orderDate":"2026-08-19","buyerName":"Katrina Alvarez",
  "channel":"eBay","listingUrl":"...","shipToAddress":null,
  "lines":[{"sku":"LMR-LB-032","qty":2}], "label":{...}, "docs":[] }
```
Response includes the **derived** status and any validation problems:
```json
{ "order":{...}, "validation":{ "status":"ready","canSubmit":true,"problems":[] } }
```
The server sets status by running validation — it does **not** trust a client-supplied status.

`shipToAddress` is **optional**. See BUSINESS-RULES §7 for why.

### `PATCH /orders/:id`
Only allowed while status ∈ `{draft, needs_label, held, ready}`.
Editing an order in `picking`/`packing` must return `409`.

### `POST /orders/:id/transition`
```json
{ "to":"cancelled" }
```
Brand may only set `draft | ready | cancelled`. Warehouse-only statuses
(`picking, packing, shipped, delivered`) return `403` if requested by a brand token.
Illegal transitions return `422` with the reason.

### `POST /orders/:id/label`
`multipart/form-data`, field `file`. Server extracts carrier / tracking / ship-to
from the PDF and returns:
```json
{ "filename":"label.pdf","carrier":"USPS Ground Advantage",
  "tracking":"9400 1081 0624 5921 6244 60",
  "shipTo":"KATRINA ALVAREZ · 1420 Bergen St, Brooklyn NY 11213",
  "parsed":true,"confidence":0.94 }
```
**If parsing fails, still accept the file** with `parsed:false`. Never block a
shipment because OCR failed.

### `POST /orders/bulk-import`
```json
{ "mappingId":"map_madiha_v3", "rows":[ { "...": "raw cell values" } ] }
```
```json
{ "counts":{"ready":986,"warning":27,"error":8},
  "imported":[...],
  "results":[{ "rowIndex":4,"level":"error",
               "issues":[{"level":"error","msg":"Unrecognised product \"Widget XYZ\""}],
               "suggestions":[{"sku":"LMR-LB-032","name":"...","score":0.61}] }] }
```
Error rows are **never silently dropped** — they're returned for the brand to fix.

---

## Column mapping

### `GET /import/mapping` · `PUT /import/mapping`
```json
{ "id":"map_madiha_v3",
  "columns":[{"source":"Prduct Name","target":"productName"},
             {"source":"Lable","target":"labelUrl"}] }
```
Saved per brand. First upload auto-matches and asks for confirmation; later
uploads apply silently.

---

## Billing

### `GET /billing/current`
```json
{ "period":"2026-08","lines":[{"code":"STORAGE","label":"...","amount":108.00}],
  "total":1800.80 }
```
### `GET /billing/invoices`

Charges accrue per event (see BUSINESS-RULES §8), not recomputed at month end.

---

## Reports

### `GET /reports/summary?from=&to=`
```json
{ "byStatus":{"ready":14,"picking":6,"shipped":37},
  "perDay":[12,19,11,24,31,9,6],"days":["Wed","Thu",...],
  "avgHoursToShip":33.6 }
```

---

## Webhooks (warehouse → portal)

The warehouse system pushes status changes so the brand sees them live:

```
POST {portal}/hooks/order-status
{ "orderId":"o_1","status":"picking","at":"2026-08-19T14:02:00Z","actor":"Tia N." }

POST {portal}/hooks/order-shipped
{ "orderId":"o_1","tracking":"9400...","carrier":"USPS","shippedAt":"..." }

POST {portal}/hooks/asn-received
{ "asnId":"ASN-1043","lines":[{"sku":"...","qtyReceived":194,"qtyDamaged":2}],
  "note":"...","photos":[...] }
```
Sign with HMAC-SHA256 over the raw body; reject stale timestamps (>5 min).

---

## Error format

```json
{ "error":{ "code":"INSUFFICIENT_STOCK",
            "message":"Only 4 available of La Mer The Lip Balm — you asked for 6.",
            "field":"lines[0]" } }
```

| Code | HTTP |
|---|---|
| `VALIDATION_FAILED` | 422 |
| `INSUFFICIENT_STOCK` | 422 |
| `SKU_UNRESOLVED` | 422 |
| `ILLEGAL_TRANSITION` | 422 |
| `WAREHOUSE_CONTROLLED_STATUS` | 403 |
| `NOT_FOUND` (incl. wrong tenant) | 404 |
| `ORDER_LOCKED` (in picking/packing) | 409 |
