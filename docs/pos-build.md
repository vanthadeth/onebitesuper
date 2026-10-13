# POS adaptation and build stages

## Source reviewed

Previous project: **OneBite POS**, chat **Tailor OneBite app requirements**.
Code reference: `vanthadeth/onebite`, commit `200f85fbf1ddc8663a9ef43762a2f5b45ddadd81`.
Reviewed `dist/app.js`, `dist/item-options.js`, and `dist/shift-transfer.js`.

The previous app is a browser-local prototype. Its layout and interactions are useful references; its sample users, PINs, menu, stock balances and browser-only payment records are not production data.

| Previous flow | Adaptation |
|---|---|
| Site menu, search, categories | Real unified Inventory catalog, effective versions, shared horizontal category labels |
| Basket and quantity controls | Mobile bottom cart bar and sheet, desktop cart panel, durable SQLite writes |
| New/held/open cart | Start blank; hold nonblank; opening Carts holds the current nonblank draft first |
| Item price/recipe references | Immutable snapshots at first item; held carts keep those prices and recipes |
| Held-order cancellation | Required reason, retained locally with the cancelled draft |
| Mixed-currency cash entry | Calculator returning total equivalent KHR using Admin exchange rate |
| Sample login and handover PINs | Shared server-validated individual account/session; Owner verification only |
| Local checkout and stock update | Replace with transactional, idempotent server posting in a later stage |

## Stage 1 — menu and draft workspace (implemented)

- Shared seven-day sign-in, app PIN keypad, Owner verification, current POS permissions and assigned active sites.
- A private `pos-access` Edge Function and service-only `onebite_pos_api` RPC. POS menu access does not require Inventory permission.
- Uses published catalog versions. Scheduled updates do not appear early. Only active, sellable items appear; any classified type can be sellable.
- Search, category labels, item photos when present, quantity and remove controls, cart notes, hold/open and reasoned cancellation.
- First item locks the full available recipe-version graph. Later cart items use that same snapshot; items introduced after the cart began require a fresh cart.
- Totals round to KHR 100; USD preview and cash calculator use the Admin exchange rate.
- Encrypted SQLite backed by IndexedDB persists current, held and cancelled drafts atomically, separately for each account and site. Actor-bound encryption keys let a user recover drafts after session renewal.
- Revision checks reject stale writes from another tab instead of overwriting saved carts.
- Cached menu/authorization can be used for 24 hours offline, within the fixed session expiry. Online permission denial never falls back to cached authorization. Access expiry blocks further draft use but retains saved drafts.
- Current shared app bar, toast section, profile, Hub in the profile menu, mobile bottom cart bar and sheet, native keyboard support, haptics and reduced-motion behavior.

**Operational boundary:** drafts stay on the creating account/device. They are not uploaded or transferred between staff yet. Refresh synchronizes the menu, not draft transactions. No invoice, payment, free allowance or sale-related stock movement is posted. The Stage 2 foundation below now records device registration, shifts and opening/retained cash. The UI labels this stage and gates checkout. It must not be used to record live sales yet. No mock items were added to Supabase.

## Stage 2 — device activation, shifts and cash custody (foundation implemented)

Implemented device registration/release, one shared shift, online authorized opening cash, close-and-retain custody, discrepancy history and idempotent retries. See [POS device and shift foundation](pos-devices-and-shifts.md) for the exact boundary. Staff-to-staff handovers, collections, withdrawals and lost-device recovery remain gated. This is not ready for live sales.

Full Stage 2 scope:

1. Register and claim one ordering POS device per site online; other devices get non-ordering views. Transfer must sync and release the previous device, with an explicit Owner recovery flow.
2. One shared shift per site, server constraints and event history; startup cash from Supervisor/Owner or held prior-day cash.
3. Count total KHR equivalent with the shared calculator, withdrawals/collections by Supervisor/Owner, discrepancies retained.
4. Outgoing and incoming staff independently authenticate/confirm actual cash; no shared/demo PIN checks. Without a next shift, retain custody until the following day or collection.
5. Durable ordered operation outbox, stable IDs, actor/site/device binding, server authorization and idempotent replay; surface conflicts without losing local operations.

## Stage 3 — configured order options, payments and stock posting

- Configurable required sauce/default/eligible choices and quantities/prices for extras, linked to recipe inputs; do not hardcode sauce lists into the product model.
- Site sellability and optional site prices; inherit the master menu and price by default.
- Owner item %/fixed caps, receipt % cap using the greater applicable discount rather than stacking, and hard complimentary allowances counted by base units/shared group/site/day/period. Entire free item includes extras. Block insufficient allowance, restore when unpaid cart is cancelled.
- Cash and recorded QR; optional private QR photo. Owner-controlled split-payment rule and zero-total completion without a payment method. No refunds or cancellation of paid invoices.
- Frozen order/recipe/rate/rule snapshots and server validation, atomic order+payment+cash+raw-material ledger posting. Sale under stock is allowed with a recorded warning. Cart snapshots are a preview foundation, not the authoritative stock ledger.
- Offline reservations and replay respect one ordering device and the 24-hour authorization ceiling.

## Stage 4 — sales history and reports

Shared shift/site order views, completed invoice details, currency-equivalent totals, QR references and export. Historical records retain the actual snapshots used at sale.

## Validation

`packages/core/src/pos.test.ts`: effective menu, snapshots, hold/open/cancel, rounding and currency calculations.
`supabase/functions/pos-access/index.test.ts`: key/session/origin/body validation, trusted RPC arguments and private-photo authorization.
`supabase/pos-workspace.verify.sql`: service-only RPC, independent POS module permission, assigned sites, revocation and Owner verification. Fixtures roll back.
`tests/pos.spec.ts`: phone/desktop sign-in, menu filters, carts, payment gate, offline/reload, price lock, site isolation, cash calculator, revocation and stale-tab protection. Fixtures are test-only.
