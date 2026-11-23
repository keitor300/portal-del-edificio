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
- Frontend has not been switched to these endpoints. Current forms remain demo-local until the integration below is finished.

## Evidence so far

- worker/booking.test.mjs: 6 passing tests covering all days/opening/closing, malformed values, past starts, overlap, cancellation, overnight restrictions, independent-connection concurrency, session revocation and unit uniqueness.
- worker/api.test.mjs: registration/approval/private session/suspension, identity-bound reservations/cancellation, logout/forged session tests passed. Additional private data/stale edit coverage added; run all tests again after further edits.
- worker/runtime.test.mjs ran against local Wrangler successfully: D1 health, anonymous admin denial, empty public state, scrypt registration, pending login rejection. The local 9C test request remains only in .wrangler local state. Re-run this test in a clean isolated local database to avoid duplicate unit registration.
- Wrangler deployment dry-run passed before addition of the R2 route; repeat after final integration.
- Existing frontend typecheck passed. eslint-plugin-react-hooks was missing from declared dependencies and has been added; lint passed before latest data/CRUD additions.

## Next work (required, not optional scope reduction)

1. Finish API: ballots (one per unit), reading confirmations, topic interests/comments, issue chat/status transitions, file attachments in messages, version conflicts for financial import, full validation and API tests. Current messages route only supports text; state does not yet hydrate attachments/interests/topic comments.
2. Add secure password recovery and administrator onboarding. User has been asked which email will administer the building; no answer yet. Do not assume their Cloudflare account email is the building administrator. No admin/admin or shared 7B bypass in production. Need an email delivery mechanism or fully verified alternative recovery workflow.
3. Connect React provider and auth gates to shared API, with explicit loading/error states, correct role-based navigation and same-window mobile access. Preserve existing demo separately if useful; production must never fall back to seed/localStorage on API failure.
4. Convert every save/update/remove/form handler to await confirmed server success. Retain input on network/validation failure and prevent double-submit. SUM success must only be shown after atomic server confirmation.
5. Fix hardcoded 7B expense editor and uniqueness check: select unit, per-unit/month liquidation, correct visibility. Use shared money totals; preserve all existing finance/import/document features.
6. Remove misleading demo labels, counts, seeded messages and fallback 7B from production. Public notices must be explicitly publishable without exposing private resident documents; introduce visibility controls where needed.
7. Complete runtime/API/browser tests with two isolated resident browsers and an admin: approval, private messages, concurrent SUM booking, overnight/day restrictions, cancellation/rebooking, files, accounts, notices, polls, logout, suspension, recovery and failure states. Test real iPhone/browser behavior when available; emulated standalone is not physical-device evidence.
8. Audit and resolve dependency findings: npm audit reported Vite <=6.4.3/source-map-js plus dev advisories. Review update compatibility and run full checks before release.
9. Build/deploy to Cloudflare only after the app is integrated. Verify actual CPU limits for scrypt under the user's Workers plan; local runtime hashing took about 270ms, so free-plan CPU limits may require attention. Do not silently weaken password hashing.
10. Confirm real admin email, actual contacts, SUM rules, opening balance/documents and building data with the responsible administrator. Leave honest empty states for unknown information. Production database currently has no rules, so reservations correctly remain disabled until rules are loaded.
11. Verify backups/restore, operational logs, private data access, enrollment/recovery and session expiry. Document ongoing operation.
12. Establish canonical Cloudflare URL, handle the old Vercel entry deliberately, produce printable QR poster linking to canonical /login?mode=register, validate QR decoding and mobile flow. Avoid issuing QR to a temporary preview URL.
13. Final full build/typecheck/lint/tests, mobile/desktop rendered QA and production multi-browser smoke. Commit/push and report canonical URL and all changes. Goal remains active until all requirements are proven.

## Last goal turn classification

Progress: created real Cloudflare D1/R2 resources, applied schema, implemented server foundation and passed database/API/runtime tests. No repeated blocker. Email answer is pending but considerable integration work remains independent of it.
