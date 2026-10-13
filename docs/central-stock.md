# Central stock — opening counts and receiving

Implemented 13 October 2026. Supabase migration `20261013144924_central_stock_ledger` and `stock-access` Edge Function version 1 are deployed. The frontend is published through the existing GitHub workflow after commit; Vercel remains deferred.

## Using the feature

Open Inventory → Hub → Stock (or Stock in the desktop sidebar).

- The Stock page lists eligible raw materials/supplies, their base-unit balances, filters, local pending operations and the latest 100 posted movements.
- Owner can set opening stock once per material before any recorded movement. Actual delivered stock afterward uses Receive stock.
- Enter actual quantities in the item's base unit, up to six decimal places. Add multiple materials to one receipt; each item can occur once. Optional reference/supplier text and remarks are retained.
- Save first commits to encrypted SQLite. The header shows pending work and the Changes page links to stock review. Online/reconnect/focus retries send the same immutable operation; acknowledged records stay retained locally.
- Pending receipts are shown in local balances. Server-provided included IDs prevent counting a server-accepted receipt again after a lost response. Balances and included IDs are read together from one database snapshot.
- Rejected business records remain visible as Needs review and are excluded from usable projected stock. They are not deleted or rewritten. There is no correction/discard workflow for these immutable stock records yet.

Only active direct-stock raw materials and supplies without a recipe can be received. Inactive direct-stock items remain available through the status filter, with their historical balances; they cannot receive new movements. Recipe components/finished products are not prepared-stock balances. All movement history and references stay in the ledger if catalog records later change. Review remaining physical stock before changing an item's stock classification; a future classification/count correction workflow is still needed.

## Authorization

New Inventory actions: `stock.view`, `stock.receive`, `stock.opening`.

Owner receives these grants through the migration. Other accounts receive no automatic new grants; Owner can configure stock viewing/receiving through Roles. A custom Stock controller role can have Inventory access plus stock viewing/receiving. Opening stock remains Owner-only, including when a different role is manually assigned the action. Every action still requires its Inventory module grant. Server session checks enforce active accounts, fixed session expiry, mandatory PIN changes and Owner verification.

This release operates on the single central stockroom, not assigned-site balances. Viewing central stock requires an explicit stock-view action grant. Future site transfers/counts must enforce site membership separately.

Stock tables have RLS enabled and no browser policies/grants. The restricted API uses the authenticated internal session, not `auth.uid()`. The posting role can select/insert ledger records and use the movement sequence, but cannot update/delete ledger entries. The Edge Function uses custom opaque-session authentication, so gateway JWT verification is disabled deliberately; this does not make business actions anonymous.

## Posting and precision

The restricted `onebite_stock_api` handles read snapshots and central opening/receiving only. SQL validates the actor, permission, envelope, timestamp, location, line count, unique items, positive bounded decimal quantities and immutable base units. It rejects financial/POS events and site postings.

The Edge Function verifies the operation's canonical SHA-256 fingerprint. SQL additionally binds the original complete envelope, actor and device to its operation ID. Identical retries return the original receipt; changed contents conflict. Deterministic item locks prevent a receiving/opening race from creating two opening counts. A whole receipt, its movement lines, acknowledgment and audit entry post atomically.

Quantities use `numeric(20,6)` in Postgres and scaled `bigint` arithmetic in shared core. JSON quantities are decimal strings. The UI groups integer digits without changing the fractional digits. Balances are sums of immutable movement rows; this first release has positive opening/receiving movements only.

## Offline behavior

A separate encrypted authorized stock snapshot accompanies the operational queue. It is bound to the current account/session/device and expires after 24 hours, within session expiry. New sign-in still requires connectivity. Online authorization denial invalidates the stock cache and does not fall back to older permission data.

Local state and the new event persist together before success. Storage failures/stale revisions leave the old durable state unchanged. Cache refresh does not overwrite the business projection or operation queue. A full successful stock sync advances the offline verification timestamp; a deferred/unacknowledged pending event does not. The existing Admin cache and catalog queue remain separate.

The foundation's 1,000 retained-event and 8 MB workspace limits still apply; hitting a limit blocks new writes rather than dropping records. Receipt archival/compaction and recovery/review tools must be completed before sustained high-volume operational rollout.

## Verification and limits

- Shared core and Edge Function unit tests pass: decimal arithmetic, validation, immutable fingerprints, non-Owner opening denial, module/action requirements, secret isolation and rejected financial/site events.
- The exact migration and synthetic SQL suite passed in a rolled-back transaction before deployment: private/immutable tables, exact sums, duplicate receipts, changed body conflict, repeat opening denial, delegated receiving, actor separation, precision/unit checks, multi-line atomicity and module denial.
- Deployment succeeded, migration history/version and active Edge Function were checked. Live read-only queries confirmed zero stock records/test accounts retained and unauthenticated RPC denial.
- A post-deployment rerun of the synthetic transaction was blocked twice by the connector's “Invalid or expired requestState” error. Direct HTTP testing was blocked by the execution environment's outbound policy. These are verification limits; a real Owner session has not been used to post a production receipt for testing.
- Mobile/desktop browser fixtures cover opening/receiving, offline reload and reconnect, lost acknowledgment without duplicate balances, controller/read-only controls, retained conflict review and cache denial. No fixture is seeded into production.
- CI replays the migration and `central-stock.verify.sql` against isolated Postgres. Existing Admin, catalog, POS and offline-storage regression checks run alongside the new feature tests.
- Supabase advisors report informational RLS-without-policy notices for private service-only tables; they have no public grants. No new warning/error advisory was reported. [Advisor explanation](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy).

Dispatch, site receipt, waste/count corrections, negative-stock operations, costing, ordering-device activation, shifts and POS finalization are still upcoming. Receiving does not create a sale or enable checkout.
