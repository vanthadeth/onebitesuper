# Admin access — first implementation step

Updated 9 October 2026. Project: `iizosglpofempyjvepyr`.

## Current status

Users, Roles, Permissions and account-change history are implemented in the Admin app. The local preview persists sample profiles and permission changes on this device, with a visible preview banner and role switcher. PIN reset and provisioning are unavailable in preview.

Supabase requests recovered on 9 October 2026. The eight-table schema and `admin-access` Edge Function were deployed, and the Admin environment contains only the project URL and public publishable key. The first active Owner account (`owner`) has been created and its real sign-in verified. No staff accounts have been provisioned. Database checks confirmed RLS on every app table, denied browser access to credentials/RPCs, rejected unauthenticated sessions and prohibited Owner refund permissions. A broader transaction verification request was cancelled and is not counted as passed. The cloud environment blocks direct requests to the project host; hosted GitHub checks verified real browser-to-API requests, first-Owner setup readiness and unauthorized request rejection on phone and desktop.

The app is committed to GitHub and hosted on Pages. Supabase connection work has resumed at the user’s request. The first-Owner setup code has been consumed; public signup remains unavailable.

## Access rules

| Role | Account access |
| --- | --- |
| Cashier | Own profile; operational permissions at assigned sites |
| Supervisor | Own profile and Cashiers at managed sites; can change existing staff assignments within those sites, preserving outside assignments |
| Owner | Manage accounts, status, site assignments and role permissions; reset PINs |

Owner access is protected. At least one active Owner must remain. New Cashiers and Supervisors start active with no assigned sites. Site operations remain restricted to assigned active sites; once assigned, removing every active site is blocked while the account remains active. Usernames are normalized and unique across all accounts, including inactive ones. Owner may reduce Cashier/Supervisor grants, never exceed their role ceilings. Refunds, cancellation of paid invoices and discount-limit overrides are forbidden for every role.

## Prepared backend

- `supabase/admin-access.sql`: private account, credentials, opaque session, role permission and audit tables; RLS enabled, no browser table/RPC access. All account operations run through one service-role RPC with current-account authorization and transaction locking.
- `supabase/functions/admin-access/index.ts`: custom authentication gateway. Public actions are first-Owner status/setup and username/PIN sign-in; every other action validates an opaque token against the database.
- Individual six-digit PINs use bcrypt; repeated failed attempts lock an account for 15 minutes. Temporary PINs require a change at first sign-in. Sessions expire after 24 hours. Account deactivation, role changes and PIN resets revoke sessions.
- Revision checks prevent stale Admin edits from silently overwriting newer data. Accepted mutations record an audit event without PINs or tokens.
- Browser requests include a publishable key; server credentials remain in the Edge Function environment. `verify_jwt=false` is required because the body validates OneBite internal sessions rather than Supabase Auth JWTs.

## Connection work remaining after GitHub commit

1. Completed: the hosted Admin app reaches the deployed Edge Function using the public project configuration.
2. Finish live login, forced PIN change, reset/revocation, assignment scoping, stale revision and concurrent last-Owner checks. The repeatable SQL verification script requires an empty account database and rolls back sample records.
3. Completed: the Owner’s requested account was created with a bcrypt-hashed PIN; real login was verified.
4. Review deployment settings before enabling real business operations. Vercel deployments need the same public Vite environment variables as the local Admin build; never use server keys in browser configuration.

Security advisors now show only [RLS enabled without policies](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy) informational notices, expected for service-only tables. Public execution permissions on the existing RLS event-trigger function were revoked to resolve its warnings.

Admin account changes currently require online access. The later POS offline milestone will handle cached permissions and the agreed 24-hour operating window; this Admin module does not claim those operational offline guarantees.

## Verification completed

- Production builds and frontend TypeScript checks passed.
- Eight Admin browser checks passed across phone and desktop: account creation/editing/persistence, duplicate usernames, audit history, last-Owner protection, role ceilings, scoped assignments, Cashier restrictions and Khmer viewport fit.
- Shared access-rule tests and mocked Edge gateway tests passed. Gateway checks reject malformed sessions and public keys, strip client-supplied session hashes and keep server credentials out of responses.
- Existing POS browser flows passed during regression checks. Real Owner sign-in and hosted API checks passed. Concurrency and full account lifecycle checks remain pending.

## Module and action permissions

Permissions are grouped into POS (including shifts and cash), Attendance, Inventory and Admin. Every action requires both its saved action grant and module access. Denying a module preserves action settings but blocks effective access; re-enabling restores those settings. Owner grants are protected. Current defaults preserve POS and personal Admin access; Attendance access is prepared for all roles and Inventory access for Supervisors/Owners. Attendance and Inventory actions will be defined as those modules are implemented. These settings do not imply that those apps or POS server enforcement are already operational.

`supabase/module-permissions.sql` is the deployed incremental migration. The canonical schema includes matching rules. `supabase/module-permissions.verify.sql` tests module denial, action denial, scoped snapshot filtering, restoration and service-only execution using temporary fixtures, then rolls everything back. Live verification passed.

The Admin UI uses Tailwind CSS with shadcn-style surfaces and shared Radix Select, Checkbox and Dialog primitives. Custom selects support keyboard navigation and type-ahead; dialogs trap focus and become bottom sheets on phones. Native text/PIN inputs retain mobile keyboards, autofill and password-manager support. The POS shares the new modal and receipt-discount controls. Dependencies are pinned with the npm lockfile.

Verification for this change: shared and gateway suites, TypeScript and both production builds passed; 20 account/POS browser checks passed and the two added keyboard/focus checks passed after correcting their test expectations for Radix hidden form elements. The live transactional module/action verification passed without retaining test fixtures. Security advisors reported only the existing service-only RLS informational notices. CI now runs the browser regression suite.

## New staff form

Creating a user requires an explicit Cashier or Supervisor selection; Owner is excluded from creation and rejected by the API. New accounts are always active and unassigned. Site assignment and status controls remain in the edit form. Temporary six-digit PINs are generated with browser cryptographic randomness, with regenerate/copy actions, and are not persisted by the local preview. The backend stores a bcrypt hash and requires a PIN change on first sign-in. Clipboard errors allow manual copying. `supabase/create-user-defaults.sql` updates the deployed RPC and canonical schema; its verification script rolls back every test fixture.

## Users directory

The Users page has an icon-only Create new user action, a search/status-filter row (active only, inactive only or all), and a separate role selector. The visible accounts are grouped by role and sorted by name with locale-aware comparison and username tie-breaking. Empty role groups are omitted. Selecting a row opens a read-only details sheet with name, username, role, status and assigned sites. Edit and PIN reset actions appear according to the existing permission rules; editing starts from the details sheet. All sixteen Admin phone/desktop checks passed, including combined filters, grouping/sorting, keyboard activation and scoped details/edit access.

The creation sheet now keeps PIN, regenerate and copy controls in one row. Its icon + Create User action is in a non-scrolling dialog footer, outside the scrolling form body, with mobile safe-area padding. Editing retains its Save changes action. Browser checks cover the footer remaining visible and stationary on a short screen while the form scrolls, plus PIN actions and submission.

### App title bar

The shared title bar shows the icon-only brand mark, single-line “OneBite - Admin” title, borderless sync control and profile badge. The Radix profile menu opens the signed-in user's details and provides Khmer/English, persisted light/dark appearance, and sign out.

Admin writes save online immediately. The number centered inside the sync icon counts the live save currently in flight (one at a time), then returns to zero when the request settles. The icon rotates while saving or refreshing, turns green with a central check after success, and red with a central alert after failure. A failed edit stays in its form for retry; there is no background offline queue. Pressing sync refreshes the server snapshot. Local preview remains local and does not claim successful server synchronization.
