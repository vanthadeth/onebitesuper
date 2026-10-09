# OneBite

Four planned mobile-first business apps: POS, Admin, Attendance and Inventory. The first milestone provides independently installable **POS and Admin UI previews**, using shared React/TypeScript components and Khmer/English language support.

## Run locally

Requires Node.js 22.12+ (or 24+) and npm.

```sh
npm ci
npm run dev
```

- POS: http://localhost:5173
- Admin: http://localhost:5174

To run production builds with generated service workers:

```sh
npm run build
npm run preview
```

Serve each app on its own HTTPS origin for installation outside localhost. Production builds contain distinct manifests, PNG icons and app-shell service workers. On iPhone, use Safari's Share → Add to Home Screen; haptic vibration is only available on supporting browsers/devices.

## Current scope

Interactive sample POS includes menu modifiers, per-quantity discounts, hard item limits, complimentary base-unit allowances, held carts, Cash/QR/optional split payment review, invoice-level rounding and a cash calculator. Sample withdrawal controls demonstrate two-party confirmation.

Admin now focuses on Users, Roles and Permissions: account editing, status and site assignments, permission limits, last-Owner protection and an activity history. Khmer is the default language, with English available, original OneBite logos and Google Sans. Choose **Open local preview** to explore sample accounts and switch preview roles.

The Supabase schema and internal username/PIN Edge Function are deployed. Database permission checks passed, but live sign-in and app-to-API checks remain pending because the cloud environment denies the project host. No real accounts have been created. Supabase work is paused until the GitHub build/commit step is complete. The earlier menu/site configuration UI remains in source for subsequent steps and is not the current Admin entry point.

Browser-local preview records are scoped to each app origin; Admin changes do not update POS. POS identity, two-party cash verification, device exclusivity and cross-device synchronization remain preview behavior. Do not use these previews for real business records.

App shells can load offline after successful production service-worker installation. Sample records persist locally, but reliable IndexedDB synchronization and operational offline guarantees belong to the later offline milestone.

## Workspace

```text
apps/pos/          POS entry, screens, manifest and icons
apps/admin/        Admin entry, screens, manifest and icons
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

GitHub tracks both apps, shared packages and later database migrations. Create two Vercel projects with the repository root as the build context:

| App | Build command | Output directory |
| --- | --- | --- |
| POS | `npm run build --workspace @onebite/pos` | `apps/pos/dist` |
| Admin | `npm run build --workspace @onebite/admin` | `apps/admin/dist` |

The initial Supabase schema and account API are deployed; Vercel hosting is pending. Read [Admin access setup and status](docs/admin-access.md) for the prepared Supabase backend and remaining verification.

Read [the product plan](docs/product-plan.md), [menu decisions](docs/menu-plan.md) and [milestone status](docs/milestone-1.md).
