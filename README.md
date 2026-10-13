# OneBite

Four mobile-first business apps share React/TypeScript components, Khmer/English, Supabase identity and an encrypted SQLite offline store. Admin and the Inventory catalog are connected; POS now has an authenticated menu and draft-cart workspace. Attendance is planned.

Read the [operating rules and delivery roadmap](docs/operations-rules-and-roadmap.md) for the restaurant-software comparison, current implementation gaps, confirmed rules and next build stages.

## Run locally

Requires Node.js 22.12+ (or 24+) and npm.

```sh
npm ci
npm run dev
```

- POS: http://localhost:5173
- Admin: http://localhost:5174
- Inventory: http://localhost:5175

To run production builds with generated service workers:

```sh
npm run build
npm run preview
```

Serve each app on its own HTTPS origin for installation outside localhost. Production builds contain distinct manifests, PNG icons and app-shell service workers. On iPhone, use Safari's Share → Add to Home Screen; haptic vibration is only available on supporting browsers/devices.

## Current scope

**POS:** real sellable menu, site selection, effective recipe versions, held carts, quantity/note editing, cancellation reasons, KHR 100 rounding and a KHR/USD calculator. Drafts persist locally through offline reloads; prices and recipes lock at the first item. Payments and stock posting remain gated until device activation and shifts are implemented. See [POS adaptation and stages](docs/pos-build.md).

**Admin:** users, custom roles, module/action permissions, sites, photos, preferences and activity history backed by Supabase. Username/PIN sessions last seven days; only Owners need authenticator verification. Saved Admin data is read-only offline.

**Inventory:** one catalog with item types, categories, sellability, conversions and dated recipes for ingredients, box contents and packaging. Owner edits queue in SQLite and publish through guarded, idempotent APIs. See [unified item catalog](docs/unified-item-catalog.md).

No sample accounts, menu or transactions are seeded into the live database. POS draft carts are private to their account/site/device and do not yet synchronize between staff or become business transactions. Real POS sales must wait for the remaining shift, payment and stock-ledger stages.

The [operational transaction foundation](docs/transaction-foundation.md) provides shared durable queue/retry primitives for the next stock and sales stages. It is tested independently and is not yet wired to production posting workflows.

## Workspace

```text
apps/pos/          POS entry, screens, manifest and icons
apps/admin/        Admin entry, screens, manifest and icons
apps/inventory/    Unified catalog, recipes and offline publishing
packages/ui/       Shared components, translations, styles and PWA registration
packages/core/     Catalog fixtures, invoice calculations and allowance rules
scripts/           Multi-app runner and service-worker generation
tests/             Phone/desktop interaction checks
docs/              Product decisions and milestone status
```

## Verification

```sh
npm run typecheck
npm test
npm run build
npm run test:e2e
```

Browser checks run against production builds and start preview servers when needed. They use `/usr/bin/chromium` if available, otherwise Playwright's installed Chromium. Set `PLAYWRIGHT_CHROMIUM_PATH` for another executable or install the browser with `npx playwright install chromium`.

## Deployment plan

Use two Vercel projects connected to `vanthadeth/onebitesuper`, both with the repository root as their Root Directory. The checked-in `vercel.json` builds the selected app into `dist/`. Set these project environment variables before deployment:

| Project | Environment variables |
| --- | --- |
| OneBite POS | `ONEBITE_APP=pos` |
| OneBite Admin | `ONEBITE_APP=admin`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` |

Use Node.js 24, the `main` production branch and the checked-in build/install/output settings. Each project gets its own HTTPS origin and PWA manifest. Supabase variables are browser-public values; secret/service-role keys must never be used here. See [Vercel deployment setup](docs/vercel-deployment.md).

The initial Supabase schema and account API are deployed; Vercel hosting is pending. Read [Admin access setup and status](docs/admin-access.md) for the prepared Supabase backend and remaining verification.

Read [the product plan](docs/product-plan.md), [menu decisions](docs/menu-plan.md) and [milestone status](docs/milestone-1.md).

## GitHub hosting preview

The GitHub Pages workflow publishes POS, Admin and Inventory under separate repository paths and runs browser checks before and after deployment. See [GitHub Pages setup](docs/github-pages.md) for preview behavior, scoped offline shells and local checks.
