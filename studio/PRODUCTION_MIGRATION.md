# Cloudflare production migration

Status: in progress. The public Vercel portal is still the browser-local demo. Do not tell residents to use it as the shared production system yet.

## Requested outcome

Keep all existing portal functionality and the approved visual design. Deliver real resident registration, administrator approval, protected accounts, shared information, reliable SUM reservations, private conversations, finances, documents, meetings, polls and building services on Cloudflare. Deliver a permanent entry URL and printable elevator QR materials after end-to-end verification. Report the actual changes and remaining operational setup, without claiming a partial migration is complete.

## Verified resources (2026-11-23)

- Repository: C:/Users/Nicolas/Projects/portal-del-edificio.
- Branch: codex/cloudflare-produccion, based on ba2aa1b.
- Cloudflare CLI OAuth is connected to the user's existing account.
- Account ID: 92bcfb4026bf4c1ceb4ccc96ad76a3b5.
- Dedicated D1 database: portal-edificio-produccion, ID 75730a9d-c31d-4edb-a56b-2b9e874964ed.
- Migration 0001_production.sql applied successfully both remotely and locally. No resident/demo rows imported. 52 units are preloaded.
- Private R2 bucket: portal-edificio-archivos, created successfully. No public access configured.
- Wrangler configuration includes Workers static assets, D1 and R2. No Worker deployment yet.

## Implemented foundation

- D1 tables for accounts, sessions, recovery tokens, settings, reservations, content entities, messages, polls, reading confirmations, files, rate limits and audit events.
- Database triggers prevent overlapping confirmed reservations at insertion/update, including concurrent requests. Adjacent bookings are allowed; cancelled bookings release availability. Blocked dates cannot silently invalidate a confirmed booking.
- Server booking validation uses explicit Buenos Aires time for past-start checks; opens 08:30 daily, closes 01:00 next day except Friday/Saturday 03:00. Half-hour choices allow arbitrary multi-hour duration.
- Worker endpoints: health, session, register, login, logout, admin approval/rejection/suspension, reservations, public/private state, settings, messages, entity CRUD and protected file upload/download.
- Passwords use scrypt (N=16384, r=8, p=5). Session secrets are hashed in D1, stored in Secure HttpOnly SameSite cookies, and revoked when an account is disabled.
- Owner actions derive the unit from the authenticated session. No browser flag can grant server permissions.
- Optimistic locking prevents lost entity edits. Financial mutations are logged with prior/new data.
- General entity CRUD is admin-only; owners may create their own issues/topics. Uploaded files are checked by MIME/signature and restricted by unit.
- Frontend now supports explicit VITE_PORTAL_MODE=production: shared API provider, secure session gates, owner registration, admin approval, SUM and private chat. Demo remains the default build mode; public Vercel is unchanged. Several other mutation handlers still need await/error integration before release.

## Integration verification (2026-11-23, current worktree)

- Production browser test runs a fresh isolated D1 database and Wrangler with HTTPS, builds production assets, and uses three isolated Edge contexts at 390x844. Browser plugin/skill is absent; regular Playwright is used. This is mobile viewport emulation, not physical iPhone verification.
- Verified registration from /login?mode=register, admin approval in a separate context, unit/password login, shared SUM reservation and owner-to-admin private chat.
- A second owner can see reservations but cannot read another unit's chat or cancel its reservation. Two concurrent API requests with separate authenticated browser sessions against real local D1 yield exactly one 201 and one 409. Cancellation releases the interval for the other owner.
- Injected reservation API 503 leaves selected times intact and does not show success; retry succeeds. Accepted SUM rules are sent from the actual checkbox snapshot instead of the provider's latest state. Closing the confirmation is prevented while saving.
- Secure session browser test requires HTTPS; HTTP loopback did not retain the secure host cookie. No insecure production-cookie exception was introduced.
- Late session refresh/401 responses cannot overwrite a newer login. Registration UI now matches the server's 12-character minimum (demo remains 8).
- worker/api.test.mjs: 5 tests pass, including participation uniqueness, closed ballots, immutable options after votes, idempotent notice reads/interests and topic comments. worker/booking.test.mjs: 6 tests pass. worker/production.browser.test.mjs: 1 full scenario passes including privacy, concurrency and failure retention.
- Typecheck passes. Lint has no errors and one react-hooks cleanup-ref warning in usePortal.tsx. Browser fixture builds production with Vite; full final release checks remain required.
- Migration 0002_participation.sql is verified in isolated test databases, NOT yet applied to remote production. No Worker release or QR has been published.
- Finance forms now await server save/delete/publish, retain error/input, prevent duplicate submit and prevent modal closing during saves. Expense editor selects an actual unit (blank initially in production), checks uniqueness per unit/month and does not allow moving an existing PDF/liquidation to another unit. Admin sees all current-month liquidations and can filter by unit.
- Extended local HTTPS browser scenario passes movement-save failure retention/retry/shared amount, PDF creation/upload to local R2, two unit-specific liquidations for the same month, owner-only expense state and 404 on another unit's private PDF. Browser PDFs are generated test artifacts, not resident documents.
- Existing npm run test:unit passes all 21 tests after making the Vite mode lookup safe in non-browser test runners. Typecheck passes. Budget/opening-balance/delete handlers were converted but still need browser failure coverage.
- Financial import now uses /api/import/movements: validate all rows, one D1 batch transaction, stable request ID + content hash, stored receipt, server-side movement identity matching the existing normalized frontend key. Manual create/edit also recomputes this identity. Imports omit duplicates without swallowing other database errors; changed payload reuse is rejected.
- Migration 0003_financial_imports.sql adds the movement unique index and import receipts. Verified only in fresh test databases, NOT remote production. Before applying to a nonempty database, check/backfill legacy movements missing movementKey; the original production DB was empty but must be rechecked before release.
- API test verifies all-or-nothing validation, 500-row batch, 501-row rejection, repeat request, changed payload, duplicates within batch/across manual entries and rollback after an induced audit-write failure. worker/api.test.mjs now passes 6 tests.
- Extended HTTPS browser test uploads CSV through actual import UI, lets Worker/D1 commit then replaces its response with 503, retries the same request and observes exactly two imported movements. Two concurrent imports of the same movement into local D1 yield one created row total. No production resources were mutated by these tests.
- Notices, generic content editor (documents/works/etc.), meetings, polls, topic proposals/comments/review and topic interests now await server mutations with a shared guarded action hook. Failures remain visible and forms do not close on failure; pending submissions cannot be duplicated. Poll edits retain the opened version for conflict detection instead of adopting a background-refresh version. Clearing a poll due date now sends an explicit empty value.
- Production notices are private by default. Admin must explicitly enable the public-page checkbox; anonymous state returns only opted-in notices and removes attachment/image links. Read confirmation is owner-only in production, not an anonymous/admin action. API privacy test confirms private notice exclusion.
- Extended local browser scenario verifies failed notice save/retry, private-to-public edit, owner read confirmation, failed document save/retry, authenticated shared PDF vs anonymous denial, meeting creation, poll creation, owner proposal creation and comment propagation to admin. Existing SUM/finance/import/privacy checks remain in the same passing scenario.
- Generic entity editor now sends explicit null for removed attachments. Server preserves listing operation type. usePortal generation cleanup was factored into a callback without changing semantics; current lint and typecheck pass without warnings. Existing 21 unit tests pass.
- Real admin email requested again asynchronously; no answer yet. This is not currently the only remaining work or a reason to mark the goal blocked.
- Settings now carry a server version. Migration 0004_settings_version.sql enforces compare-and-swap inside SQLite/D1; stale opening-balance/rules/date changes return 409 without replacing newer values. Opening balance and rule forms retain the version they opened with. Blocked dates use one JSON insert rather than up to 366 individual DB statements. A reservation insertion also checks the accepted rules against the current rules inside the database transaction.
- Settings API tests verify required version, negative balance rejection, 366 blocked dates, and rollback of version/balance/blocked-date changes when an overnight reservation occupies the requested day. Local HTTPS browser test confirms two simultaneous settings updates yield one 200 and one 409 and a stale open balance form retains the entered amount without overwriting the winning value.
- Migration 0005_issue_history.sql records issue status events with server date/actor in the same transaction as the change. Private state merges these events into issue conversation. Server rejects unknown statuses; owners cannot update status or supply history. Frontend shows failed status changes and waits for confirmed creation; production issue form no longer claims local-demo behavior.
- API history tests verify private ownership, forged history ignored, stale edit rejected without a spurious event, close/reopen preserving original chat, and messages denied while resolved. Local HTTPS UI scenario verifies owner creation, admin in-progress/resolved transitions, shared history and neighbor exclusion. worker/api.test.mjs now has 8 passing tests. Lint/typecheck are clean.
- Migrations 0004/0005 are only applied to fresh local test databases. No production migration/deployment/QR was issued in this turn.
- Assisted owner recovery is implemented without pretending email delivery exists: anonymous unit/email request yields a generic response; approved accounts appear in the admin recovery filter. Admin verifies identity, re-enters their own password and generates a 30-minute, one-use link to share through the registered email or another verified channel. The UI explicitly says it does not send automatically.
- Migration 0006_recovery.sql adds requests and password-change revocation triggers. Reset secrets are 256-bit random, only SHA-256 digests persist. Links use a URL fragment removed from browser history on screen entry. Issuing a new link invalidates earlier ones; password update atomically rechecks expiry/status/use, invalidates all tokens/sessions and resolves the request. Suspended/pending accounts cannot recover via this flow.
- API suite passes 9 tests, including unknown-account generic response, admin reauthentication, token replacement/expiry/replay, short password rejection, old credential/session denial and suspension. Local HTTPS UI scenario verifies request -> admin generation -> reset -> fresh login and old session denial; two concurrent resets against local D1 yield exactly one 200/one 409. The D1 mutation success check accepts positive changes because triggers also modify related rows; SQLite unit adapters report direct row changes only.
- A same-route fragment navigation bug was caught and fixed: opening a recovery link from an already-open login page now switches to the reset form. Existing 21 unit tests, typecheck and lint pass. No real recovery links or personal accounts were issued; tests use isolated databases and invented identities.

## Evidence so far

- worker/booking.test.mjs: 6 passing tests covering all days/opening/closing, malformed values, past starts, overlap, cancellation, overnight restrictions, independent-connection concurrency, session revocation and unit uniqueness.
- worker/api.test.mjs: registration/approval/private session/suspension, identity-bound reservations/cancellation, logout/forged session tests passed. Additional private data/stale edit coverage added; run all tests again after further edits.
- worker/runtime.test.mjs ran against local Wrangler successfully: D1 health, anonymous admin denial, empty public state, scrypt registration, pending login rejection. The local 9C test request remains only in .wrangler local state. Re-run this test in a clean isolated local database to avoid duplicate unit registration.
- Wrangler deployment dry-run passed before addition of the R2 route; repeat after final integration.
- Existing frontend typecheck passed. eslint-plugin-react-hooks was missing from declared dependencies and has been added; lint passed before latest data/CRUD additions.

## Next work (required, not optional scope reduction)

1. Finish API: full per-collection validation and remaining attachment/message permission tests. Issue status history, financial import conflicts, ballots, reading confirmations, interests/comments and message attachments are implemented. Basic R2 unit/building privacy has browser coverage; remaining attachment edge cases and deletion/retention need coverage.
2. Finish administrator onboarding/recovery and operational instructions. Assisted owner recovery is implemented and locally verified; automatic email is not configured and must not be claimed. User has been asked which email will administer the building; no answer yet. Do not assume their Cloudflare account email is the building administrator. No admin/admin or shared 7B bypass in production.
3. Finish role navigation and production labels. React provider/auth gates and loading/error states are connected; production never falls back to seed/localStorage on API failure. Audit refresh races and stale mutation responses across login/logout.
4. Convert every save/update/remove/form handler to await confirmed server success. Retain input on network/validation failure and prevent double-submit. SUM success must only be shown after atomic server confirmation.
5. Expense unit selection/per-unit-month checks, shared PDF privacy, atomic/idempotent finance import and opening-balance concurrency are locally verified. Complete budget/delete browser coverage; preserve all existing finance/import/document features.
6. Remove misleading demo labels, counts, seeded messages and fallback 7B from production. Explicit public notice visibility is implemented and tested; review other public/owner surfaces and real contact behavior. Keep formal voting claims honest (no implied legal validity).
7. Complete runtime/API/browser tests with two isolated resident browsers and an admin: approval, private messages, concurrent SUM booking, overnight/day restrictions, cancellation/rebooking, files, accounts, notices, polls, logout, suspension, recovery and failure states. Test real iPhone/browser behavior when available; emulated standalone is not physical-device evidence.
8. Audit and resolve dependency findings: npm audit reported Vite <=6.4.3/source-map-js plus dev advisories. Review update compatibility and run full checks before release.
9. Build/deploy to Cloudflare only after the app is integrated. Verify actual CPU limits for scrypt under the user's Workers plan; local runtime hashing took about 270ms, so free-plan CPU limits may require attention. Do not silently weaken password hashing.
10. Confirm real admin email, actual contacts, SUM rules, opening balance/documents and building data with the responsible administrator. Leave honest empty states for unknown information. Production database currently has no rules, so reservations correctly remain disabled until rules are loaded.
11. Verify backups/restore, operational logs, private data access, enrollment/recovery and session expiry. Document ongoing operation.
12. Establish canonical Cloudflare URL, handle the old Vercel entry deliberately, produce printable QR poster linking to canonical /login?mode=register, validate QR decoding and mobile flow. Avoid issuing QR to a temporary preview URL.
13. Final full build/typecheck/lint/tests, mobile/desktop rendered QA and production multi-browser smoke. Commit/push and report canonical URL and all changes. Goal remains active until all requirements are proven.

## Last goal turn classification

Progress: implemented assisted owner recovery with admin reauthentication, one-use expiring tokens, atomic session revocation and local UI/API/concurrent D1 tests. API suite passes 9 tests; extended browser flow passes; lint/typecheck and 21 unit tests pass. No repeated blocker. Real admin email/onboarding remain pending; full validation, production cleanup, dependency audit, operations and release work remain independent.
