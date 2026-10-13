# POS device and shared-shift foundation

## Implemented

POS → profile menu → Hub → Shift manages one ordering installation and one shared active shift per site. Site choices remain in Hub.

- Assigned staff with POS and shift-management permission can register an available site while online. A browser installation can register at one site at a time. A device UUID alone gives no ordering authority: a separate random 256-bit proof is encrypted in browser storage, shared by accounts using that installation, and hashed before database access.
- Registration changes increment a generation. A released installation cannot open or close shifts with its former registration. Release is blocked during an active shift. Registration on a replacement device requires releasing the previous installation first. Owner recovery from a lost device is **not implemented**; there is no silent force takeover.
- The registered device and an open shared shift are required for editing order drafts. Other devices can view the menu and their own saved drafts. Payments remain locked.
- Opening with new positive cash requires the authenticated Owner/Supervisor and cash permission. That person supplies and holds the cash. Cashiers can open with zero cash. Receiving cash from a different person is gated pending independent handover confirmations.
- The recorded cash holder may close the shift without a next shift, enter actual total KHR equivalent, and retain custody. Differences remain in the closed-shift history. The calculator converts USD using the configured exchange rate; it does not record tender denominations or a payment.
- The same cash holder may reopen with exactly the retained cash. It is carried forward rather than added again as a cash supply. Positive retained cash blocks opening under a different holder until confirmed handover is implemented.
- Device/shift changes require an online authorization check. Each request is encrypted in SQLite before submission and retains the same ID and payload through an uncertain response, reload and explicit retry. The server serializes per-site changes, enforces unique active shifts, and records each request once. Changed payloads reusing an ID are rejected.
- Events and Admin activity entries are written in the same transaction. Internal tables/functions are private; only the custom session-guarded Edge API accesses them. Retry results are subject to current permissions and site assignment.
- Cached device/shift authority is bound to the account/session/site and expires after 24 hours, within the remembered session. Online denial invalidates it. Device registration, release, opening and closing are unavailable offline. Clock rollback relative to the cache’s last observed timestamp invalidates it; monotonic elapsed time also detects a frozen/backward clock within a running app.

## Operational boundary

This is a foundation for testing the workflow, **not a live sales system**. There is no payment posting, sale/stock/cash contribution, complimentary reservation, withdrawal, collection, staff-to-staff handover, shared held-cart transfer, or lost-device recovery. Saved drafts remain private to their creating account/device. Do not supply real business cash or record live sales through this stage.

One named cash holder is the provisional representation for this foundation. Multiple-holder cash custody remains a product decision before live payments and handovers ship. There is no UI action that impersonates another staff member’s confirmation.

## Verification

- `supabase/pos-devices-shifts.verify.sql`: private functions/tables, device proof, generation fencing, single shared shift, assigned-site authorization, supply authorization, retained cash, discrepancies, immutable events and idempotency. Test fixtures roll back.
- `supabase/functions/pos-access/index.test.ts`: custom authentication, payload limits, trusted fields, proof hashing and strict cash inputs.
- `tests/pos-shifts.spec.ts`: phone/desktop device setup, supply/retained cash, other-device restrictions, offline gating, denial and lost-response recovery.
- Existing POS and encrypted-operation browser regressions continue to cover draft snapshots, held carts, stale tabs and durable local storage.

## Deployment

Migration `20261013153457_pos_devices_shifts` and `pos-access` version 2 are deployed to the connected OneBite Supabase project. Read-only live checks confirm the custom session gate, private API permissions and zero seeded devices, shifts or events. Authenticated flows were tested in isolated PostgreSQL and mocked phone/desktop browser tests; direct authenticated HTTPS testing from this workspace is blocked by the managed network proxy.
