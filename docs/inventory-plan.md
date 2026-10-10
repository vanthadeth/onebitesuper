# Inventory — working plan

Updated: 2026-10-10. Milestone 1 implements the separate Inventory catalog app, materials and sellable items, Owner editing, private photos, and SQLite offline sync. Recipes, site overrides, stock movements and sale deductions remain planned. Confirmed requirements and recommendations are separated below. Existing menu prices remain planning/mock values where specified in `menu-plan.md`.

## Confirmed requirements

- Reuse OneBite's current UI/UX and shared components. Inventory remains a separately installable app, as established in the overall product scope.
- Central item management; each site can sell all items by default, with configurable exclusions.
- Master selling prices, with Owner-controlled site price overrides.
- Cashiers and supervisors request raw stock. A stock controller dispatches the full request or part of it. Cashiers or supervisors confirm receipt at the destination site.
- Items can have recipes and step-by-step cooking/packing instructions with photos.
- Exactly two item types: materials and sellable items. No prepared-item stock or production/preparation transactions.
- Deduct all raw ingredients and packaging automatically on sale.
- Record actual batch counts/yields for conversions rather than assuming fixed item-wide weight/count ratios. Exact recording and transfer behavior remains to be specified.
- One central stockroom serves all sites.
- Exclude cooking oil from sellable-item recipes and automatic sale consumption. Oil remains a requested material where needed; its separate usage/count workflow is not decided.
- Initial vegetable portions are 5 g lettuce and 5 g cucumber per box. Recipe quantities are editable and will be set to actual amounts during configuration.
- Allow sales even when site stock is insufficient, with a warning. Sales can produce negative material balances; do not silently clamp balances to zero or invent stock.
- Stock controller or Owner counts dispatch. Cashier or Supervisor counts receipt. Keep both actual quantities.
- Confirm the actual receipt when it differs from dispatch and flag the discrepancy for controller/Owner resolution.
- Keep the undispatched remainder of a partial request open for additional dispatches.
- Owner alone can create/edit materials, sellable items, recipes and cooking/packing instructions. Owner controls site price overrides.
- Inventory works offline: save data and operations on the device, then sync when online. Short offline periods are expected; users should be able to continue the workflow.
- If sender/receiver are both offline, staff manually enter the dispatch reference and actual received items. No QR handover is required.
- Cashiers/Supervisors can record waste and physical stock counts at assigned sites. Apply count differences immediately and flag them for controller/Owner review.
- Allow a physically counted dispatch despite insufficient recorded central stock, with a shortage warning and review flag.
- Requester may cancel a request before any dispatch. Controller/Owner may close the undispatched remainder after dispatch. Posted dispatch/receipt records retain their history and use corrections.
- First build: materials and sellable items. Recipes/instructions and site availability/price management follow in the next catalog step.
- Each sellable item is independent and grouped by category. Small/Large/Mixed are separate items with their own price and recipe; do not introduce a product/variant hierarchy.

### Box composition supplied by the user

| Sellable box | Fried dumplings in box | Fried meatballs in box | Other contents |
| --- | ---: | ---: | --- |
| Small dumpling box | 5 | 0 | Shared contents below |
| Large dumpling box | 10 | 0 | Same as small box |
| Small meatball box | 0 | 10 | Shared contents below |
| Large meatball box | 0 | 20 | Same as small box |
| Mixed box | 5 | 10 | Shared contents below |

Shared contents: choice of Original, Chilly or Sichuan sauce (3 g); side vegetables; a small paper box, plastic sauce cup, picking stick, and two plies of napkins. Vegetable portions start at 5 g lettuce and 5 g cucumber; quantities remain configurable. Packaging quantities and the napkin stock unit will be set in the recipe editor, not hardcoded.

One fried dumpling uses one wrapper and 3 g of filling. One fried meatball uses one raw meatball. Cooking oil is excluded from item recipes and sale deductions. Loss/waste handling remains to be specified.

Example requested units: wrappers by count, filling/meatballs/cucumber/"lectures" by kg, sauce by litre, cooking oil in 2,500 ml bottles. The user confirmed lettuce (initially written as "lectures"). Do not assume a universal kg-to-piece or gram-to-ml conversion.

## Two-layer structure

1. **Materials:** ingredients and packaging, with stock units and purchasing/dispatch pack sizes. A 2,500 ml oil bottle is a pack size, rather than a second unrelated stock balance.
2. **Sellable items:** boxes, drinks and frozen bags. Their recipes consume materials directly, including the selected sauce and add-ons. There are no balances for fried/prepared dumplings or meatballs.

Reusable recipe templates can avoid duplicating quantities without introducing another item type: a dumpling recipe uses one wrapper and 3 g filling; each sellable box multiplies that recipe by its dumpling count. Cooking steps and photos are instructions, not preparation stock movements.

| Sellable box | Wrapper consumption | Filling consumption | Raw meatball consumption |
| --- | ---: | ---: | ---: |
| Small dumpling box | 5 | 15 g | 0 |
| Large dumpling box | 10 | 30 g | 0 |
| Small meatball box | 0 | 0 | 10 pieces |
| Large meatball box | 0 | 0 | 20 pieces |
| Mixed box | 5 | 15 g | 10 pieces |

Add the selected sauce, 5 g lettuce, 5 g cucumber and configured packaging quantities to each recipe. Exclude cooking oil. All quantities are editable recipe data rather than fixed application rules. Meatball weight/count and sauce volume/weight require explicitly recorded conversions; do not assume 1 kg equals a fixed piece count or 1 ml equals 1 g.

Record actual material batch counts/yields. The stock controller/Owner records actual dispatch counts, and receiving cashiers/Supervisors confirm actual receipt counts. Central supplier-receipt conversions, preservation through partial transfers, and batch selection during consumption still need specification. These are material conversions, not prepared-item production.

Recommend deducting stock once when an invoice is completed, including fully complimentary orders. Unpaid/held carts should not permanently consume stock. Keep the recipe version and material quantities used by each completed invoice so recipe edits cannot change historical deductions. Insufficient site stock does not block a sale: show missing materials/quantities before completion, post the full recipe deduction, and keep negative balances visible for reconciliation. Physically counted dispatches also remain allowed when recorded central stock is insufficient, with a warning and review flag. Reservation behavior remains open.

Site catalog settings inherit availability/master prices, with explicit exclusions and optional Owner-controlled price overrides. Physical stock and complimentary allowance pools remain separate.

## Recommended request and transfer flow — subject to confirmation

Site request → controller dispatch → in transit → site receipt confirmation.

- Preserve requested, dispatched and received quantities separately for every line.
- Allow multiple partial dispatches against one request. The remaining quantity stays visible until fulfilled or explicitly closed/cancelled.
- On dispatch, move stock out of the source into an in-transit balance. On receipt confirmation, move the accepted quantity into the site balance.
- Confirm actual receipt quantities, flag any difference, and let the controller/Owner resolve it. Preserve dispatch counts; discrepancies must not silently replace them. Shortage, damage and over-delivery resolution outcomes still need definition.
- Record actor, site/source, time, reference and reason for each movement. Correct confirmed movements through linked corrections rather than deleting history.

One central stockroom and the people counting each side are confirmed. Separate request approval, shortage resolution, returns, supplier receipts and cancellation rules are not confirmed yet. Proposal: controller/Owner can dispatch a request directly, without another approval step; this is not yet confirmed.

## UI proposal

Reuse DaisyUI, Khmer/English translation, shared sign-in/session handling, private photos, profile menu, sync/offline indicators, compact page headings, normally scrolling search/filters, fixed dialog headings/actions, and permission-aware empty-state CTAs.

Proposed mobile navigation: **Stock · Requests · Items · Activity · Hub**. Hub contains Recipes, Site menu/prices, Stock counts and other authorized tools. Review navigation after workflow decisions.

- Stock: site/source selector, search, low-stock filters and item cards showing quantity/unit.
- Requests: status filters, outstanding requests and line-level requested/dispatched/received quantities.
- Dispatch/receive: a focused editor with quantity controls and a confirmation summary.
- Item details: photo, units/pack sizes, stock tracking, recipe, instructions and selling configuration.
- Recipe/instructions: ordered steps, per-step photos and a clear output/yield summary.
- Site menu/prices: inherited availability/prices with explicit override indicators.
- Activity: dated groups, date-range picker and infinite loading using the existing Admin pattern.

## Permissions proposal

Extend existing module/action permissions; Inventory access is currently unavailable in code. Do not treat enabling the navigation as authorization.

- Cashier: request and confirm stock for assigned sites; other actions require explicit grants.
- Cashier/Supervisor: record waste and physical counts at assigned sites; review/adjustment approval is being clarified. Item/recipe/instruction editing is Owner-only.
- Stock controller: dispatch/count actions for the central stockroom. Owner can also dispatch/count. No catalog/recipe/instruction editing; use the existing configurable role/action permission model for operational actions.
- Owner: item/recipe management, site availability/prices and Inventory permissions.

Enforce site/source scope and action grants on the backend, including access to photos and history.

## Build sequence proposal

1. Confirm recipe quantities, material batch conversions, stock-controller scope, shortage/approval rules and offline scope.
2. First build: Inventory app shell, materials, stock units/packs and sellable items/master prices. Following catalog step: recipes/instructions and site selling/pricing configuration.
3. Add opening stock/source receipts, site requests, partial dispatch and receipt confirmation.
4. Add waste, counts/corrections, low-stock views and activity history.
5. Connect completed POS invoices to versioned recipe consumption and reconcile the stock ledger.

No sample business stock or pricing should be inserted as production data. Inventory offline writes are now required. Admin remains read-only offline; Inventory has a separate local transaction queue. Inventory's maximum offline authorization window still needs definition; POS's 24-hour rule does not automatically apply.

## Questions in progress

Round 1 confirmed: deduct raw materials automatically on sale; record actual batch counts/yields; one central stockroom; no prepared-item layer.

Round 2 confirmed: lettuce 5 g and cucumber 5 g initially; exclude oil from recipes; enter actual quantities in the recipe editor. Round 3 confirmed: permit sales with insufficient stock and show a warning. Dispatch approval remains unanswered.

Round 4 confirmed: controller/Owner counts dispatch; cashier/Supervisor counts receipt; save operations locally offline and sync online.

Round 5 confirmed: confirm actual receipt and flag differences for controller/Owner resolution; retain partial-request remainders; Owner-only catalog/recipes/instructions.

Round 6 confirmed: manual offline dispatch reference/item entry; Cashier/Supervisor waste/count recording at assigned sites; counted dispatches allowed with a shortage warning and review flag.

Round 7 confirmed: immediate physical-count differences with a review flag; requester cancellation before dispatch and controller/Owner remainder closure; materials and sellable items in the first build, recipes/site prices next.

Round 8 confirmed: separate sellable items grouped by category. The first catalog build has a settled item structure.

Remaining operational details: discrepancy correction outcomes; permission to establish opening balances; over-dispatch limits; site returns; manual usage of oil; low-stock thresholds; supplier costing scope; offline authorization window.

Proposed setup choices still unconfirmed: controller/Owner records central supplier receipts; direct dispatch without another approval step; optional batch expiry; material-configured sauce units with explicit cross-dimension conversions. These are reviewable defaults/capabilities, not recorded user answers.

## Offline/sync implementation requirements — proposal

- Save each local stock action and its queue entry together in SQLite before showing it as saved.
- Assign a stable operation ID before submission. Server processing must be idempotent so retries do not duplicate requests, dispatches, receipts or sale deductions.
- Retain operation dependencies: receipt references its dispatch, dispatch references its request, and sale consumption references its invoice/recipe snapshot.
- Synchronize in dependency order, with saved/pending/syncing/synced/review states using the existing sync UI.
- Store action time and sync time separately. Preserve original counts; synchronization must not silently rewrite physical dispatch/receipt reports.
- Refresh balances and permissions after sync. The server remains responsible for current authorization and transaction validation; an offline action that needs reconciliation stays visible with a recovery path.
- Offline receivers manually enter the dispatch reference and actual received items. Save a provisional receipt if the referenced dispatch is not cached; match it after both operations sync. Verify destination, material identities and dispatch reference on the server. Missing/ambiguous references remain visible as needs review; never create a fake dispatch or silently attach a different delivery.

## Detailed screen and interaction plan — draft

### Navigation and shared shell

Inventory has its own install scope, title `OneBite - Inventory`, and the existing language/theme/profile/sync controls. Reuse seven-day sign-in behavior and Owner verification rules rather than adding another account system.

Mobile bottom navigation: Stock, Requests, Items, Activity, Hub. Desktop uses the existing sidebar pattern. All page headings compact on scroll and meet the app bar without a gap; search/filter rows scroll normally. New actions are icon-only on mobile and include a label on larger screens. Dialog headings/actions remain fixed while contents scroll.

Hub includes Receiving, Dispatches, Differences, Stock counts, Waste, Recipes, Instructions and Site menu/prices, filtered by permission. Stock controller operational screens and Owner management screens use the same components with different authorized actions.

### Materials

List: search, category, active/inactive/all, ingredient/packaging filters. Show cards on larger screens and compact rows on mobile. Tapping opens details; only the Owner sees New/Edit.

Editor fields:

- Khmer/English name, optional photo, category and description.
- Stock unit: pieces, grams or ml; kg and litres are display/input multiples of grams/ml.
- Optional purchasing/dispatch packs: wrapper pack, sauce container, oil bottle, paper-box bundle. Pack sizes are material configuration.
- Allow alternate measured units with recorded actual batch conversion when dimensions differ, such as meatball weight plus piece count. Never silently convert mass to volume or mass to count.
- Optional batch/expiry configuration and location-specific low-stock threshold. These remain proposed capabilities, not confirmed defaults.
- Active defaults true; archive rather than erase items used in past movements.

The Owner can choose grams or ml for each sauce and set its recipe portions accordingly. If purchasing units differ in dimension from the stock unit, require an explicit measured conversion. The original 3 g example does not become an assumed 3 ml rule.

### Sellable items and recipes

List: search, category and active status. Cards show photo, name, master price and recipe readiness. An incomplete recipe is clearly marked; changing sellability must not silently create a complete recipe.

Owner editor:

- Name/translations, photo, category, master KHR price, active/sellable settings.
- Recipe output quantity (default one selling unit), material lines with quantities and units, and optional reusable recipe templates.
- Sauce group, allowed options, required/default choice and material consumption for each selected option.
- Extra-sauce choices with independently configured portion and price. Pricing overrides do not change physical quantities.
- Ordered cooking/packing steps with photo, short title and instruction text. Allow add, reorder and remove before save.
- All-sites availability by default; explicit site exclusions and site price overrides owned by the Owner.

Templates describe ingredients; they never create prepared-stock balances. For example, five repetitions of the dumpling template resolve to five wrappers and 15 g filling. The recipe editor previews the resulting material list per selling unit.

Historical sales retain the recipe/version, modifier choices and material deductions actually used. Free items consume their entire recipe even though their price is zero. Held/unpaid invoices do not create final stock deductions.

### Stock overview and details

Location selector lists the central stockroom and authorized sites. A stockroom is a distinct stock location, not a fake sales/attendance site. Cashiers/Supervisors use assigned sites; Owner/controller cross-site visibility is proposed for operational coordination.

Summary tiles: available stock, low/negative balances, incoming deliveries and unresolved differences. Each material shows its stock unit and balance, plus pending local movements distinctly from synchronized balances. Optional alternate weight/count values must indicate whether they are measured or estimated.

Material details show location balances, in-transit quantities, batch/conversion records and dated movements. Low/negative stock warnings remain visible and do not block sales.

### Request → dispatch → receive

1. Cashier/Supervisor chooses an assigned destination site, adds materials, requested units/quantities and an optional note, then submits. Empty requests cannot be submitted.
2. Controller/Owner opens the request, enters actual dispatched quantities and applicable actual weight/count measurements, and confirms a delivery. A dispatch may omit lines or dispatch less than requested. Undispatched quantities remain open.
3. Receiving Cashier/Supervisor opens the delivery, sees the dispatch count, enters their own received count and confirms. If both devices are offline, manually enter its dispatch reference and actual items/quantities, with pending-match status until the dispatch becomes available. No silent pre-confirmation or replacement of the sender's count.
4. Any line difference creates a review entry for controller/Owner. The destination stock reflects the actual receipt; the difference remains separately outstanding until resolved. Request fulfillment and discrepancy resolution are separate statuses.

Every request can have multiple deliveries. Keep requested, total dispatched, total received, remaining-to-dispatch and unresolved differences separate. Do not imply that a request is fully received merely because all its requested stock was dispatched.

Proposed statuses: request Draft/Open/Partially dispatched/Fully dispatched/Closed/Cancelled; delivery Draft/Dispatched/Received/Received with differences; review Open/Resolved. Offline sync status is an additional indicator, not a substitute for business status.

Direct dispatch without another request-approval step remains the proposed default. The requester can cancel before any dispatch; controller/Owner can close the remainder after dispatch. Over-dispatch limits remain undecided. Posted dispatches/receipts are corrected through linked movements, not overwritten.

### Receiving into the central stockroom

Proposed actors: controller or Owner. Capture supplier/reference (optional), materials, actual quantities/units, pack quantities, measured weight/count conversions, optional batch/expiry and remarks. Costing and supplier purchasing are later decisions; do not make them mandatory just to record physical stock.

Opening balances use a clearly identified opening-stock movement, not a fake supplier receipt. Authority to establish opening balances remains to be confirmed.

### Differences, waste and stock counts

Difference details show sender/receiver, times, both counts and signed quantity difference. Resolution requires a reason and a linked correction. Candidate outcomes include confirmed loss/damage, corrected dispatch count, corrected receipt count or a later linked delivery; the permitted outcomes and actors are not final.

Waste records select a location/material, actual quantity and reason. Count records preserve the expected balance at count time, actual count and variance. Apply the variance immediately through an explicit linked adjustment, flag it for controller/Owner review, and do not silently overwrite movement history. At sync, apply that recorded variance rather than resetting the balance to an old count: movements after the count must remain accounted for.

Cashiers/Supervisors record waste/counts at assigned sites. Physical-count adjustments apply immediately and are flagged for controller/Owner review. Counted dispatches can continue with insufficient recorded central stock; show a warning and preserve the resulting negative balance/review flag.

## Data and sync boundaries — implementation proposal

Supabase is the central authority; SQLite stores local Inventory data and pending operations. Reuse the existing account/session service with server-side site/action checks. Do not expose new privileged stock functions or tables publicly merely to simplify offline sync.

Candidate records: materials, material packs/conversions, sellable items, recipe versions/lines/modifier consumption, instruction steps/photos, site item settings/prices, stock locations, material batches, requests/lines, dispatches/lines, receipts/lines, discrepancies/resolutions, stock movements, physical counts and client operations.

- Posting one movement and its affected balances/lines must happen in a single database transaction. The API validates the actor; a restricted database function applies the whole business action.
- Unique operation IDs and payload identity prevent duplicate processing; resubmitting an ID with different contents is an error. Receipt/request limits are checked atomically.
- Site/source scope is verified from current server-side assignments and grants. Catalog/recipe/instruction mutation additionally enforces the confirmed Owner-only rule; another role cannot gain it through a grant.
- Protect any exposed tables with RLS and explicit grants; prefer restricted functions with `security invoker`. Private instruction/item photos use scoped authorized access. Frontend bundles contain no privileged database keys.
- Store recipe snapshots and exact quantities; use precise quantity arithmetic, not binary floating-point accumulation for material balances.
- Existing `@onebite/offline` is a ten-minute encrypted Admin snapshot cache, not a transaction queue. Inventory needs separate durable storage/outbox handling. Admin cache cleanup or sign-out must not accidentally delete unsynced Inventory operations.
- Pending operations belong to their original account and location. Switching accounts must not send another person's queue under the new identity. Re-authentication/revocation failures preserve reviewable pending records rather than silently discard or authorize them.
- Local business state and its outbox operation must persist together. Keep queued operations across app restart, transient network failure and response loss. Reconnect/retry replays stable IDs in dependency order and refreshes authoritative balances.
- A pending catalog edit/stock movement is marked as local until acknowledged. The existing Owner verification policy still applies when the server receives sensitive Owner actions; offline use does not bypass it.

Supabase references reviewed during planning: [Database functions](https://supabase.com/docs/guides/database/functions), [Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security), and [Changelog](https://supabase.com/changelog). Actual migrations/API work still requires inspecting the current deployed schema and verifying changes.

## Milestones and review criteria

| Milestone | Deliverable | Required verification |
| --- | --- | --- |
| 1. Catalog foundation | Inventory PWA shell, scoped login/navigation, Owner material/item editors, units, packs, photos and master prices | Phone/desktop UI; Owner-only writes; staff scope; no sample production records |
| 2. Recipes/site catalog | Material-only recipes, sauce/add-on consumption, templates, photo steps, versioned saves and site availability/prices | Small/large/mixed calculations; alternate units; chosen modifiers; historical versions unchanged |
| 3. Stock workflow | Central receiving/opening stock, requests, partial dispatch, independent receipt counts and differences | Partial deliveries/remainders; actual receipts; corrections; concurrent requests; unauthorized actions denied |
| 4. Offline transactions | Durable SQLite queue, saved/pending indicators, reconnect replay and offline handover | Restart offline; dropped responses; repeated retry; out-of-order dependencies; account switch; no duplicate movements |
| 5. Counts and POS | Waste/count reconciliation, low-stock views, completed-invoice deductions and shortage warnings | Paid/free sale consumption; no consumption for held/unpaid carts; negative balances preserved; recipe snapshots; once-only invoice posting |

Develop offline-compatible IDs and transaction boundaries from milestone 1; milestone 4 verifies the complete offline operational flow rather than retrofitting identifiers after stock movements exist. All stages reuse the existing shared UI and deploy through the established GitHub Pages workflow. Supabase changes and browser-to-backend behavior are verified before calling a stage complete.

## First-build specification

Scope: catalog foundation only. Reuse the existing app bar, compact page headings, scrolling directory controls, mobile/desktop New CTA, fixed dialog actions, photo patterns, active badges, empty states and Khmer/English UI. Stock requests, movements and recipe consumption arrive in their subsequent milestones.

- **Materials page:** search; Active/Inactive/All (Active by default); category filter; mobile rows/desktop cards; detail dialog; Owner New/Edit actions.
- **Material editor:** name/translations, optional photo, ingredient/packaging category, stock unit, optional pack name/quantity/unit, optional description; active true on create and editable on edit.
- **Sellable items page:** search; Active/Inactive/All; category filter; mobile rows/desktop cards; photo, name and master KHR price; detail dialog; Owner New/Edit actions.
- **Sellable editor:** name/translations, optional photo, category, master KHR price, optional description and selling-unit label; active true on create and editable on edit. Each size is its own sellable item, grouped by category; no variant selector or parent-product record.
- **All sites:** inherit active sellable items/master prices by default. Explicit site exclusions/price override editors are in the following catalog step.
- **Staff access:** authenticated permitted staff can view the catalog. Owner-only creation/editing is enforced by the backend, not merely hidden in the UI.
- **Empty data:** show clear empty states; authorized Owner sees a creation CTA. Never insert mock materials/prices into the live database.
- **Offline:** retain cached catalog; save Owner edits locally with pending status and persistent IDs. Server acknowledgement/authorization determines publication; another device sees the updated catalog after sync.
- **Validation:** required name, valid unit/pack quantity, nonnegative master price, duplicate handling, linked-data-safe archiving, and no editable Owner-only permission grant to staff. The first build conservatively locks material base units after creation; later stock/recipe references will retain that protection.
- **Checks:** create/edit/archive/reload; staff write denial; permission/session changes; offline restart/retry and queue ownership; phone/desktop layouts; private photos; GitHub Pages install scope and hosted API verification.

Catalog-only tabs/Hub entries should reflect available functionality; do not present stock/request buttons as functional before those milestones exist. Final five-item navigation is introduced as its destinations become available.

### Initial item organization (configuration examples, not live seed data)

- Category **Dumplings**: Small dumpling box; Large dumpling box; Frozen dumpling bag.
- Category **Meatballs**: Small meatball box; Large meatball box.
- Category **Mixed**: Mixed box.
- Category **Drinks**: Lemon Tea.

Names/translations, category labels and actual prices are entered by the Owner. These examples do not authorize seeding mock prices or infer a mixed-box price. Site pricing and recipes attach to each individual sellable item in milestone 2.
