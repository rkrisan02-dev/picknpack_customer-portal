# Brand Portal — Business Rules

Implemented in `assets/rules.js`. **Every rule must be re-enforced server-side.**
The client copy exists only for instant feedback and is not a security boundary.

---

## §1 Tenant scoping

Every query filtered by `brandId` from the JWT. Wrong-tenant reads return **404**, not 403.

```js
Rules.scope(rows, brandId)          // filter
Rules.assertOwned(entity, brandId)  // { ok:false, code:404 } on mismatch
```

A brand user must never see another brand's inventory, orders, products, or invoices —
including via guessed IDs, exports, or webhook replay.

---

## §2 Order status machine

| Status | Set by | Meaning |
|---|---|---|
| `draft` | brand | Started, not submitted |
| `needs_label` | system | Valid, but no shipping label attached |
| `held` | system | Data problem — bad SKU or insufficient stock |
| `ready` | system | Passed all checks, visible to warehouse floor |
| `picking` | **warehouse** | Picker working it |
| `packing` | **warehouse** | At the bench |
| `shipped` | **warehouse** | Left the building |
| `delivered` | **warehouse** | Carrier confirmed |
| `cancelled` | brand | Terminal |

**The brand can never set `picking`/`packing`/`shipped`/`delivered`.**
The warehouse never sets `needs_label`/`held` — those are portal validation states.

Legal transitions in `Rules.TRANSITIONS`. Anything else → `422`.
Notably `shipped → ready` is illegal; a shipped order can only go to `delivered`.

> **Why this matters:** the source workbook only ever contains *Shipped*, *Delivered*,
> *In-Transit* — all post-departure. The brand currently cannot see an order until it has
> already left. The five pre-ship statuses are the product.

---

## §3 Stock allocation — the core rule

```
available = onHand − allocated
allocated = Σ qty over orders in { ready, picking, packing }
```

- Sell against **available**, never `onHand`.
- `ready` **allocates**. `shipped` **consumes** (decrements `onHand`, releases allocation).
- `cancelled` / back to `draft` **releases** allocation.

> **Why this matters:** the workbook tracks `Total Units → Sold → Remaining`.
> "Remaining" counts stock already promised to unshipped orders. That's the
> single most common cause of overselling in dropshipping.

### Concurrency — do not skip this

Two simultaneous orders for the last unit will both pass a naive check.
Allocation must happen inside a transaction with a row lock:

```sql
BEGIN;
  SELECT on_hand, allocated FROM inventory
   WHERE brand_id=$1 AND sku=$2 FOR UPDATE;
  -- re-check availability HERE, inside the lock
  UPDATE inventory SET allocated = allocated + $3 ...;
COMMIT;
```

---

## §4 SKU resolution

Order rows carry free-text product names that drift between uploads.

Resolution order:
1. exact SKU
2. exact name (normalised)
3. known alias (normalised)
4. fuzzy ≥ `0.92` → auto-accept
5. fuzzy ≥ `0.55` → suggest, don't auto-accept
6. no match → order `held`; brand maps once; alias saved permanently

Normalisation lowercases, strips punctuation, drops stop-words (`the/a/of/for`).
Similarity = Dice coefficient on token sets.

**Verified against real data:**
```
"La Mer Lip Balm"        → LMR-LB-032  (alias, 1.00)
"LaMer lipbalm .32"      → LMR-LB-032  (alias, 1.00)
"Shiseido Vital Perfect" → SHI-VP-30   (alias, 1.00)
"Unknown Widget XYZ"     → null        (none,  0.00)  → held
```

---

## §5 ASN receiving & variance

```
good          = qtyReceived − qtyDamaged
variance      = qtyReceived − qtyExpected
postsToStock  = good
```

Only **good** units post to `onHand`. Damaged go to QC hold. Any variance is
surfaced to **both** the brand and the warehouse immediately, with the
warehouse's note and photos attached.

Derived ASN status:
- nothing received + ETA > 2 days → `in_transit`
- nothing received + ETA ≤ 2 days → `arriving`
- received with variance or damage → `variance`
- all lines fully received, no variance → `received`

---

## §6 Import validation

Rows are bucketed, **never silently dropped**:

| Bucket | Trigger | Outcome |
|---|---|---|
| `ready` | all checks pass | imports normally |
| `warning` | no label, or stock short | imports, flagged |
| `error` | missing ref/buyer/qty, unresolved SKU | held back, listed for fixing |

### Header auto-mapping

Verified against the real misspelled headers in the customer workbook:

```
'order date '    → orderDate     [matched]
'Order Number'   → orderRef      [matched]
'Prduct Name'    → productName   [matched]   ← misspelled in source
'Customer Name ' → buyerName     [matched]   ← trailing space
'Lable'          → labelUrl      [matched]   ← misspelled in source
'Trackings'      → tracking      [matched]   ← plural in source
'Remaning'       → __ignore      [unmapped]  ← inventory col, correctly skipped
```

Mapping is saved per brand after first confirmation.

---

## §7 Labels are the source of truth for destination

**Finding:** across all 35 tabs of the customer workbook there is **no shipping
address column**. Only `Customer Name`. The address exists solely inside the
label PDF. Several buyers read `eIS C/O …` (eBay International Shipping) —
meaning the parcel ships to eBay's hub, *not* to the named person.

**Consequences:**
- `shipToAddress` is **optional** on order creation.
- A label is **required** before an order can reach `ready`.
- The system parses the label and displays carrier / tracking / destination as
  confirmation.
- If parsing fails, **accept the file anyway** and leave fields blank. Never
  block a shipment on OCR.

Requiring a typed address would break how every existing brand works and
wouldn't even be authoritative.

---

## §8 Billing accrual

Charges post per event as work happens — not reconstructed monthly.

| Event | Charge |
|---|---|
| Order packed | `pickPackPerOrder` + (lines × `pickPackPerLine`) + `labelPrint` |
| ASN received | units × `receivingPerUnit` |
| Nightly | pallets × `storagePerPalletMonth` ÷ days-in-month |
| Shipment | freight cost × (1 + `freightMarkupPct`/100) |

Rate card is **per brand** — contract terms differ per client. Version rate
cards so changing a rate doesn't rewrite last month's invoice.

---

## §9 Validation precedence

When several problems exist at once:

```
held  >  needs_label  >  ready
```

`held` (data problem) outranks `needs_label` (missing asset), because a held
order can't be fixed by uploading a PDF — the brand must fix the data first.
