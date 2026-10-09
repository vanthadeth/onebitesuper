# OneBite operations system — planning draft

Updated: 2026-10-09. Application coding resumed at the user’s request. The first Admin step implements Users, Roles and Permissions with a clearly labelled local preview. Supabase schema and internal-session API are deployed. App-to-API checks are blocked by the cloud network policy. Supabase work is paused while the app is built and committed to GitHub. Production login and shared operations remain unverified. See `admin-access.md` for the current milestone.

## 1. Product scope

OneBite operates three snack-cart sites selling items such as fried dumplings and meatballs. Each site has two staff, and three staff can move between sites. Clarify whether those three are included in the site staffing count before creating users.

Four separately installable, mobile-first PWA apps share a centralized database, identity system, reusable components, translations, and business rules:

- POS: ordering, payments, shared shifts, cash custody and handovers.
- Attendance: staff attendance; detailed requirements will be gathered later.
- Inventory: stock operations; detailed requirements will be gathered later.
- Admin: configuration, permissions, site management and oversight.

First release: POS and essential Admin. Attendance and Inventory are later phases, with compatible item/site/staff identifiers established from the beginning. No receipt printer or live KHQR integration in the first release.

## 2. Confirmed operating rules

### Sites, people and devices

- Roles: Cashier, Supervisor, Owner. People use individual accounts, initially using an internal user database with username/PIN sign-in rather than Supabase Auth.
- Owner creates accounts, with public registration disabled. PINs are six digits; Owner controls resets.
- Staff access explicitly assigned sites; moving staff can have multiple assignments.
- One shared active shift per site, with each action attributed to its actor.
- One active ordering POS device per site. Other devices can perform permitted non-ordering operations.
- Device registration and transfer require connectivity. Normal transfer requires the old device to sync and release control first.
- Khmer is the default interface language; users can switch to English.
- Mobile first, then responsive tablet and desktop layouts. Installable PWA with haptic feedback where supported.

### Cash and shifts

- There is no physical cash drawer requirement. Track cash balance and the person responsible for it.
- Record actual cash as one KHR-equivalent total. Provide a calculator for converting USD to KHR; do not maintain separate payment/change currency records.
- Opening cash, sales cash, additional cash, withdrawals, and handovers must be traceable.
- Supervisor/Owner can supply opening cash. Previous-shift cash held overnight becomes the next day's opening balance, linked to its custody record rather than counted twice.
- All remaining cash transfers to the next shift. Both outgoing and incoming staff confirm the actual amount.
- Record shortages or surpluses against the expected balance during handover.
- With no next shift, current staff retain custody until the next day or collection by a Supervisor/Owner.
- Supervisors and Owners can withdraw/collect cash at any time while connected. Site permissions still apply.
- Both the withdrawing Supervisor/Owner and the staff member holding cash must confirm a withdrawal/collection. Production confirmation requires distinct authenticated actors; one person checking two boxes is not identity verification.
- Cash custody survives shift closure. Carrying cash forward must not double-count it as new cash added.
- Handovers and withdrawals require connectivity and reconciliation of pending POS events.

Expected balance = opening cash + cash sales + cash added - withdrawals. QR receipts do not affect physical cash. Discrepancies are recorded as reconciliation events rather than rewriting sales.

### Prices, payments and invoices

- Items have a sellable flag, with site-specific prices in KHR.
- Owner manually configures the KHR/USD exchange rate; display USD equivalents.
- Cash and manually recorded QR Payment are supported. QR channels include ABA and Bakong KHQR; no bank verification is implied.
- QR reference photos are optional and can be attached after payment without changing financial values.
- Only unpaid invoices can be cancelled; cancellation requires a reason.
- POS starts with a blank cart. Staff can hold a nonempty current cart to start a blank one. Before opening the held-cart list, automatically hold the current cart if it contains items. Selecting a held cart resumes it. Empty carts are not saved as held invoices.
- Held carts must retain their contents durably, including offline. Persisting the cart before switching is required; a failed save must not clear it. Reopening should move the held cart into active editing without duplicating the invoice or complimentary reservations.
- Paid invoices cannot be cancelled or refunded. Show a review/confirmation step before marking paid.
- Financial records retain item names/prices, applicable rules and exchange-rate snapshots so later configuration changes do not rewrite history.
- Owner configures whether invoice split payments are allowed. When disabled, a paid invoice uses one payment method. When enabled, record Cash/QR allocations summing to the final rounded amount; physical cash increases only by the Cash allocation. Configuration scope (business/site) can be refined during Admin design.
- Entirely complimentary invoices use "Complete free order" and require no payment method.
- Round the final invoice total to a 100 KHR increment. Proposed rule is nearest 100, with a half increment rounding upward; exact direction still needs review. Record a distinct rounding adjustment so sales/discount totals remain explainable. Do not round each line independently.

### Discounts and complimentary items

- Item discounts support percentage and fixed amounts. Owner can configure both maximums; both apply when configured.
- Fixed discounts apply per sold quantity: two boxes with a 500 KHR fixed item discount receive 1,000 KHR discount, subject to each unit's hard limits.
- Receipt discounts support percentage only, with an Owner-configured maximum.
- Receipt discount does not stack with an item discount: use whichever produces the higher discount for that item, capped at its item limit.
- Compare fixed discounts and percentages in monetary terms on the same item base.
- Example: on a 10,000 KHR item, a 1,500 KHR item discount wins over a 10% receipt discount. If the item maximum is 10%, the discount is capped at 1,000 KHR.
- No role can override a hard limit through the POS. Owner configuration changes are audited separately.
- Complimentary allowances apply at each site, with a daily base-unit quantity and configured start/end period. Admin configures which items share an allowance pool.
- Count complimentary quantities in the item's base unit: for dumplings, individual dumplings rather than sold boxes. A Small Box uses five units and a Large Box uses ten; quantity multiplies that consumption. Block complimentary selection if the remaining pool cannot cover the whole item quantity.
- Discounted items can become complimentary through that separate allowance. Their final price is zero.
- Discounts apply to the full item price including sauce and add-on charges. A complimentary item includes all selected sauce/add-ons at zero charge; no extra complimentary allowance for sauces has been specified.
- Cancelling unpaid invoices restores their reserved complimentary allowance. Paid complimentary invoices consume it permanently.
- Complimentary items work offline, relying on the site's single ordering device; no allowance allocation between devices.
- Proposed: reserve allowances when persisting a cart containing complimentary items, release on cancellation/removal, and consume on finalization. Holding/reopening a cart must not reserve twice. Midnight and expired-rule handling need review; insufficient allowance blocks free selection.

### Offline operation

- Existing authenticated, authorized POS devices can create and finalize ordinary and complimentary sales offline for up to 24 hours after the last successful full sync.
- New sign-ins, site/device activation, device transfer, cash handovers and withdrawals require connectivity.
- Offline devices use the downloaded rules, prices, exchange rate and allowances. They cannot receive immediate configuration or permission changes.
- Enforce cached promotion start/end dates locally. Proposed daily boundary: midnight in Asia/Phnom_Penh.
- After 24 hours, preserve local records and block new sales until a successful sync; retries must not delete pending records.
- Save each operation durably before showing success. Show pending counts and last successful sync time.
- Sync automatically when possible and provide manual retry. Use stable operation IDs so retries cannot duplicate invoices or cash movements.
- Synchronize the full authoritative site state before extending the offline window. A network response alone is not a completed sync.
- Validate site, shift, device authorization and the cached rule version when accepting queued events. Surface exceptions for Owner review rather than silently discarding completed sales.
- Browser storage can be cleared or a device lost. Recovery, device-clock changes and zero-total invoice completion require explicit design before release.

## 3. Permission matrix

| Capability | Cashier | Supervisor | Owner |
| --- | --- | --- | --- |
| Receive orders on the active site POS device | Assigned sites | Managed sites, when operating POS | All sites, when operating POS |
| Apply permitted discounts and complimentary items | Yes | Yes | Yes |
| Override POS discount limits | No | No | No |
| Cancel unpaid invoice with reason | Yes | Yes | Yes |
| Cancel/refund paid invoice | No | No | No |
| Attach QR reference to paid invoice | Assigned-site access | Managed-site access | All sites |
| Open shift / participate in cash handover | Assigned sites | Managed sites | All sites |
| Withdraw/collect cash | No | Managed sites | All sites |
| Assign existing staff to sites | No | Managed sites | All sites |
| Manage users, roles, permission configuration | No | No | Yes |
| Manage sites, items and site prices | No | No | Yes |
| Configure exchange rates and promotion rules | No | No | Yes |

Proposed details to confirm: Supervisor assignment restrictions and Cashier visibility of site history/reports. Withdrawal requires the cash holder's acknowledgement. Enforce all permissions at the database/API boundary, not only through hidden buttons.

## 4. Proposed POS screens and flows

1. Sign in: individual username/PIN account, Khmer default, language switch.
2. Site/device readiness: assigned sites, active device status, connection/sync state; activate POS while online.
3. Shift start: cash custody source, opening KHR-equivalent count, currency calculator and responsible staff.
4. Sell: blank initial cart, category/filter/search, item tiles, site prices, cart quantity controls, modifiers, item discounts, complimentary eligibility and remaining allowance. Hold Cart saves a nonempty cart and opens a blank one. Opening Held Carts first saves any nonempty current cart; select an entry to resume it.
5. Invoice review: line prices and final discounts, receipt percentage, rounding adjustment, KHR total/USD equivalent, Cash or QR selection, optional Cash/QR split when enabled, optional QR photo and final confirmation. Entirely complimentary invoices finalize without a payment method.
6. Invoice history: unpaid/paid/cancelled, detail, sync status; cancellation only for unpaid invoices and add-reference action for paid QR invoices.
7. Shift overview: opening cash, cash sales, QR sales, withdrawals, expected balance, invoice counts and responsible staff.
8. Cash withdrawal/collection: Supervisor/Owner identity, amount, reason and confirmation; online only.
9. Handover/close: sync first, expected vs actual total, difference/reason, outgoing confirmation, incoming confirmation or retained-custody/collection path.
10. More/settings: account, language, installation help, device status, last sync, pending operations and diagnostics suitable for staff.

Proposed phone navigation: Sell, Invoices, Shift, More. Tablet layout places the catalog and cart side by side. Destructive actions need clear confirmation; common ordering actions need large targets and immediate feedback.

## 5. Essential Admin screens

- Site overview: current shift, responsible staff, device and last-known sync status. Offline figures are labeled as incomplete until synchronized.
- Users: proposed Owner provisioning/deactivation of internal username/PIN accounts, PIN reset, role and site access. Public-registration policy is not yet explicitly confirmed.
- Sites: names, active status and Supervisor assignments.
- Items: Khmer/English names, sellable status, category, optional image, selling unit and site prices; configurable sauce eligibility, default sauce and extra-sauce prices. Inventory-specific fields await Inventory planning.
- Discount rules: item percentage/fixed caps and receipt percentage cap.
- Complimentary rules: eligible items, shared allowance pools, base-unit consumption, site, daily allowance and start/end period.
- Exchange rate and POS settings: current rate and change history; split-payment permission.
- Shifts/cash review: handovers, collections, custody and recorded differences.
- Basic sales review: site/date/shift/payment totals, discounts and complimentary quantities.
- Audit history: actor, site, event time, device, rule changes and relevant financial references.

## 6. Proposed technical structure

- GitHub monorepo with separate POS, Admin, Attendance and Inventory app directories.
- UI-preview stack: React and TypeScript with Vite, independently built POS/Admin PWAs suitable for Vercel static hosting. Vite keeps each installable app shell independent; the server API for internal sessions and shared Supabase operations will be designed in the identity milestone.
- Shared packages: UI, Khmer/English translations, money/discount rules, types, validation, internal authentication helpers and offline sync protocol.
- Separate Vercel deployments and PWA manifests, icons, start URLs and service-worker scope per app. Separate subdomains are recommended.
- Supabase Postgres central database and private Storage for optional QR references. Initial identity uses internal users and username/PIN rather than Supabase Auth; external identity migration can be considered later.
- Proposed internal authentication: server-side salted PIN hashes, unique usernames, throttled sign-in, revocable server sessions and secure HttpOnly cookies. Never store plaintext PINs or verify identity solely in client code. Initial sign-in requires connectivity; offline operations are limited to a previously authorized session/device within the 24-hour window. Six-digit PINs and Owner provisioning/reset are confirmed; staff switching while offline remains open.
- Internal sessions are not automatically Supabase JWT identities. Route protected operations through a server API that validates sessions, roles and site membership on every request. Keep internal identity tables private and direct browser access to financial tables disabled; define database access accordingly. Do not assume `auth.uid()` identifies custom-session users.
- Database-enforced site permissions and atomic operations for payment finalization, daily allowances, device control and handovers.
- IndexedDB for the POS local catalog/rules, invoices, allowances and durable synchronization queue; service worker for app-shell availability.
- Store money with exact integer/fixed-point arithmetic and define rounding explicitly. Never use floating-point arithmetic as the source of financial truth.
- Keep server secrets out of browser bundles. Enable row-level security on any exposed tables and enforce site/role access. Privileged server database/storage access requires explicit authorization in the server layer; it does not inherit Supabase Auth policies from an internal cookie session.
- Separate development and production environments; migrations and app changes tracked in GitHub. Review current Supabase documentation before implementation.

Proposed entity groups: sites; users/profiles and site memberships; devices/site device ownership; items/categories/site prices; versioned discount and complimentary policies; exchange-rate history; shifts and cash custody; invoices/lines/payments; cash movements and dual-confirmed handovers; complimentary reservations/usage; QR attachments; sync operations and audit events.

This is a domain outline, not a finalized schema. Attendance and Inventory tables will follow their own requirement rounds.

## 7. Build milestones and acceptance checks

### Milestone 1 — UI and shared foundations

Create the repository structure, shared design tokens, Khmer/English system and independently installable POS/Admin shells. Use representative sample data. Review phone layouts before connecting financial workflows.

Acceptance: both apps install separately; navigation and Khmer rendering work on Android and iPhone; tablet layouts remain usable; haptics enhance supported devices without blocking others.

### Milestone 2 — Identity and essential Admin

Implement internal username/PIN accounts, server sessions, roles, site assignments, items/site prices and settings with server/database access controls.

Acceptance: unauthorized users cannot access other sites through direct API requests; PIN guessing is throttled and deactivated sessions are rejected online; Supervisors can assign staff only within permitted scope; archived items disappear from new orders while remaining in history.

### Milestone 3 — Online POS

Implement active device control, shift opening, ordering and held carts, modifiers, discounts, complimentary allowances, payment finalization, optional splits, invoice rounding and invoice history.

Acceptance: stacked discounts cannot bypass caps; holding/reopening carts preserves data without duplicating invoices or allowance consumption; unpaid cancellation restores allowance; split allocations sum to the rounded amount and only Cash affects cash held; complimentary completion needs no payment; paid invoice values cannot be edited/cancelled/refunded; QR photos can be appended without changing totals.

### Milestone 4 — Cash and handovers

Implement custody, withdrawals, actual/expected reconciliation, dual confirmations and overnight retention.

Acceptance: handovers cannot complete with one confirmation; collections update the balance once; shortages/surpluses are explicit; overnight cash is carried forward without duplicate additions.

### Milestone 5 — Offline reliability

Implement durable local events, cached rules, offline complimentary reservations, idempotent sync, the 24-hour boundary and safe device transfer.

Acceptance: reload/restart does not lose locally saved invoices; interrupted sync does not duplicate sales; ordinary and complimentary sales work offline within limits; the second device cannot order; failed uploads stay queued; handovers/withdrawals wait for reconciliation; allowance behavior is tested across midnight and cancellation.

### Milestone 6 — Pilot and rollout

Pilot at one site with real items, staff and cash counts. Reconcile recorded sales and physical cash, review usability in Khmer, address failures, then expand to the other two sites. Configure production GitHub/Vercel/Supabase resources before deployment.

### Later milestones

Gather Attendance requirements, then build its separate app. Gather Inventory requirements including receipts, transfers, waste, recipes/units and stock counts, then build its separate app. Plan live KHQR verification separately.

## 8. Next decisions

1. Menu structure and sample prices are recorded in `menu-plan.md`: dumpling/meatball box variants, Lemon Tea and frozen dumpling bags, with sauce/add-on modifiers. Admin controls sauce eligibility and allowance sharing. Complimentary counts use base units and insufficient allowances block free selection. Production pricing and minor modifier settings remain for configuration.
2. Held-cart behavior is confirmed; preparation/pickup statuses have not been requested. Review complimentary reservations across day/promotion boundaries before implementing them.
3. Rounding increment is 100 KHR; preview uses nearest/half-up convention and two-decimal USD display. Fixed item discounts apply per quantity.
4. Opening cash comes from Supervisor/Owner or prior-shift custody; both parties confirm withdrawals. Distinct-actor verification belongs to the identity/cash milestones.
5. Username/PIN, internal users, six-digit PINs and Owner provisioning/reset are confirmed; offline staff-switching details remain open.
6. Free completion and Owner-configurable split payments are confirmed. Decide how partially entered splits behave before final payment confirmation; no post-payment refund/reversal flow.
7. Lost/broken POS device recovery when pending local sales cannot be synchronized.
8. Branding: logo, colors and existing visual assets.

Maintain confirmed requirements separately from proposed choices. Resolve each milestone's dependent decisions before implementing it; do not present sample-data UI as a finished operational system.
