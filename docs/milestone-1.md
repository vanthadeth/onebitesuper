# Milestone 1 — POS and Admin UI preview

Date: 2026-10-09.

## Implemented

- Two independent Vite/React/TypeScript app entries and builds, with distinct installable PWA manifests, icons and production app-shell service workers.
- Shared UI components/design tokens and locally packaged Khmer fonts; Khmer default with an English switch.
- Mobile ordering and bottom navigation; persistent cart beside the catalog on larger screens.
- Six menu variants with sample prices, mandatory eligible sauce selection, configurable default sauce and extra-sauce choices.
- Per-quantity fixed discounts, item/receipt discount comparison, both hard limits, and one final invoice rounding adjustment.
- Complimentary base-unit consumption, current/held-cart reservations, insufficient-allowance blocking and restoration on unpaid cancellation.
- Blank/held/reopened carts persisted locally, with save-before-switch behavior.
- Sample Cash/QR/split payment completion, entirely free completion, locked paid-invoice UI and optional QR reference photos.
- Sample shift overview, total-equivalent currency calculator and withdrawal preview requiring both confirmation controls.
- Admin sample user/role/site assignment forms, site settings, menu/site prices, sauce eligibility/defaults, extra prices, allowance sharing/factors/dates and payment settings.

## Boundaries

This is an interaction preview with browser-local sample data. Neither app is an operational system yet. Sample users are not authenticated. Server-enforced roles, PIN authentication, real dual-actor confirmation, device ownership, Supabase records and synchronized Admin/POS configuration are pending. Report figures are explicitly fixtures.

App-shell caching is implemented; production offline queues, authorization expiry, conflict handling, midnight reservation reconciliation, lost-device recovery and immutable financial snapshots still require the later milestones. Current local storage must be replaced by the operational persistence model rather than treated as an authoritative database.

For UI review, main-sauce sample prices are Original/Chilly included and Sichuan +500 KHR. Extra portions use +500/+500/+1,000 KHR. One optional extra portion per sold unit is currently shown; production selection limits can be added in modifier configuration.

Prototype configuration defaults that were not provided by the user (discount caps, exchange rate, daily budgets, site/staff names and dashboard figures) are fixtures only.

## Next milestone

Review the phone screens and vocabulary, then implement the internal username/six-digit-PIN account/session API, Supabase schema and protected Admin operations. PINs will be hashed on the server; account creation/reset remains Owner-only. Design an explicit API/auth boundary before connecting the browser to shared records.

## Verification completed

- Both production builds and TypeScript checks pass.
- Five calculation/allowance checks pass.
- Twelve phone/desktop browser scenario checks pass, covering held-cart persistence, allowance exhaustion/cancellation, payment splits, two-party withdrawal controls, Admin edits, Khmer default, viewport fit and independent PWA manifests/offline app-shell loading.
- Offline loading was checked with network requests disabled and a noncached connectivity request failing; cached assets and the locally saved cart survived reload.
- Screenshots are available locally in `artifacts/` for phone/desktop review. Browser tests use Chromium; physical iPhone/Safari installation and device-specific haptics still need pilot verification.
