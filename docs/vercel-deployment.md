# Vercel deployment

OneBite uses two projects connected to the same GitHub repository, `vanthadeth/onebitesuper`. Both projects use the repository root, Node.js 24 and the `main` production branch.

`vercel.json` sets `npm ci`, `npm run build:vercel` and output directory `dist`. The build script validates `ONEBITE_APP`, builds that workspace and copies its output into `dist`. Shared packages, logos and fonts remain available from the repository root. Service workers have revalidation headers; each app has its own origin and install identity.

| Project name | Required variables |
| --- | --- |
| `onebite-pos` | `ONEBITE_APP=pos` |
| `onebite-admin` | `ONEBITE_APP=admin`; `VITE_SUPABASE_URL=https://iizosglpofempyjvepyr.supabase.co`; `VITE_SUPABASE_PUBLISHABLE_KEY` set to the active project publishable key |

Configure variables for Production and Preview environments. Use the public publishable key from Supabase project settings. Do not use a service-role or secret key. Local `.env.local` and `.secrets/` files are ignored and must not be uploaded.

The current POS remains a sample-data preview. Admin has a deployed account backend, but complete live authentication verification is pending. Deploying the frontend does not complete that verification or authorize real financial operation.

## Verification after deployment

Confirm both deployment URLs load successfully, the correct app renders at each URL, manifest identifiers differ, service workers and icons return their proper content types, and the Admin setup/status request reaches Supabase. Verify mobile installation and cached app-shell behavior over HTTPS. Record the actual URLs here only after successful deployment.

Deployment status: awaiting Vercel account connection; no Vercel deployment has been created from this workspace yet.
