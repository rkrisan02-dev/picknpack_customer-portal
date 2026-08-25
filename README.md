# Pick n Pack — Brand Portal

A complete, working prototype of the brand-facing customer portal that sits on top of
the Pick n Pack warehouse system.

**Run it:** open `index.html` in a browser. No build step, no server, no dependencies.

---

## What this is

A functioning reference implementation your team copies from — not a mockup.
Every screen works, every business rule executes, and the data layer mirrors the
real API contract 1:1 so swapping in `fetch()` calls leaves the UI untouched.

```
index.html              app shell
assets/
  app.css               design system — port tokens into your framework theme
  rules.js  ★           BUSINESS RULES ENGINE — start here
  data.js               mock API, one function per REST endpoint
  app.js                page components + router + event binding
docs/
  API-CONTRACT.md       endpoint spec for the backend team
  BUSINESS-RULES.md     the rules, with the reasoning behind each
screenshots/            rendered proof of every page
```

---

## Read in this order

1. **`docs/BUSINESS-RULES.md`** — the logic and *why* each rule exists
2. **`assets/rules.js`** — that logic as executable code
3. **`docs/API-CONTRACT.md`** — what the backend must expose
4. **`assets/app.js`** — UI components, one `page*()` function per screen

---

## Screens (16)

| Screen | Function in `app.js` |
|---|---|
| Dashboard | `pageDashboard()` |
| Reports / end-of-day | `pageReports()` |
| Expected Receiving — list | `pageAsns()` |
| Expected Receiving — create | `pageAsnNew()` |
| ASN detail + variance | `pageAsnDetail()` |
| Inventory | `pageInventory()` |
| Orders — list | `pageOrders()` |
| **Order — create** | `pageOrderNew()` |
| Order — detail | `pageOrderDetail()` |
| Bulk upload + column mapping | `pageImport()` |
| Products / SKU aliases | `pageProducts()` |
| Labels & documents | `pageLabels()` |
| Channels | `pageChannels()` |
| Billing | `pageBilling()` |
| Settings / users | `pageSettings()` |
| Login | see wireframes |

---

## Build order (recommended)

**Phase 1 — must ship together, or the portal doesn't work**

1. Auth + tenant scoping (§1) — *do this first, retrofitting is painful*
2. Products + aliases (§4)
3. Inventory with `available = onHand − allocated` (§3)
4. Expected Receiving + warehouse receive hook (§5)
5. Orders + status machine (§2) + validation (§9)
6. Label upload & parse (§7)
7. CSV/XLSX import + saved mapping (§6)

**Phase 2**

8. Billing accrual (§8)
9. Reports
10. Channel APIs — eBay, Amazon, Walmart, TikTok
11. Returns / RMA

---

## What was verified

Automated tests confirm, against real data patterns from the customer workbook:

- Submit is **blocked** until a label is attached, then **enabled**
- Creating an order **allocates** stock; `available` drops correctly
- Requesting 9,999 units → order goes to `held`, `canSubmit:false`
- `"La Mer Lip Balm"`, `"LaMer lipbalm .32"`, `"Shiseido Vital Perfect"` all resolve to the right SKU
- `"Unknown Widget XYZ"` → unresolved → held
- Misspelled headers `Prduct Name`, `Lable`, `Trackings` all auto-map
- `Remaning` (an inventory column) correctly ignored in an order import
- `shipped → ready` rejected by the status machine
- `Rules.canBrandSet('shipped')` → `false`
- Import buckets 5 sample rows into ready / warning / error correctly
- Zero JS errors across all 11 nav destinations

---

## Known stubs — replace before production

| Stub | Location | Replace with |
|---|---|---|
| Label parsing | `Rules.parseLabelStub()` | server-side PDF text extraction + OCR fallback |
| File upload | `data-act="add-label"` | real multipart upload to object storage |
| XLSX parsing | `SAMPLE_HEADERS` / `SAMPLE_ROWS` | SheetJS on real file input |
| Export CSV | `export-*` actions | real generation |
| Auth | `DB.SESSION` constant | JWT from your identity provider |
| Persistence | in-memory arrays | your database |

---

## Two things to decide before building

1. **Who buys the label?** Right now brands generate them in eBay/Amazon and upload PDFs.
   If the warehouse buys postage instead, the "upload label" action becomes "buy label"
   and the flow changes materially.

2. **Multi-SKU ASNs.** The prototype models one SKU per ASN. If suppliers ship mixed
   cartons, `pageAsnNew()` needs a line-item table and `POST /asns` takes multiple lines
   (the schema already supports it — the UI doesn't yet).
