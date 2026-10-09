# Admin access — first implementation step

Updated 9 October 2026. Project: `iizosglpofempyjvepyr`.

## Current status

Users, Roles, Permissions and account-change history are implemented in the Admin app. The local preview persists sample profiles and permission changes on this device, with a visible preview banner and role switcher. PIN reset and provisioning are unavailable in preview.

Supabase requests recovered on 9 October 2026. The eight-table schema and `admin-access` Edge Function were deployed, and the Admin environment contains only the project URL and public publishable key. No Owner or staff accounts have been created. Database checks confirmed RLS on every app table, denied browser access to credentials/RPCs, rejected unauthenticated sessions and prohibited Owner refund permissions. A broader transaction verification request was cancelled and is not counted as passed. App-to-API verification is pending because the cloud environment blocks the project host with HTTP 403.

At the user’s request, Supabase work is paused until the app is built and committed to GitHub. The bootstrap code is stored privately in the ignored `.secrets/` directory; it is never bundled or committed.

## Access rules

| Role | Account access |
| --- | --- |
| Cashier | Own profile; operational permissions at assigned sites |
| Supervisor | Own profile and Cashiers at managed sites; can change existing staff assignments within those sites, preserving outside assignments |
| Owner | Manage accounts, status, site assignments and role permissions; reset PINs |

Owner access is protected. At least one active Owner must remain. Active Cashiers and Supervisors require an active site. Usernames are normalized and unique across all accounts, including inactive ones. Owner may reduce Cashier/Supervisor grants, never exceed their role ceilings. Refunds, cancellation of paid invoices and discount-limit overrides are forbidden for every role.

## Prepared backend

- `supabase/admin-access.sql`: private account, credentials, opaque session, role permission and audit tables; RLS enabled, no browser table/RPC access. All account operations run through one service-role RPC with current-account authorization and transaction locking.
- `supabase/functions/admin-access/index.ts`: custom authentication gateway. Public actions are first-Owner status/setup and username/PIN sign-in; every other action validates an opaque token against the database.
- Individual six-digit PINs use bcrypt; repeated failed attempts lock an account for 15 minutes. Temporary PINs require a change at first sign-in. Sessions expire after 24 hours. Account deactivation, role changes and PIN resets revoke sessions.
- Revision checks prevent stale Admin edits from silently overwriting newer data. Accepted mutations record an audit event without PINs or tokens.
- Browser requests include a publishable key; server credentials remain in the Edge Function environment. `verify_jwt=false` is required because the body validates OneBite internal sessions rather than Supabase Auth JWTs.

## Connection work remaining after GitHub commit

1. Allow `iizosglpofempyjvepyr.supabase.co` in the cloud environment’s network hosts, then verify the deployed Edge Function accepts app requests.
2. Finish live login, forced PIN change, reset/revocation, assignment scoping, stale revision and concurrent last-Owner checks. The repeatable SQL verification script requires an empty account database and rolls back sample records.
3. Let the Owner choose their own username and PIN using the private first-Owner setup code. There is no default PIN or public signup.
4. Review deployment settings before enabling real business operations. Vercel deployments need the same public Vite environment variables as the local Admin build; never use server keys in browser configuration.

Security advisors now show only [RLS enabled without policies](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy) informational notices, expected for service-only tables. Public execution permissions on the existing RLS event-trigger function were revoked to resolve its warnings.

Admin account changes currently require online access. The later POS offline milestone will handle cached permissions and the agreed 24-hour operating window; this Admin module does not claim those operational offline guarantees.

## Verification completed

- Production builds and frontend TypeScript checks passed.
- Eight Admin browser checks passed across phone and desktop: account creation/editing/persistence, duplicate usernames, audit history, last-Owner protection, role ceilings, scoped assignments, Cashier restrictions and Khmer viewport fit.
- Shared access-rule tests and mocked Edge gateway tests passed. Gateway checks reject malformed sessions and public keys, strip client-supplied session hashes and keep server credentials out of responses.
- Existing POS browser flows passed during regression checks. Live sign-in, concurrency and complete app-to-API checks remain pending.
