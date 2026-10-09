# GitHub Pages app previews

The Pages workflow builds both apps from `main`, checks them on phone and desktop, and uploads one Pages artifact. It attempts to enable Pages for the repository and publishes through GitHub Actions. A final job repeats the browser checks against the hosted HTTPS site.

Published app URLs:

- Landing page: `https://vanthadeth.github.io/onebitesuper/`
- POS: `https://vanthadeth.github.io/onebitesuper/pos/`
- Admin: `https://vanthadeth.github.io/onebitesuper/admin/`

These apps share the GitHub Pages origin, with separate manifest identifiers, start URLs, asset paths and service-worker scopes. POS/Admin preview records use distinct storage keys; the language preference is shared. This preview arrangement does not replace the planned separate Vercel origins for production.

Admin uses the project URL and active publishable key from `config/supabase.public.json`. These are public browser configuration, not server credentials. GitHub repository variables `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` can override them. Owner setup codes, PINs and secret/service-role keys must remain private.

Browser checks cover preview interactions and scoped offline shells. Hosted checks also verify Admin-to-Supabase connectivity and rejection of requests without valid sessions or browser RPC authorization. They do not provision an Owner or validate financial synchronization.

## Local checks

```sh
npm ci
npm test
npm run build:pages
npm run test:pages
npm run preview:pages
```

Local Pages preview: `http://127.0.0.1:5185/onebitesuper/`. The local server returns 404 for missing files, matching static hosting behavior.

If GitHub refuses automatic Pages enablement, open repository Settings → Pages and select **GitHub Actions** as the build source, then rerun the Pages workflow. Private repositories may require a GitHub plan that supports Pages. Do not change repository visibility to resolve hosting restrictions without the Owner's instruction.

Status: Pages is live; local and hosted phone/desktop preview checks passed. A new deployment will verify the added Supabase connection.
