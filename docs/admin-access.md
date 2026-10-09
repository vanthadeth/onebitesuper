# Admin access — first implementation step

Updated 9 October 2026. Project: `iizosglpofempyjvepyr`.

## Current status

Users, Site, Roles, Permissions and change history are implemented in the Admin app. The local preview persists sample profiles and permission changes on this device, with a visible preview banner and role switcher. PIN reset and provisioning are unavailable in preview.

Supabase requests recovered on 9 October 2026. The eight-table schema and `admin-access` Edge Function were deployed, and the Admin environment contains only the project URL and public publishable key. The first active Owner account (`owner`) has been created and its real sign-in verified. No staff accounts have been provisioned. Database checks confirmed RLS on every app table, denied browser access to credentials/RPCs, rejected unauthenticated sessions and prohibited Owner refund permissions. A broader transaction verification request was cancelled and is not counted as passed. The cloud environment blocks direct requests to the project host; hosted GitHub checks verified real browser-to-API requests, first-Owner setup readiness and unauthorized request rejection on phone and desktop.

The app is committed to GitHub and hosted on Pages. Supabase connection work has resumed at the user’s request. The first-Owner setup code has been consumed; public signup remains unavailable.

## Access rules

| Role | Account access |
| --- | --- |
| Cashier | Own profile; operational permissions at assigned sites |
| Supervisor | Own profile and Cashiers at managed sites; can change existing staff assignments within those sites, preserving outside assignments |
| Owner | Manage accounts, status, site assignments and role permissions; reset PINs |

Owner access is protected. At least one active Owner must remain. New staff accounts start active with no assigned sites. Site operations remain restricted to assigned active sites; once assigned, removing every active site is blocked while the account remains active. Usernames are normalized and unique across all accounts, including inactive ones. Owners may configure every available permission for built-in and custom roles. Owner Admin access, account management and role management remain required to preserve recovery. Refunds, cancellation of paid invoices and discount-limit overrides are forbidden for every role.

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

Permissions are grouped into POS (including shifts and cash), Attendance, Inventory and Admin. Every action requires both its saved action grant and module access. Denying a module preserves action settings but blocks effective access; re-enabling restores those settings. Owner account and role administration are protected; other available Owner grants are configurable. Current defaults preserve POS and personal Admin access; Attendance access is prepared for all roles and Inventory access for Supervisors/Owners. Attendance and Inventory actions will be defined as those modules are implemented. These settings do not imply that those apps or POS server enforcement are already operational.

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

### Save conflict recovery

A stale global revision no longer blocks edits to unchanged records: Admin refreshes the snapshot and retries once with the current revision. User creation still runs the server's duplicate-name and permission checks. User/site edits and permission changes retry only if their target matches the original snapshot. Changes to the same record keep the draft open and offer **Reload latest · Discard this draft** inside the dialog for explicit review. Credential resets are never automatically retried. Network errors remain errors and are not replayed automatically.

Live database checks verified Owner saves and staff creation/editing/assignment with every change rolled back. Browser regression checks cover stale-revision recovery and preservation of conflicting drafts.

The deployed Edge gateway now logs rejected actions and RPC status/error codes. Logs exclude submitted profiles, PINs, session tokens, database error details and server keys. The diagnostics identified SQLSTATE 21000: the API authenticator preloads `safeupdate`, which rejected the shared revision update because it lacked a WHERE clause.

### Shared save failure fix

All Admin writes reached an unscoped settings revision update. Supabase's API connection rejected it with `UPDATE requires a WHERE clause`, while management SQL sessions lacked that safety preload and passed earlier checks. The deployed migration `require_settings_update_where` adds `WHERE id=true` to revision and bootstrap settings updates without disabling the API safety setting. Canonical and standalone deployment SQL include the same correction. Live transactional tests passed for staff creation, edits and assignments; fixtures rolled back and service-only execution privileges were preserved. Loading `safeupdate` directly into the management verification session is prohibited by the hosted library allowlist, so verification also checks the deployed function contains the constrained statements.

### Separate site assignment

User edit contains profile, role and active status fields. It preserves current assignments. User details offers a separate **Assign sites** action for Owners and authorized Supervisors managing Cashiers in their sites. The assignment sheet uses the existing `sites.assign` operation, preserves out-of-scope assignments, and requires an active site for active staff. Owner accounts use all sites and do not have an assignment action. Assignment save and stale-conflict recovery are independent of profile editing.

### Compact role list

Roles appear as collapsed disclosure rows with an icon, role name and short description. Expanding a row shows the modules currently allowed for that role and a **Review permissions** action. Module visibility follows effective permissions and updates immediately after saving policy changes. The disclosure buttons support touch, Enter/Space, visible focus and reduced motion, in Khmer/English and light/dark themes.

### Minimal permission editor

Each module has a title and an Allowed/Denied Radix switch. Its action list appears only while the module is allowed; denying the module retains the stored action settings for restoration. Each action uses an icon, short label and switch. Unreleased and business-forbidden permissions are disabled and greyed out. Owner account and role administration remain required. Save permissions stays in the dialog's fixed footer while the sections scroll.


### Custom roles and consistent page headers

Admin pages share a title/subtitle header with a right-side action slot. Users defaults to Active only, including after clearing filters. Roles uses the title **Roles** and an icon-only **Create new role** action for authorized role managers. New roles require a unique name (60 characters maximum), support an optional short description (160 characters), start with denied permissions, and are persisted with their grants. They are immediately available in user creation/editing, directory filters and the permission matrix.

Role-specific ceilings no longer prevent Owners from granting available permissions. Permission grants control user and role management; site operations for non-Owners remain limited to assigned active sites. Non-Owners cannot alter Owner accounts or the Owner role. Attendance, Inventory, Items & prices, and Promotions & exchange rate are currently unavailable; their controls are greyed out and cannot be newly enabled. Legacy prepared grants are retained but have no effective access while unavailable. Refunds and discount overrides stay forbidden. Owner Admin access, user management and role management stay required.

`supabase/migrations/20261009103925_custom_roles_and_permission_availability.sql` adds a private RLS-protected role catalog and foreign keys, updates permission checks and snapshots, and adds the audited `role.create` action. Browser access to tables and internal RPCs remains revoked. Changes use the existing global revision lock and invalidate affected sessions; the actor's session is retained when updating their own role. `supabase/custom-roles.verify.sql` verifies these rules against the live RPC in a transaction and rolls back all fixtures.

Live migration and RPC verification passed on 9 October 2026 after refreshing the Supabase connector. The gateway is deployed as `admin-access` version 4. Security advisors report only the expected informational RLS-with-no-policy notices for service-only tables. Every verification fixture and permission change was rolled back. A snapshot capability check keeps custom role creation and expanded controls disabled until the connected backend includes the role catalog; syncing unlocks them.

### DaisyUI visual polish

Admin and POS share DaisyUI 5.7.47, custom OneBite light/dark themes, Google Sans, and prefixed `d-` component styles. The prefix avoids collisions with existing layouts. Buttons, fields, select triggers, cards, badges and notices use DaisyUI; Radix maintains dialog focus, keyboard selection and accessible switches. Shared polish styles preserve 48px primary touch targets and mobile sheets. On screens wider than 680px, Admin's sidebar shows only the logo and its title bar shows only the app title; phones keep the header icon.

### Site management

Admin now includes **Site**, with the subtitle “Manage locations and operating details.” The page lists every site by name, including inactive sites, and has an icon-only New Site action plus a prominent create action when the list is empty.

Site creation and editing require a name, location, and running-from date. Coordinates are optional; enter both latitude (−90 to 90) and longitude (−180 to 180), or leave both blank. Use my current location requests device location only after a tap, fills both fields, and explains denied access, timeouts, or unavailable location. Running from defaults to today in Asia/Phnom_Penh. Optional fields include a weekly operating schedule, remarks, and shutdown date. Schedules support overnight operations; equal opening and closing times are rejected. Shutdown must be on or after the running-from date. Dates describe the operating period; the explicit Active setting controls availability. New sites always start active, and Active is displayed only when editing.

The existing `sites.manage` action is available under the Admin module and can be delegated by the Owner. Both Admin module access and this action are checked on every live write. Site edits use the global revision check and retry once only when the original site is unchanged. Deactivation preserves staff assignments and audit history; active-site checks continue to restrict site operations. Existing sites retain their IDs and assignments. Their location and coordinates can be completed through Edit.

Backend: `site.create` and `site.update` on the existing admin-access Edge Function; additive migration `20261009112442_manage_sites.sql`, followed by `20261009120002_optional_site_coordinates.sql` for optional coordinates. Direct browser table access remains revoked with RLS enabled. `supabase/manage-sites.verify.sql` verifies real RPC behavior inside a rollback transaction, including validation, duplicate names, delegated permissions, module denial, stale writes, and preserved assignments.

Large-screen refinements: New actions show text beside their icons, and Roles use a responsive card grid with allowed modules and Review Permissions visible. Phones retain icon-only New actions and expandable role rows. Site uses left-aligned cards with a photo placeholder, name, location, and active-status badge. Actual site-photo upload is not implemented yet.

Site editor layout: the current-location action sits below the latitude/longitude fields. Working days & hours and Operating period are accessible collapsible sections, closed by default for both creation and editing; collapsing preserves their values. Shared popups keep the title and close control above the scrolling body and keep action footers visible below it.
