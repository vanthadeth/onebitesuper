# Operational transaction foundation — first build

Built 13 October 2026. This is the first implementation slice of roadmap stage 1, not completion of the full stock/sales milestone.

## Available shared modules

- `@onebite/core/operations`: immutable operation envelopes, SHA-256 payload fingerprints, scope checks, dependency-aware replay, typed retry/auth/review failures and pending/review/acknowledged counts.
- `@onebite/offline/operations`: encrypted SQLite workspaces persisted in IndexedDB, an origin-local device ID, atomic projection+event commits, revision checks and a replay-store adapter.

A workspace is scoped by actor, site (null for a future stockroom context) and device. A projection is the local business state derived by a future workflow. Its changed state and new immutable event are saved in one durable SQLite file snapshot before the commit promise resolves. They cannot be saved separately through this API.

The original event ID, scope, dependencies, timestamps, payload and fingerprint stay fixed across retries. Only delivery metadata changes. Record states are Pending, Sending, Acknowledged and Review. Dependencies must exist in the same workspace before the dependent operation is committed; external dispatch references belong in validated business payloads, not cross-device local dependencies.

## Persistence and retry guarantees

- Actor-bound AES-GCM encryption protects business payloads and projections at rest, with the workspace scope authenticated as additional data. Same-origin malicious code can still access browser keys; this is not an XSS protection or server authorization mechanism.
- Web Locks serialize tabs where available. A compare-and-set IndexedDB transaction also protects the SQLite file when Web Locks are unavailable. Concurrent stale writes reject instead of overwriting another tab.
- Actor keys use first-writer-wins creation. The durable origin-local device ID is not server registration or ordering authority.
- Projection revisions reject stale local business edits. Repeating an already committed operation with the same fingerprint returns the existing state without applying its projection again. A changed fingerprint or globally reused operation ID conflicts.
- Storage/quota failures reject the commit and leave the previous durable projection and events unchanged. Encryption/decryption errors propagate rather than being treated as an empty workspace.
- Replay checks scope/integrity and calls the supplied authorization check before each operation. An auth failure stops delivery and preserves pending work.
- A matching ID/fingerprint receipt with a reference and acknowledgment timestamp is required to mark acknowledged. Invalid receipts enter review. Dependents wait; independent eligible events may continue.
- Temporary failures retain the immutable event and schedule exponential retry, from one second up to one minute. The runner does not sleep or retry endlessly within a call; a future app lifecycle adapter schedules subsequent calls.
- A persisted Sending event can be retransmitted after an interrupted process. Delivery is **at least once**. Exactly-once business effects require the server transaction/idempotency implementation; the client queue alone cannot guarantee them.
- A lost response after server commit retries the original ID. A failure saving the local acknowledgment leaves the event recoverable; it does not reclassify a successful server commit as a business rejection.
- Acknowledged receipts remain in the workspace. There is no public clear/delete function. This foundation therefore preserves pending records across account switches/session renewal and does not tie them to session-token expiry or Admin cache cleanup.

## Integration contract

A future feature must:

1. Verify cached/current authorization, site/device/shift state and the 24-hour operational window before creating an operation. This module does not extend the seven-day session or offline deadline.
2. Validate its business payload and calculate the local projection using its actual rules. Money remains integer/fixed precision and material quantities need exact decimal representations; the generic JSON envelope is not a money/stock calculator.
3. Create a sealed event and call `commitOperationalChange(scope, expectedRevision, nextState, event)`. Show success only after persistence resolves; do not clear a cart on failure.
4. Supply an authenticated transport and authorization callback to `replayOperations`. Network availability alone is insufficient authorization.
5. On the server, validate the actor/site/device/shift and supported event schema, verify the canonical fingerprint, enforce a unique operation ID and stored payload identity, and atomically apply ledger changes plus the replay receipt. The fingerprint is an integrity identifier, not proof that a user may act.
6. Treat a repeated matching ID as receipt lookup, never a second business effect. Report changed payloads/rejected rules through a review flow that retains original data.
7. Reconcile receipt acknowledgments and refresh full authoritative state before advancing the offline authorization window. Merely draining this queue does not establish a full sync.

Consumers must not run simultaneous replay loops as a normal pattern. Revision checks prevent local corruption, but overlapping loops can retransmit an event; the server idempotency contract is still mandatory.

## Current boundaries and next work

The following [central stock slice](central-stock.md) now imports these modules for opening/receiving and supplies a deployed private API/stock ledger. Existing Inventory catalog publishing and POS drafts remain separate. Device claim, cash ledger and POS financial posting are not enabled; checkout remains gated. No mock records were inserted.

The central opening/receiving integration has shipped with explicit action grants and authoritative payload checks. Device/shared-shift workflows and live invoices follow the roadmap dependencies; site transfers/counts need their own location and posting rules.

Before live rollout, implement acknowledged-receipt archival/compaction, bounded projection retention, review/correction UI and update/recovery handling. The present conservative cap is 1,000 retained events per workspace (including acknowledgments); reaching it blocks new commits rather than dropping history. Event payloads are bounded to 256 KB, projections to 1 MB, and the serialized workspace to 8 MB. These are foundation limits, not a production throughput promise.

## Verification

- Core tests cover canonical payloads and mutation rejection, dependencies, scope checks, lost responses/idempotent simulated server effects, interrupted Sending recovery, per-operation authorization, invalid receipts, safe error codes and failed local acknowledgments.
- Real browser tests on phone/desktop cover encrypted SQLite storage, reload/device identity, actor/site isolation, stale writes, simulated quota failure rollback, immutable updates, duplicate local commit, lost-response recovery and simultaneous tabs without Web Locks.
- The browser harness is under `tests/fixtures`; production apps do not import it or expose its test API. Server responses in these tests are simulated and are not verification of a deployed posting endpoint.
- Run `npm test`, `npm run typecheck`, `npm run build`, and `npx playwright test tests/operations.spec.ts --workers=2`.
