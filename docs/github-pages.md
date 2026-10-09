# GitHub Pages app previews

The Pages workflow builds both apps from `main`, checks them on phone and desktop, and uploads one Pages artifact. It attempts to enable Pages for the repository and publishes through GitHub Actions. A final job repeats the browser checks against the hosted HTTPS site.

Expected URL paths (confirmed live URLs belong in this document only after successful deployment):

- Landing page: `https://vanthadeth.github.io/onebitesuper/`
- POS: `/onebitesuper/pos/`
- Admin: `/onebitesuper/admin/`

These apps share the GitHub Pages origin, with separate manifest identifiers, start URLs, asset paths and service-worker scopes. POS/Admin preview records use distinct storage keys; the language preference is shared. This preview arrangement does not replace the planned separate Vercel origins for production.

For optional live Admin access, set GitHub repository variables `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`. The publishable key is public browser configuration. Without it, the Admin service is unavailable and the user can open the labelled local preview. Never add the Owner setup code, PINs, server keys or Vercel token to Pages configuration.

The browser checks intentionally test preview UI and scoped offline shells. They do not validate Supabase sign-in or financial synchronization.

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

Status: local phone/desktop Pages checks passed; remote deployment verification pending.
