# OneBite security audit and remediation plan

Audit date: 9 October 2026 (UTC). Source baseline: `42681c74d187019abc0e5580490c98cb06c63fc8`. Supabase project: `iizosglpofempyjvepyr`; deployed `admin-access` function version 8.

This was a read-only review of source, deployed Edge Function code, database metadata and selected function definitions. A privilege-escalation reproduction used in-memory local fixtures only. No real credentials were tested, no live records were changed, and no exploit or load testing was performed.

## Assessment

Admin has useful security foundations, but needs stronger authentication and explicit controls on delegated administration. No critical vulnerability was confirmed. One high-impact permission escalation was confirmed in code and reproduced locally; its prerequisite is not currently enabled for non-Owner roles in the live database. POS is a local preview and must not be treated as a secure financial system yet.

## Findings

### 1. High: delegated administration can exceed the actor's permissions

`saveGrants` checks `roles.manage` and protects the literal Owner role, but allows a non-Owner to add available permissions to their own role. The database API mirrors this behavior and retains the actor's session after an own-role change. Availability ceilings restrict unreleased features, not the actor's authority to delegate.

Local reproduction: Owner gives Supervisor only `admin.access` and `roles.manage`; Supervisor then adds `users.manage` and `settings.manage` to Supervisor. Both previously absent permissions become effective. Live metadata confirms the relevant guards and session-retention behavior. Currently **zero non-Owner roles have `roles.manage`**, so this path depends on future delegation or a changed configuration.

Account creation, role reassignment and PIN resets also need a consistent target-privilege policy: `users.manage` must not implicitly allow taking over or assigning more privileged custom roles.

Evidence: `packages/core/src/access.ts:155`; `supabase/migrations/20261009130115_app_settings.sql:205`; account update logic in the same migration.

Fix: initially reserve grant editing and role creation to Owner. If delegation is required later, enforce an explicit delegable-permission set on the server, prohibit self-escalation, and prevent managing accounts above the actor's authority. Define protected roles by policy, rather than only matching the name Owner. Revoke affected sessions consistently.

Acceptance: negative API tests must reject self-escalation, privileged-role reassignment, privileged-account PIN reset and creating a stronger account; ordinary authorized user administration must still work.

### 2. High priority: exposed credentials and weak privileged authentication

A Vercel access token and initial Owner PIN were shared in the conversation. This confirms exposure, not that either is still valid. Live metadata shows Owner is not required to change its PIN; it does not establish the current PIN value, which was neither retrieved nor tested.

The app uses a six-digit PIN for privileged administration. Bcrypt cost 12, a one-second per-account throttle and a five-failure/15-minute lockout are present, but no application-level per-source or global login rate limit is implemented. Attackers can cause targeted account lockouts or distribute attempts across accounts. Different throttling behavior for known and unknown usernames may also reveal account existence.

Evidence: `supabase/migrations/20261009130115_app_settings.sql:62`; `supabase/functions/admin-access/index.ts:7`.

Fix now: revoke the exposed Vercel token, replace it only if needed with a narrowly scoped credential, review provider usage, and rotate Owner's PIN through a trusted path. Reject common PINs. Require stronger authentication, preferably MFA or a passkey, for Owner and privileged administration. Keep staff PIN convenience only with appropriate device and session controls. Add per-source, per-account and global abuse limits with uniform unauthenticated responses; do not rely solely on account lockout.

Acceptance: test distributed attempts, unknown usernames, targeted lockouts, privileged reauthentication and credential rotation without using real staff credentials.

### 3. Medium: temporary credentials receive data before PIN rotation

Login and `me` return `onebite_access_snapshot` even when `must_change` is true. The write guard prevents most mutations until PIN rotation, but does not withhold the snapshot. It includes every site's coordinates and remarks, all role grants, and—depending on the temporary account's permissions—other users and activity logs. The snapshot's site list is not filtered by site assignment or site-management permission.

Evidence: `supabase/migrations/20261009130115_app_settings.sql:29`, `:75`, `:83`.

Fix: return only the minimum identity and PIN-change challenge until rotation is complete. Add a server-side visibility policy for site details, especially remarks and coordinates. Public menu/site-selection information can use a separate minimal response.

Acceptance: temporary credentials cannot retrieve business data; users without site-view authority cannot retrieve restricted site fields by calling the API directly.

### 4. Medium: sessions remain valid for 24 hours and logout can fail silently

Live sessions expire after 24 hours. The token is held in memory and JavaScript-readable `sessionStorage`; no server-side idle timeout or privileged-action reauthentication was found. Logout ignores network errors and clears the local session even if server revocation fails. A previously copied token can then remain valid until expiry.

No exploitable XSS was identified in this review. Token storage increases the consequence of a future XSS or compromised same-origin script; it is not itself proof of token theft.

Evidence: `apps/admin/src/access-api.ts:9`; `apps/admin/src/AccessApp.tsx:55`; live session schema.

Fix: introduce inactivity locking for shared devices, shorter renewable sessions and reauthentication for permission changes, PIN resets and sensitive account edits. Prefer a same-origin backend with Secure/HttpOnly/SameSite cookies for Admin. If retaining bearer tokens, document their tradeoffs, minimize their lifetime and surface failed revocation without retaining usable credentials in the interface. Provide Owner with device/session revocation controls.

Acceptance: expired, revoked and deactivated-account sessions fail; idle devices lock; offline logout clearly communicates that server revocation could not be confirmed.

### 5. Medium: production browser hardening is incomplete

Repository deployment configuration contains `nosniff` and Referrer-Policy for Vercel, but no CSP, frame restriction or Permissions-Policy. The active app is hosted on GitHub Pages, which does not apply `vercel.json`. An attempted public header request was blocked by this environment's network proxy, so live response-header absence was **not independently confirmed**.

Admin and POS share an origin. Separate PWA/service-worker scopes do not provide a security boundary between same-origin applications. Edge Function CORS permits every origin; the session guard still applies, so wildcard CORS is not an authentication bypass.

Evidence: `vercel.json:17`; `supabase/functions/admin-access/index.ts:2`; `scripts/pwa.mjs`.

Fix: use a production host supporting response headers, ideally separate Admin and POS origins. Add and validate CSP, `frame-ancestors`, `nosniff`, a deliberate Referrer-Policy and a geolocation Permissions-Policy. Start CSP in report-only mode, then enforce it. Restrict CORS to intended app origins, while continuing to enforce authentication independently.

Acceptance: inspect deployed headers and run browser tests for login, uploads, fonts, PWA updates and offline operation under the enforced policy.

### 6. Medium: security events are not adequately audited

The app records business mutations, but the reviewed login/logout paths do not produce structured security audit events. The live activity log contains mutation events; it is not an authentication history. Missing login failures, lockouts, denied actions and session revocations limit investigation and alerting.

Fix: record authentication successes/failures, throttling, authorization denials, sensitive changes and revocations in a server-only security log. Include request ID, timestamp and appropriate actor/device context; never record PINs, tokens or full credential payloads. Define retention and alerts for repeated failures and privileged changes. Consider append-only or externally retained audit copies.

Acceptance: representative successful and denied flows create useful redacted events; privileged changes can be traced to the actor and session.

### 7. Low–medium: uploads need stronger validation and resource controls

The `site-photos` bucket is intentionally public, accepts JPEG and has a 750,000-byte object limit. Browser writes are not permitted directly. The Edge Function checks size and JPEG start/end markers, but does not decode and re-encode images server-side. It reads the complete request before enforcing its body limit. No application upload quota or orphan-photo cleanup was found.

Evidence: `supabase/functions/admin-access/index.ts:12`, `:40`; live bucket configuration.

Fix: enforce bounded request reads, decode/re-encode images with dimension limits and metadata stripping, limit uploads and remove abandoned/replaced files. Public storage is suitable only for deliberately public storefront photos; use private buckets and authorized short-lived URLs for staff photos or future QR payment references.

Acceptance: malformed images, excessive dimensions and oversized bodies fail safely; abandoned uploads expire; private references cannot be read anonymously.

### 8. Production blocker: POS financial state is only client-controlled preview data

POS currently reads and writes carts, invoices, shifts, configuration and withdrawals through browser `localStorage`. No server-authoritative POS ledger or authenticated financial API is implemented in the reviewed app. Local state can be modified or lost. This is a preview limitation, not a demonstrated attack against a production transaction backend.

Evidence: `apps/pos/src/App.tsx:89`; `packages/ui/src/shared.tsx:51`.

Before accepting real sales: implement authenticated, site-scoped APIs and a transactional ledger. Calculate prices, rounding, discount ceilings and complimentary consumption on the server. Enforce unpaid-only cancellation, no refunds, cash permissions, dual handover confirmation and one ordering device per site. Verify offline operations during sync using idempotency keys, device-bound permits lasting at most 24 hours and replay/conflict controls. Because hard complimentary limits must also hold offline, reserve a bounded allowance for the authorized device before disconnecting. Device changes must reconcile or expire the previous reservation.

Acceptance: editing browser totals cannot change recorded sales; duplicate sync cannot double-charge or double-consume allowance; expired/revoked permits are rejected; concurrent devices cannot exceed site allowances or open competing ordering sessions. Recorded QR payments remain manual declarations, not verified bank settlements.

## Controls that passed review

- All nine OneBite public tables have RLS enabled. `anon` and `authenticated` have no SELECT/INSERT/UPDATE/DELETE access. OneBite RPCs are also not executable by those roles.
- Supabase's security advisor reported nine informational “RLS enabled, no policy” entries and no warnings/errors. For this service-only design, the missing browser policies are deliberate: do not add permissive policies merely to clear the advisory.
- Deployed Edge Function version 8 uses custom opaque-session authentication. `verify_jwt=false` is consistent with that design; enabling it blindly would break authentication rather than fix the authorization issues above.
- Session tokens have 256 bits of randomness, are hashed before database storage, and checked against active accounts. PINs use bcrypt. Role changes, deactivation and PIN resets have session-revocation controls, with the own-role exception described above.
- Mutations use server checks and revision conflicts; the client role selector is not the authority.
- The service worker caches static same-origin assets, not Supabase POST responses. Live Admin account snapshots are not deliberately persisted to localStorage; preview data and preferences are separate.
- `npm audit` reported **0 known vulnerabilities** across 166 dependencies at audit time. This is an advisory check, not a guarantee about all package behavior.
- A pattern scan of 136 tracked files found no candidates for private keys, Vercel tokens, Supabase secret keys or long JWT literals. This was not an exhaustive repository-history, CI-secret or account audit.

## Implementation sequence

| Order | Scope | Completion requirement |
| --- | --- | --- |
| Immediately | Revoke exposed Vercel token; rotate Owner PIN; keep grant management Owner-only; keep POS in preview | Replacement credentials are narrowly scoped; old credentials revoked; no financial rollout |
| Patch 1 | Server authorization, protected-role rules and minimal pre-PIN-change responses | Automated negative API tests cover privilege escalation and unauthorized reads |
| Patch 2 | Abuse limits, stronger Owner authentication, idle locking, shorter sessions and security events | Login abuse tests, session-revocation tests and redacted security logs pass |
| Patch 3 | Production origin/header policy, upload hardening and CI release gates | Deployed browser tests pass with CSP; malformed uploads fail; production deploy requires all checks |
| Before POS launch | Server ledger, site/device authority and bounded offline synchronization | Financial invariants pass tampering, replay, conflict and handover tests |

Keep each patch independently reviewable. Test backend permission denials, not just hidden/disabled UI controls. Pages deployment currently runs its own tests independently of the full E2E workflow; require both workflows before production promotion. Pin third-party workflow actions to reviewed commit SHAs, enable dependency updates and secret scanning, and verify branch/environment protection rather than assuming it is configured.

Recommended policy defaults: only Owner edits grants; privileged Admin requires stronger authentication; all staff/payment-reference photos are private; shared devices lock after a short inactivity period. Set exact timeout and retention values with operational needs before implementation.

## Remaining verification

Provider-level rate limits, Vercel-token revocation, current Owner PIN strength, GitHub branch protection/secret-scanning settings, production response headers, backups/PITR and restore readiness were not verified. Confirm those through provider settings and a restore exercise. No live penetration test, full git-history secret scan or independent malware/supply-chain review was performed.

Reference: https://supabase.com/docs/guides/functions

## Remediation update — 10 October 2026

The remediation implements Owner-only grant control and privileged-target account guards; minimal pre-rotation/MFA responses; authenticator verification with single-use recovery codes and replay protection; eight-hour maximum sessions, ten-minute inactivity checks, memory-only browser tokens and five-minute privileged reauthentication; security events and retention; public/per-account request limits; enforced CSP; JPEG decoding/re-encoding, quotas and expired-photo cleanup; secret/advisory checks, pinned actions and database/browser release gates. POS now requires an explicit sample-only acknowledgment and permanently warns against accepting real sales.

Owner's exposed initial PIN is rotated through a local private recovery file during deployment. The file is ignored by Git and does not appear in this report. The user confirmed revocation of the exposed Vercel token. Vercel denied creation of the header-capable Admin project with a 403 permission error; the response-header configuration is prepared, while GitHub Pages receives the supported meta CSP and application frame guard. Provider branch protection, external alert delivery and backup/restore verification need account-level access. The real POS financial backend remains unimplemented; preview gating contains accidental use and does not make client-controlled records trustworthy.

Verified deployment results: database migration applied through the SQL fallback and recorded in migration history; Owner credential rotated and the old PIN rejected; Edge Function deployed; 29 unit/Edge tests, local database negative checks and 78 browser tests passed. Supabase security advisors reported no warnings/errors (11 informational entries for intentionally service-only RLS tables). GitHub repository administration access was denied, so branch protection could not be verified through this connection.
