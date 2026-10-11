# Security operations

Owner accounts require a time-based authenticator after PIN verification. Keep the eight one-use recovery codes somewhere secure, separate from the device. Account PIN resets preserve an enrolled authenticator. If all recovery factors are lost, an authorized project administrator must perform an audited recovery through the private database; there is no anonymous recovery endpoint.

Admin remembers the opaque session token in browser local storage on this device, with the server-supplied seven-day expiry; it never stores the PIN, authenticator secret or recovery codes. Every reload/reopen validates the token with the server before showing business data. Authenticated snapshots are encrypted in browser SQLite for read-only offline use within ten minutes of server verification; reconnect pulls current Supabase data. Sessions have a fixed seven-day lifetime from creation, supplied by the server; activity and refresh do not extend it. There is no inactivity logout. Only Owner accounts require MFA; other roles sign in with their own PIN. Offline authorization still expires after ten minutes, hides cached data and requires an online check while retaining a valid remembered token. Sign-out and confirmed revocation clear the remembered session; transient connection failures preserve it for retry. Persistent tokens are JavaScript-readable, so CSP and the existing authorization/MFA protections remain essential. An HttpOnly session would require a same-origin backend beyond GitHub Pages. Owner authenticator verification is valid for seven days within the fixed session lifetime. New sessions and expired verification require a code; sign-out, revocation, PIN rotation and session expiry still apply. A failed server logout is reported explicitly; the local token and interface data are cleared regardless.

Only Owner can edit role grants or create roles. Delegated user managers can manage ordinary staff, but cannot reset or reassign privileged accounts. Site assignment uses its own scoped action. Ordinary staff receive their assigned sites with private remarks omitted. Temporary credentials receive only authentication challenges until PIN rotation and any required MFA are complete.

Security events are stored in `onebite_security_events`, accessible only through trusted project administration. Events contain action, outcome, actor ID where known, request ID and time, never PINs, authenticator secrets or session tokens. Mutation activity and security-event tables deny service-role updates/deletes. Security events retain 365 days; expired sessions and limiter records are purged by the database maintenance job when pg_cron is available. Check that the job runs successfully in Supabase Cron.

Monitor at least daily for login/MFA failures, throttling and rejected privileged actions. Suggested alert queries:

```sql
select action,outcome,count(*) from public.onebite_security_events
where time>now()-interval '15 minutes'
group by action,outcome order by count(*) desc;
```

Forward alerts to an approved monitoring destination before adding automated notifications. No external recipients have been configured.

Site photos are deliberately public storefront images. The server decodes JPEGs, limits dimensions/memory/output size and strips source metadata by re-encoding. Uploads are limited per account and globally. Uploads not attached within 24 hours expire; subsequent uploads collect up to 20 old abandoned/replaced images belonging to the uploader through the Storage API. Do not use this bucket for staff photographs or QR payment references. Those features need private storage and authorized signed URLs when implemented.

The static apps enforce CSP without inline JavaScript and block rendering inside frames. Vercel adds response-level CSP/frame restrictions, HSTS and Permissions-Policy; GitHub Pages applies the meta CSP but cannot supply the full custom-header policy. Production hosting should use the Vercel configuration or equivalent header-capable hosting. Set `ONEBITE_ALLOWED_ORIGINS` on the Edge Function when adding an app origin; the default permits only `https://vanthadeth.github.io`. Do not allow wildcard preview domains. Local development also needs an explicit origin when calling the live API.

The sample POS prototype and its browser sales data have been removed. POS shows a setup screen until its trusted sales ledger and offline synchronization are implemented. It must not receive real transactions.

Provider tasks requiring account access:

- Revoke the previously exposed Vercel token at https://vercel.com/account/settings/tokens. Use provider-managed Git deployment where possible; never paste replacement tokens into chat.
- Confirm GitHub branch protection requires Build and test and Database security; protect the deployment environment and enable secret scanning/push protection where available.
- Confirm Supabase backup/PITR retention and run a restore exercise against a separate project. Do not restore over production as a test.
- Configure monitoring alerts and verify retention/maintenance execution. Do not mistake an empty vulnerability advisory list for a penetration test.

Release verification: unit/Edge tests, database negative tests, browser tests, npm advisory checks and repository-history secret-pattern scans. GitHub Pages deployment depends on database checks and also runs the full browser suite before upload. Third-party actions and dependencies are pinned; Dependabot proposes updates for review.
