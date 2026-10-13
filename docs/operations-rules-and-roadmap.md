# OneBite operating rules and delivery roadmap

Reviewed 13 October 2026 (Asia/Phnom_Penh). Baseline: repository commit `9c6ac48`.

This document compares the checked-in implementation with established restaurant-software patterns and defines the next delivery stages. It does not certify the currently deployed database or hosting configuration: no live transactions or database changes were made for this review.

**Decision hierarchy:** confirmed OneBite requirements take priority over vendor conventions. Rules labelled **Confirmed** already come from the Owner's decisions. **Recommended** rules are proposals for implementation, and **Open** decisions require an answer before dependent behavior ships. Existing UI, core helpers and permission names do not establish a working business workflow.

## What to learn from established products

| Reference | Useful pattern | How OneBite should adapt it |
| --- | --- | --- |
| [Square restaurant POS][square] | Photo-based quick-service ordering, configurable menus, connected orders and operational reporting | Keep ordinary ordering fast; use the existing menu/cart layout and item popup. Show site/day/shift results once real invoices exist. |
| [Toast cash management][toast] | Separate permissions for cash actions, attributable custody and shift/closing review | Track the cash holder rather than a physical drawer; use distinct confirmations and reconcile pending operations before handover. |
| [Lightspeed recipes][lightspeed] | Recipe ingredients, units/conversions, made-to-order versus batch workflows and ingredient updates | Keep our unified item catalog and recursive recipes. Deduct underlying materials on completed orders; do not introduce prepared-item balances. |
| [Restaurant365 variance reporting][r365] | Compare sales-based theoretical consumption with physical counts, receiving and transfers; expose variance details | Build quantity reconciliation first. Add monetary food-cost and margin reports after reliable supplier costs and a valuation method exist. |

These sources describe particular products, editions and workflows, not universal standards or promises about Cambodia payment support. Recommendations below are OneBite-specific design choices. Do not copy vendor refund, stock-blocking, hardware or payment-verification behavior over our confirmed rules.

## Implementation comparison

Status means inspected source code and migrations, not a new production acceptance test.

| Area | What exists now | What is missing | Priority |
| --- | --- | --- | --- |
| Identity and Admin | Username/PIN, seven-day sessions, Owner verification, users, roles, module/action grants, site assignments, photos, settings and activity history | Continue negative authorization checks for every new action; recover lost Owner verification safely | Maintain |
| Catalog | One item ID; type/category/sellability; categories/UOM; per-item conversions; dated recipes and immutable versions | Sauce choices, photo instructions, site availability/price overrides, actual yield observations | High |
| POS ordering | Real menu; mobile/desktop cart; item popup; quantity/remarks; hold/resume/cancel; locally durable snapshots | Shared staff draft access and ownership/transfer policy; authorized ordering device; modifiers | High |
| Discounts/free items | Legacy calculation helpers and disabled popup discount controls | Unified-catalog rule schema, Owner editors, API validation, reservations and consumption ledger | High |
| Sales/payments | Rounding and exchange-rate preview; explicit checkout gate | Persisted invoices, manual QR/cash allocations, review/finalize, free completion, history | Critical |
| Shifts/cash | Planned screens, calculator and permission identifiers | Active shared shift, opening cash, additions/withdrawals, custody and two-party handover | Critical |
| Inventory operations | Catalog publishing with encrypted SQLite outbox | Stockroom/site movements, balances, opening stock, receiving, requests, partial dispatch, receipt differences, counts/waste | Critical |
| Offline POS | Cached authorized menu; account/site/device-local drafts; stale-tab rejection | Financial outbox, ordered replay, device authority, allowance accounting, conflict review | Critical |
| Reporting | Admin activity logs | Sales/shift/cash/stock reports with drill-down and completeness indicators | After ledger |
| Attendance | Geofence defaults configured: 100 m radius, 50 m acceptable GPS accuracy | Installable operational app, attendance records, validation, exceptions and corrections | Later |

Evidence: `apps/pos/src/{App,ItemSettings,useWorkspace,usePos}.tsx/ts`, `packages/core/src/{pos,inventory,domain,access}.ts`, `apps/inventory/src/{InventoryApp,useCatalog}.tsx/ts`, `supabase/functions/{admin-access,inventory-access,pos-access}`, and associated migrations. In particular, `pos-access` currently accepts only bootstrap and photo reads. POS refresh downloads authorized menu data; it does not upload draft carts or reconcile business transactions. Inventory's publishing queue is not yet a stock-movement queue. The legacy discount model uses separate product/config types and hardcoded sauce concepts; it must be adapted and validated rather than connected directly to the unified catalog.

**Release boundary:** the current POS must not be used as the record of live sales. A functioning item-settings popup is not a payment, stock or cash ledger.

## Build progress

The first stage-1 slice is implemented: shared immutable operations, dependency-aware replay and encrypted atomic SQLite projection/outbox storage. See [transaction foundation](transaction-foundation.md) for guarantees, verification and integration limits. The next slice now connects central opening/receiving to the deployed private ledger/API and Inventory UI; see [central stock](central-stock.md) for permissions and verification limits. The wider financial/stock workflows remain phased, and POS checkout is still gated.

## Operating rules

### 1. People, authorization and site control

**Confirmed**

- People use their own username and generated six-digit PIN. PIN creation/reset offers regenerate/copy, not manual PIN entry. Staff do not need an authenticator; Owners do. Remembered sign-in lasts seven days without inactivity logout.
- Module access and individual action permissions are separate. Assigned sites further restrict access. Owner-only catalog/rule/price administration cannot be delegated merely by granting an action to another role.
- One active ordering POS per site. Other devices can use permitted non-ordering functions. One shared active shift per site; every action records the actual staff actor.
- New records default active. Hide active on creation; confirm changes on edit. Archive referenced records instead of deleting history.

**Recommended**

- Treat “Stock controller” as an Owner-configured operational role with explicit inventory permissions; do not silently add privileges to Cashiers or Supervisors.
- Authorize each API operation using the server's account, current grants, site membership and device registration. Browser visibility is not authorization. A retained session is not unrestricted access.
- A second staff member confirms under their own authenticated identity. Two checkboxes in the first user's session are insufficient. Confirmation must bind actor, amount, operation and version.
- Device activation/transfer is online. Normal transfer syncs and releases the old device first. Owner emergency recovery preserves an incident record, revokes its authority and quarantines late events for review; it cannot guarantee recovery of a lost device's unsynced data.

### 2. Catalog, recipes and menu configuration

**Confirmed**

- One item database. Type: finished good/raw material/supplies/component. Category and can-sell are independent. Configured categories include Main/Side/Ready to cook/Drinks. Sizes are separate sellable items.
- Recipe sections: Ingredients, Items in the box, Packaging used. Components expand recursively to stocked underlying inputs. No separately counted prepared-product stock.
- Owner defines conversions and actual recipe quantities. Preserve historical units and conversions. Recipe changes use Cambodia effective times and affect new orders only.
- All sites inherit active sellable items and master KHR prices unless Owner sets exclusions or site overrides.
- Cooking oil is excluded from sellable recipes and automatic sale consumption. Actual ingredient amounts are Owner-configured, not inferred from planning examples.
- Required sauces have configurable eligible choices/defaults. Extra sauce choice, price and quantity are configured per item. Discount bases include modifier charges; a free item includes every selected extra.

**Recommended**

- Lock catalog, site prices, recipes, selected modifiers, conversions, rate and applicable rule versions when an order starts. Our current first-item timestamp is the implementation boundary. Held orders retain the snapshot; new configuration does not reprice old orders.
- Reserve a separate, auditable eligibility check for time-limited promotions at completion; do not silently modify a held order's calculated price.
- Block invalid/cyclic/missing recipes and missing conversions before publishing or creating an order. A valid recipe with insufficient stock warns rather than blocks.
- Mass-to-volume conversion requires an explicit item-specific ratio. A 3 g sauce portion cannot consume 3 ml merely because receiving uses liters. Weight-to-count meatball conversions also need measured ratios.
- Yield observations record batch reference, expected/actual output, operator and reason. They do not rewrite recipes or deduct the same inputs again. In this sale-depletion model, confirmed discarded materials use a linked waste movement; batch records are observations until another accounting model is explicitly approved.

### 3. Cart and invoice lifecycle

**Confirmed**

- Start blank; persist before holding/opening another cart. Opening held carts first holds the nonempty current cart. Empty carts are not held. Failed writes must not clear the cart.
- Quantity applies to prices, fixed discounts, allowances and ingredient consumption. Remarks survive edits and reloads.
- Cancel unpaid orders only, with a reason. No paid cancellation or refund, regardless of role. Retain cancellation history.

**Recommended**

- Keep business status separate from sync status. Business: Draft/Held/Completed paid/Completed free/Cancelled. Sync: Local/Pending/Sending/Acknowledged/Needs review. A valid completed offline order remains completed locally while awaiting acknowledgment.
- Final review shows selected options, quantities, effective discounts, rounding, payment allocation and total. One durable finalization operation freezes the invoice; repeated taps/retries return the same result.
- Preserve invoice UUIDs across devices; assign human-readable references without collisions. Financial lines keep actual name/price/recipe/rule/rate snapshots, not pointers whose later edits change history.
- Unpaid carts do not deduct stock. Completing either paid or free orders deducts stock exactly once.
- Do not allow a new account to silently adopt another user's local carts/outbox. Shared-shift draft access requires explicit transfer and attribution rules.

### 4. Prices, discounts and complimentary allowance

**Confirmed**

- Authoritative prices are KHR; Owner sets KHR per USD (currently 4,000). Record total KHR equivalent, not tender/change currency breakdown. Round the invoice total to KHR 100 and expose the adjustment. Current code uses nearest 100, half upward; retain as the implementation baseline pending the open decision below.
- Item discount mode is percentage or fixed KHR per quantity. Receipt discount is percentage only. Use the larger applicable monetary item/receipt discount, never stack; cap it by the item's configured limits. No override.
- Owner can set percentage and fixed caps; both constrain discounts when both are configured. Free selection is a separate allowance decision, not a 100% discount workaround.
- Complimentary pools are per site/day/period and consume base units. A small dumpling box consumes five dumplings; a large one consumes ten, multiplied by quantity. Shared pools and eligible items are Owner-defined. Insufficient allowance blocks the entire requested free quantity.
- Cancellation/removal releases unpaid reservations. Held/resumed carts do not reserve again. Completed free items permanently consume the allowance and all recipe inputs.

**Recommended**

- Store money as integers/fixed precision and quantities/conversions as precise decimals. Define intermediate discount rounding once in shared core and validate it server-side. Round only the final invoice to 100 KHR.
- An absent cap must be represented distinctly from an explicit zero cap. Until a published rule exists, non-zero discounts stay unavailable; do not infer unlimited permission from null or the UI mode selector.
- Daily allowance boundaries are midnight Asia/Phnom_Penh. A held free cart crossing midnight/expiry requires eligibility revalidation and an explicit cashier decision; no silent paid conversion or second reservation. Record the pool day on reservations.
- If a valid low-value paid order rounds to zero, distinguish it from a complimentary order. Do not allow rounding alone to bypass free-allowance rules; decide this edge case before finalization ships.

### 5. Payment recording and cash custody

**Confirmed**

- Cash and manually recorded QR Payment (ABA/Bakong KHQR). Optional private reference photo. This is staff recording, not bank verification.
- Owner controls split Cash/QR payments. Allocations sum to the rounded invoice total. Only Cash allocation changes physical cash. Fully complimentary orders need no payment method.
- Expected cash = opening cash + cash sales + cash supplied − withdrawals/collections. Do not count QR as physical cash.
- Opening cash comes from Supervisor/Owner supply or linked prior-shift custody. Prior-day cash is not counted again as new supply.
- Remaining cash goes to the next shift with both parties confirming actual KHR-equivalent balance. Record actual-minus-expected difference. With no next shift, retain named custody overnight or collect it.
- Supervisor/Owner withdrawal/collection requires their confirmation and the cash holder's confirmation. Withdrawals and handovers are online after pending operations reconcile.

**Recommended**

- Shift close freezes a reconciliation checkpoint, not the existence of cash. Custody continues independently until handed over/collected.
- Prevent concurrent shifts per site and concurrent transfers of the same cash custody. A changed amount invalidates previous confirmations.
- In-flight handover uses a frozen ledger sequence; block conflicting cash movements until completed or explicitly cancelled. If connectivity fails, keep the last confirmed custodian responsible.
- QR evidence may be attached later without changing invoice/payment amounts. Use recorded-by-staff wording; only a future verified bank integration can claim bank-confirmed receipt.
- Paid-entry mistakes go to an Owner incident queue. Keep the original invoice; do not introduce a disguised refund/cancellation through a correction screen. Decide the accounting treatment before providing financial corrections.

### 6. Stockroom, transfers, counts and waste

**Confirmed**

- One central stockroom serves sites. Cashier/Supervisor requests actual raw materials; controller/Owner counts dispatch; Cashier/Supervisor independently counts receipt at their site.
- Partial dispatch leaves the remainder open. Actual receipt differing from dispatch posts actual received quantity and flags the difference for controller/Owner resolution.
- Requester cancels only before any dispatch. Controller/Owner may close undispatched remainder. Posted dispatches/receipts retain history and use linked corrections.
- Both sales and counted central dispatch may proceed below recorded stock with warnings and review flags. Preserve negative balances.
- Cashier/Supervisor records waste/counts at assigned sites. Waste deducts immediately; count variance adjusts immediately and is flagged for review.
- Offline receiver may enter dispatch reference and actual received items manually; save on device and sync on reconnect.

**Recommended**

- Use an append-only stock ledger: opening stock, central receipt, dispatch, site receipt, sale consumption, waste, count adjustment and linked correction. Balances are derived/rebuildable from movements.
- Dispatch reduces central available stock and creates in-transit stock. Receipt reduces transit by the amount physically accepted and increases site stock. A short delivery retains unresolved transit until resolution; an excess requires an explicit unmatched/source adjustment. Never pretend both counts matched.
- Offline unmatched receipts remain visible as locally counted provisional site stock. Resolve their dispatch/reference mapping once online, without deducting central stock twice. Flag duplicate/unknown references and preserve the original counts.
- Keep requested/dispatched/received/remaining quantities separate. Check over-dispatch and duplicate receipt atomically; sync status is separate from request/delivery status.
- A count adjustment captures expected balance, physical count, variance and cutoff. Replay that variance rather than setting a later server balance to an old physical count. Surface missing earlier movements/late arrivals for review.
- Start daily high-value/perishable spot counts and a weekly full count as an operational proposal. Use evidence and staff capacity to tune frequency.
- Track theoretical recipe usage, recorded waste and unexplained count variance separately. Do not label recipe estimates as physical truth or invent monetary margins without costs.

### 7. Offline, sync and recovery

**Confirmed**

- Supabase is central authority; SQLite persists offline data. Admin remains saved-data-only offline. Inventory catalog edits already have their own queue. New sign-in and sensitive online-only actions require connectivity.
- POS operational authorization is limited to 24 hours since the last complete authoritative sync, within session expiry. A seven-day login is not seven days of offline trading.
- Pending operations remain on device across interruption and reconnect; retries must not duplicate business effects.

**Recommended**

- Persist the business change and outbox event atomically before success. Bind stable operation ID/payload hash to actor/site/device/shift, dependency IDs and snapshot version. Financial and stock posting is one server transaction with an immutable replay receipt.
- A server commit followed by a lost response must be recoverable by retrying the same ID. Same ID/different payload is an error. Retrying an old completed event must never create a new sale or require re-entry as a new invoice.
- Enforce device authority at event creation and review revocations/transfers on replay. Legitimate offline events that conflict with newer policy require a visible Owner review path, not silent data loss.
- Refresh the full authorized state and reconcile acknowledgments before extending the 24-hour window. Clock rollback must not extend it; suspicious time requires online verification. Deadline expiry blocks new business posting while preserving saved events for recovery.
- Never describe browser storage as guaranteed backup. Show storage failures, request persistent storage when supported, document lost-device limits, and provide an Owner-authorized recovery/export path. Signing out must not erase unacknowledged financial events.
- Show connectivity, transaction pending count, last completed sync and business exceptions separately. Current POS pending count must not imply uploaded carts. Reports disclose site/device freshness and incomplete periods.
- App updates must preserve old queues, defer incompatible changes while operations are pending, and retain a review/migration path for older payloads.

### 8. Attendance, reports and UX

**Confirmed**

- Four separately installable apps with shared components, Khmer/English, Google Sans, responsive layouts, haptics where supported and reduced-motion support. Preserve current POS navigation and compact item popup.
- Attendance geofence defaults: 100 m and GPS accuracy within 50 m. App defaults: Khmer, light, KHR, Cash. Individual language/theme preferences override defaults.

**Recommended**

- Attendance is its own employee event history, independent of the site's shared cash shift. Permission and site assignment govern check-in/out. Missing coordinates or poor GPS cannot silently pass geofence validation.
- Attendance offline capture, site switching, breaks, late entries and correction approval remain open design decisions; do not impose POS's 24-hour rules automatically.
- Reports: site/day/shift sales, payment allocations, discounts/free base units, cash variance/custody, dispatch/receipt differences, negative stock and count variance. Drill down to immutable source events; CSV export requires a reporting permission.
- Dashboard priority is unresolved work: unsynced events, handover waiting, receipt difference, negative stock, failed publication. Show only operationally available features; unavailable actions stay disabled with a short explanation.
- Keep large touch targets, keyboard access, clear status contrast and explicit confirmation for irreversible actions. Quantity presets and +/- controls retain their current compact shared design.

## Delivery sequence and acceptance gates

No duration estimate is promised without sizing the backend and offline edge cases. Build each stage into a reviewable release; POS live finalization remains locked until the pilot gate.

| Stage | Deliverable | Completion evidence |
| --- | --- | --- |
| 0. Agree operating decisions | Resolve the blocking decisions below; name Stock controller role and responsibilities; reconcile old documents | Decision log names chosen policy and affected tests; no production seed data |
| 1. Durable operational foundation | Transaction outbox, idempotent processing, private ledger boundaries, event IDs, audit metadata and recovery state; minimal opening/receiving stock | Offline restart, lost acknowledgment, duplicate/different payload, concurrent writes, account/site isolation, failed storage and queue preservation |
| 2. Device, shared shift and custody | Online ordering-device claim/transfer; one site shift; startup/carry-forward, cash additions, withdrawals, independent confirmations and handover | Concurrent claim/shift denied; distinct parties enforced; carry-forward counted once; pending replay precedes cash checkpoint; recovery scenario reviewed |
| 3. Complete POS and linked stock | Site prices/menu, modifier recipes, Owner caps/pools, allowance reservations, manual Cash/QR/split/free completion, immutable invoices and once-only stock/cash posting | Example orders calculate correctly; limits cannot be overridden; shortage warns; cancelled unpaid cart releases only reservations; completed sale cannot be refunded/cancelled; replay changes ledgers once |
| 4. Stock replenishment and control | Requests, partial dispatch, actual receipt, transit/differences, offline manual reference, linked corrections, waste/counts and yield observations | Independent quantities preserved; partial remainder stays open; excess/short receipt flagged; pending count doesn't reset later stock; no batch/sale double deduction |
| 5. One-site pilot and reporting | Source-linked sales/cash/stock reports, staff training, device-loss/update/recovery drill, one-site observation then three-site rollout | Real totals reconcile to cash counts and bank evidence; report freshness clear; no missing/duplicate events; Owner signs off discrepancies before expansion |
| 6. Attendance and optimization | Defined check-in/out workflow, GPS exceptions, correction review; later purchasing/costing/expiry and reorder guidance | Attendance authorization tested; costs have documented basis; alerts use reconciled stock; separate PWA install verified |

Stage 3 depends on the stock-ledger foundation, but does not need the full request workflow to ship to pilot: opening stock and central/site receiving must be usable. Do not operate live sales with only catalog data. Stage 5 starts after the replenishment/count controls are usable.

### Required calculation and recovery examples

- Two boxes at KHR 5,000 plus KHR 500 extras each: gross KHR 11,000. A KHR 500 per-box discount gives KHR 1,000 total discount. A 15% receipt discount would give KHR 825 per box, but a configured 10% item cap limits each to KHR 550. Final net KHR 9,900; receipt and item discounts do not stack.
- One small free dumpling box reserves five units; quantity two reserves ten. Holding/reopening changes nothing. Cancelling releases ten. Completion consumes ten and deducts the complete chosen recipe including packaging/sauce once.
- Opening cash KHR 20,000 + Cash allocation KHR 50,000 + supply KHR 10,000 − collection KHR 30,000 = expected KHR 50,000. Actual KHR 49,500 means a KHR −500 discrepancy. QR receipts are excluded. Next custody starts at confirmed actual KHR 49,500, not the expected amount.
- Dispatch 100 wrappers; receive 95: central −100, site +95, remaining transit 5 pending resolution. Recorded loss closes those five through an explicit movement. A retry does not dispatch or receive again.
- Count expected 100, actual 90 gives −10 adjustment. A later receipt of 20 must remain: syncing the count cannot reset the final balance to 90.
- Offline sale committed centrally but acknowledgment lost: repeat the same operation ID; invoice count, cash contribution, allowance use and ingredient deductions each remain one.
- Scheduled recipe published for tomorrow: an existing held cart retains its old snapshot; a new cart after the Cambodia effective timestamp uses the new recipe. Clock/timezone differences must not change this result.

Use these as test fixtures only, never production sample data.

## Open decisions before dependent implementation

1. **Zero-rounded orders and rounding:** retain nearest KHR 100, half upward? How should a non-complimentary positive order rounding to zero complete? Recommendation: prevent this edge case through validated price/discount configuration until an explicit zero-settlement policy exists.
2. **Cash held within a shared shift:** one named custodian or multiple holders? Recommendation: one named custodian at a time, with both staff individually attributed to sales; confirm any mid-shift custody transfer.
3. **Drafts between staff:** should another assigned staff member resume held carts on the same authorized POS? Recommendation: yes through an explicit shared-shift transfer, preserving creator/editor attribution and allowance reservation IDs. This is not supported by today's account-private draft storage.
4. **Offline recipe/rule changes:** retain authorized snapshots for already-started orders; expired complimentary selection must be reviewed explicitly. Confirm how long held orders stay eligible and whether rules effective after order start require review.
5. **Receiving policy:** can deliveries exceed a request, and who establishes opening stock? Recommendation: controller/Owner may record an actual excess with a review flag; opening stock is Owner-approved, never fabricated as a sale or supplier receipt.
6. **Paid-entry mistakes:** no refunds/cancellations remains confirmed. Define the permitted Owner accounting incident-resolution procedure; it must not rewrite paid invoices.
7. **Attendance:** check-in/out offline? Breaks? Overnight work? Missing GPS/site coordinates? Who approves correction? Keep attendance separate until these are answered.
8. **Later finance/food safety:** confirm tax-inclusive pricing and any required invoice fields with local accounting guidance; decide costing method, expiry/batch traceability and supplier purchasing before monetary margin/expiry reports ship. No tax rate or legal requirement is inferred here.

## Maintenance rule

This file is the consolidated comparison/roadmap; `product-plan.md` and `menu-plan.md` retain confirmed decisions, while `pos-build.md` and `unified-item-catalog.md` describe implemented scope. When a milestone ships, update its actual boundary, acceptance evidence and deployment status. Do not mark a workflow complete from its design, helper function or button alone.

[square]: https://squareup.com/us/en/point-of-sale/restaurants
[toast]: https://support.toasttab.com/en/article/Cash-Management-Overview?lang=en_US
[lightspeed]: https://o-series-support.lightspeedhq.com/hc/en-us/articles/31329433997339-Creating-Recipes-Made-to-Order-Batches
[r365]: https://docs.restaurant365.com/docs/theoretical-vs-actual-report
