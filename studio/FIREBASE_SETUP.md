# Firebase authentication

## State

Update 2026-11-26: Cloudflare is now deployed; migrations 0007-0009 are applied and the first administrator exists. See the release checkpoint in PRODUCTION_MIGRATION.md for live verification evidence. The checklist below is historical setup context, not an assertion that deployment is still pending. Administrators now sign in by username or email; invites use Firebase password-setup email and return to /admin. Owner login remains unit/password.

Firebase project: `portal-del-edificio-13-y-34`, Spark plan. Only email/password authentication is enabled. Cloudflare remains Free. The existing Vercel demo is not changed by this integration.

Firebase and portal both require passwords of 12-128 characters. The Firebase policy is in enforce mode, not notify mode. No paid identity features were enabled.

The browser uses the portal's same-origin API and secure HttpOnly cookies; it receives no Firebase service credential. The server maps unit -> approved D1 account -> immutable Firebase UID. A Firebase identity alone cannot access the building.

Cloudflare variables: `AUTH_PROVIDER=firebase`, `FIREBASE_PROJECT_ID`. Secrets: `FIREBASE_API_KEY`, `FIREBASE_SERVICE_ACCOUNT` (JSON string). Both secrets are already stored remotely. Never put the service credential in Vite variables or source control.

The dedicated service account has `roles/firebaseauth.admin`. It does not have project Owner/Editor, storage, database or billing roles. Use its key only for this portal. For rotation: create a replacement key, update the Worker secret, verify login/recovery, then revoke the old key. Delete compromised keys immediately and revoke affected portal sessions. Local `.secrets/` files are ignored, but still sensitive; protect Windows account access and backups.

## Local verification

Start the isolated, fake-project Auth emulator:

```powershell
npx.cmd --yes firebase-tools@15.37.0 emulators:start --only auth --project demo-portal-edificio --config firebase.local.json
```

Run these sequentially, not simultaneously: both Firebase scenarios reset ONLY the named local demo project's test accounts. Browser scenarios also build `dist`, so do not run another build against it at the same time.

```powershell
node --test worker/api.test.mjs
node --test worker/firebase.test.mjs
$env:PORTAL_TEST_FIREBASE='1'
node --test worker/production.browser.test.mjs
Remove-Item Env:PORTAL_TEST_FIREBASE
```

For the last scenario, Wrangler runs isolated local D1/R2 with HTTPS; three browser contexts verify cross-user behavior. No production database is used. Local auth and emulator flags are refused on public hostnames.

Opt-in real-provider smoke test (creates and deletes one temporary account, never a resident):

```powershell
node scripts/verify-firebase-live.mjs --confirm-test-account
```

It reads `.secrets/firebase-config.json` (`projectId`, `apiKey`) and `.secrets/firebase-service-account.json`. It logs outcomes, never passwords/keys/reset links. The service credential was downloaded from Google Cloud and belongs to the dedicated project account. If interrupted, check Firebase Users for the temporary `portal-check-...@example.invalid` identity and remove only that test account.

## Before releasing

1. Back up and inspect D1, apply migrations 0007/0008, confirm no orphan/legacy accounts. Existing scrypt accounts require explicit Firebase onboarding and UID mapping; never match/grant roles from an untrusted browser UID.
2. Create each real administrator separately, associate its verified Firebase UID with a D1 admin account, and let the person set their own password. No shared admin/admin. `/admin` is the entry route, not a permission bypass.
3. Publish the integrated Worker, verify secrets/configuration and real CPU limits, then test the public URL with independent admin/resident sessions. The current secret-only draft Worker is not a published portal.
4. Verify real iPhone login/logout, approval/suspension/recovery, concurrent SUM reservation rejection and privacy. Add confirmed building rules/contacts/documents and keep honest empty states otherwise.
5. Choose the permanent URL, deliberately handle the old Vercel link and only then distribute elevator QR codes.

## Recovery and availability

Recovery is assisted: owner requests help, administrator checks identity and re-enters their own password, owner receives a one-use link. The link's hash is stored in D1 and expires after 30 minutes. It is claimed before the external password update; after an ambiguous network failure issue a new link rather than retrying a consumed one. No automatic email delivery is configured.

Each authenticated request checks Firebase account state. Firebase outages fail closed; public information may remain available, but private data/actions must not silently fall back to demo mode. Changing status/email/UID revokes sessions in D1. Password resets/revocation/disablement in Firebase invalidate existing portal sessions too.
