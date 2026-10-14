# Separate-origin app hosting

Use one project per built app, connected to `vanthadeth/onebitesuper`, with repository root, Node.js 24 and `main` as the production branch. Each project serves one app at `/`; do not serve all apps through path rewrites on one host.

`vercel.json` uses `npm ci`, `npm run build:vercel` and output directory `dist`. The build script accepts POS, Admin or Inventory, forces root-relative assets and generates each app's manifest and service worker.

| Project | Build variable | Proposed custom host |
| --- | --- | --- |
| `onebite-pos` | `ONEBITE_APP=pos` | `pos.<owned-domain>` |
| `onebite-admin` | `ONEBITE_APP=admin` | `admin.<owned-domain>` |
| `onebite-inventory` | `ONEBITE_APP=inventory` | `inventory.<owned-domain>` |

Attendance is not built yet. Reserve `attendance.<owned-domain>` for later. The landing page can remain on GitHub Pages until the final host URLs are known.

All apps continue using the existing centralized Supabase database. Configure `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` for Production and Preview, if overriding the checked-in public configuration. Never use a service-role or secret key in frontend builds.

## Cutover

1. Confirm the user's owned domain, hosting provider and target account/projects.
2. Build each app separately; check names, IDs, start URLs, root scopes, icons and worker responses.
3. Deploy and attach each selected custom domain. Use the DNS records provided by the hosting service and confirm HTTPS before updating app links.
4. Verify Android Chrome installation of all three apps on the same phone, plus sign-in and offline reopening.
5. Sync all pending work on old URLs before retiring old installations. Cookies, remembered login, SQLite/IndexedDB and offline queues are isolated by origin and do not automatically move to the new hosts. Do not clear old app storage before syncing.
6. Update the landing page to verified host URLs. Keep old URLs available during cutover; avoid unconditional redirects that strand offline data.

Domain and provider selection are pending. This document does not mean the new hosts have been deployed.
