# QA Report

## 2026-11-14 - Chat visual polish

## P0 - BLOCKERS

None.

## P1 - IMPORTANT

None. The first pass exposed a contrast issue in message timestamps and an accessible-label regression in the shared issue conversation; both were corrected before completion.

## P2 - POLISH

None required for release. Owner and administration conversations now render as sender-aligned bubbles with readable avatars, a clear demo notice and a compact reply surface.

Validated at 390x844 and 1440x1000. Owner chat, administration inbox and shared issue conversations have no horizontal overflow, no console errors and zero WCAG A/AA violations in the focused audit. All 9 browser workflows, 21 unit workflows, 5 community workflows, lint and production build pass.

## 2026-11-14 - Installed app owner access

Production diagnosis confirmed that a fresh app context had zero local owner accounts and no demo shortcut. The login now offers one-tap access as Unit 7B while preserving registration and administration approval. The owner session survives closing and reopening the app and is removed by explicit logout.

Validated at 390x844 with no horizontal overflow, console errors or WCAG A/AA violations. All 21 unit, 5 community and 10 browser workflows pass.

## P0 - BLOCKERS

None found.

## P1 - IMPORTANT

None found in the audited demo flows.

## P2 - POLISH / BOUNDARIES

- La demo persiste en `localStorage` y sincroniza cambios entre pestañas del mismo navegador mediante el evento `storage`. No es todavía un sistema multiusuario: no hay autenticación, backend, base de datos ni control transaccional entre dispositivos.
- Los números de visualización de avisos son datos simulados y compartidos dentro de la demo local.

## Evidence

- Build: `npm run build` passed.
- TypeScript: `npm run typecheck` passed.
- Lint: `npm run lint` passed.
- Unified suite: `npm test` passed: 13 unit/model tests, 5 community tests and 6 browser workflow tests.
- Browser workflows: SUM reservation across owner/admin, reload persistence, cross-role collisions, cancellation, blocked dates, regulation editing, notice CRUD/read/pin flow, issue photo/conversation lifecycle, central chat persistence and role switching.
- Responsive sweep: services and notice routes at 320, 390, 768 and 1280px; zero horizontal overflow and zero broken images.
- Accessibility smoke: Axe checks on service routes, modal focus return, reduced-motion behavior and no console errors in the browser harness.
- Production smoke before release: public owner/admin routes, notice links, SUM page and image loading were reachable without console errors.

## Fixed findings

- The service browser harness used an inline Vite HTML proxy that failed before rendering. It now uses a real source entry module and React/Vite HTML transformation.
- Persisted demo data now normalizes every collection, repairs partial schemas, validates dates and deduplicates blocked dates.
- SUM availability now uses one validated date/time range model, trims cancelled statuses, rejects malformed reservations and prevents invalid records from appearing as upcoming reservations.
- Administration notice links retain the administration context; owner links retain the owner context.
- `/demo/administracion/servicios/sum` redirects to the canonical administrative SUM tab.
- File inputs no longer create horizontal overflow at 320px.

## Visual redesign pass - 2026-09-07

- Owner home now shows one image-led building hero, one urgent notice, three priority actions, activity, news, and building status. Secondary destinations remain available in the grouped Más page.
- Owner mobile navigation is now Inicio / Mi edificio / Servicios / Más. Novedades remains reachable from the home feed and its route is preserved.
- Administration home now shows three priorities (Nuevo aviso, Revisar reclamos, Revisar reservas del SUM). Movements, documents, meetings, and surveys remain under Más acciones.
- Owner and administration menus use native disclosure groups so only the first operational group is open by default; no route or feature was removed.
- Visual evidence captured locally in `studio/.qa/owner-mobile.png`, `studio/.qa/admin-mobile.png`, `studio/.qa/owner-desktop.png`, and `studio/.qa/admin-desktop.png`. At 390px and 1280px, `scrollWidth` matched `innerWidth` and no Vite error overlay rendered.
- Manual browser inspection covered public home, owner home, admin home, owner grouped menu, and admin grouped menu. Existing service, reservation, notices, and auth tests were rerun after the CSS and hierarchy changes.

## SUM booking polish - 2026-11-06

## P0 - BLOCKERS

None found.

## P1 - IMPORTANT

None found.

## P2 - POLISH

- The booking form now presents a date surface followed by two sequential time controls: `Empieza` and `Termina`. The end control is disabled until an owner chooses the start time, and selected times receive a high-contrast active state.

## Evidence

- Rendered local captures: `studio/.qa/sum-mobile-controls.png`, `studio/.qa/sum-mobile-selected.png`, and `studio/.qa/sum-desktop-polish.png`.
- Mobile inspection at 390 x 844: the two controls stack in the order of use, retain 58 px control height, show no horizontal overflow, and keep the bottom navigation clear of interactive choices.
- Desktop inspection at 1440 x 900: date, start, and end choices remain grouped beside the SUM image without crowding the reservation form.
- Validation: `npm run typecheck`, `npm run lint`, `npm run test:unit`, `npm run test:community`, `npm run test:browser`, and `npm run build` all passed.
- Protected preview QA passed with Vercel's short-lived development credential; the production smoke test passed at `https://portal-del-edificio.vercel.app/demo/propietario/servicios/sum` at 390 x 844. It verified the start/end sequence, available-range feedback, image load, no horizontal overflow, and no browser errors.

## Administration redesign - 2026-11-06

### P0 - BLOCKERS

None found.

### P1 - IMPORTANT

None found.

### Evidence

- Rendered local captures: `studio/.qa/admin-redesign-desktop.png`, `studio/.qa/admin-redesign-mobile.png`, `studio/.qa/admin-redesign-narrow.png`, `studio/.qa/admin-notice-editor-mobile.png`, and `studio/.qa/admin-meeting-editor-mobile.png`.
- At 1440 x 1000, 390 x 844, and 320 x 700, the redesigned administration home rendered six direct creation actions and four separate follow-up cards without horizontal overflow or browser errors.
- Each direct action was exercised: new notice, new meeting, new cash movement, new work update, new document, and new survey all opened their intended form from the administration home.
- Validation: `npm run build`, `npm run lint`, and `npm test` passed. The suite completed 21 model tests, 5 community tests, and 8 browser workflow tests.

## Incremental task-discovery polish - 2026-11-06

### P0 - BLOCKERS

None found.

### P1 - IMPORTANT

None found.

### Evidence

- Rendered local captures: `studio/.qa/owner-actions-mobile.png`, `studio/.qa/owner-services-mobile.png`, `studio/.qa/owner-building-final-mobile.png`, `studio/.qa/admin-home-mobile.png`, `studio/.qa/admin-services-final-mobile.png`, and `studio/.qa/admin-community-final-mobile.png`.
- Mobile visual inspection at 390 x 844 verified the preserved owner landing, four distinct owner actions, visible help entry, administration action cards, issue overview, and the two-by-two community navigation.
- Interactive task-entry check passed: owner chat, direct owner issue creation, administration expense loading, and administration vote creation all open their intended destination or dialog.
- Browser workflow sweep passed at 320, 390, 768 and 1280px with no horizontal overflow, no broken images, no console errors and no accessibility smoke-test violations on service routes.
- Production smoke passed at `https://portal-del-edificio.vercel.app` using a 390 x 844 viewport: the public alias returned 200, Owner Chat navigated correctly, Cargar expensas opened its form, no horizontal overflow occurred, and no browser errors were reported.

## Operational surface polish - 2026-11-06

### P0 - BLOCKERS

None found.

### P1 - IMPORTANT

None found.

### Evidence

- Rendered local captures: `studio/.qa/owner-chat-mobile.png`, `studio/.qa/owner-issues-mobile.png`, `studio/.qa/owner-community-mobile.png`, `studio/.qa/admin-chat-mobile.png`, and `studio/.qa/admin-chat-desktop.png`.
- At 390 x 844 and 1440 x 1000, conversation turns, service lists, meetings and administration inbox panels had no horizontal overflow and no browser errors.
- Validation passed: `npm run typecheck`, `npm run lint`, `npm test` (21 unit, 5 community and 8 browser workflows), `npm run build`, and `git diff --check`.
- Production smoke passed at `https://portal-del-edificio.vercel.app/` using a 390 x 844 viewport: HTTP 200, four public Cartelera cards and four category signals rendered, with no horizontal overflow or browser errors.
- Production smoke passed at `https://portal-del-edificio.vercel.app` using a 390 x 844 viewport: Reclamos and Comunidad returned 200, their list cards retained at least 16px horizontal padding, and no horizontal overflow or browser errors were reported.

## Cross-page card alignment audit - 2026-11-06

### P0 - BLOCKERS

None found after correction.

### P1 - IMPORTANT

None found after correction.

### Evidence

- Corrected the mobile shared list-row padding that left content flush against its card edge in reused lists.
- Rendered owner home, SUM, claims, building, notices, and administration home, communications, accounts, community and services at 390 x 844; all had no horizontal overflow, out-of-viewport cards or browser errors.
- Rechecked the same route set at 1440 x 1000 with no horizontal overflow, out-of-viewport cards or browser errors.
- Spot-checked corrected captures: `studio/.qa/audit-owner-issues-fixed.png`, `studio/.qa/audit-owner-sum-fixed.png`, `studio/.qa/audit-admin-community-fixed.png`, `studio/.qa/audit-admin-finances-fixed.png`, and `studio/.qa/audit-admin-notices-fixed.png`.
- Validation passed: `npm run typecheck`, `npm run lint`, `npm test` (21 unit, 5 community and 8 browser workflows), `npm run build`, and `git diff --check`.

## Public Cartelera polish - 2026-11-06

### P0 - BLOCKERS

None found.

### P1 - IMPORTANT

None found.

### Evidence

- Rendered local captures: `studio/.qa/public-home-cartelera-mobile.png`, `studio/.qa/public-news-mobile.png`, `studio/.qa/public-home-cartelera-desktop.png`, and `studio/.qa/public-news-desktop.png`.
- At 390 x 844 and 1440 x 1000, public news cards had no horizontal overflow, no out-of-viewport cards and no browser errors. Home shows four cards; the full Novedades view shows all 18 cards.
- Validation passed: `npm run typecheck`, `npm run lint`, `npm test` (21 unit, 5 community and 8 browser workflows), `npm run build`, and `git diff --check`.
- Production smoke passed at `https://portal-del-edificio.vercel.app/demo/administracion/comunicaciones` using a 390 x 844 viewport: HTTP 200, 18 notice cards and 18 administration action footers rendered, with no horizontal overflow or browser errors.
- Production smoke passed at `https://portal-del-edificio.vercel.app/demo/propietario/servicios/chat` using a 390 x 844 viewport: HTTP 200, three message cards rendered, no horizontal overflow and no browser errors.

## High-fidelity reference redesign - 2026-11-12

### P0 - BLOCKERS

None found.

### P1 - IMPORTANT

None found.

### Evidence

- Compared rendered local public, owner and administration scenes against the supplied reference at 1440 x 1050 and 390 x 844. Captures: `studio/.qa/reference-public-desktop.png`, `reference-public-mobile.png`, `reference-owner-desktop.png`, `reference-owner-mobile.png`, `reference-admin-desktop.png`, and `reference-admin-mobile.png`.
- The public landing now renders the supplied facade hero, notification module, four task cards, real building state and a real upcoming meeting. Owner and administration retain their existing CTA destinations and data while following the same capsule-header and split-hero hierarchy.
- Internal mobile captures for Servicios and Cuentas (`reference-services-mobile.png`, `reference-finances-mobile.png`) retained the new visual system with no horizontal overflow.
- Safe interaction checks passed: public and owner `Reservar el SUM` both navigated to `/demo/propietario/servicios/sum`; administration `Publicar un aviso` opened `/demo/administracion/comunicaciones?new=1`.
- Render sweep returned HTTP 200, zero console or page errors and no horizontal overflow on public, owner and administration at desktop and mobile viewports.
- Validation passed: `npm run typecheck`, `npm run lint`, `npm test` (21 unit, 5 community and 8 browser workflows), `npm run build`, and `git diff --check`. The existing browser suite also passed accessibility basics, modal focus, reduced motion, responsive service routes and console health.
- No preview or production deployment was created, per current authorization.

## Internal surfaces and forms - 2026-11-12

### P0 - BLOCKERS

None found.

### P1 - IMPORTANT

None found.

### Evidence

- The public landing was not changed. Internal owner and administration pages now share elevated ivory filters, softer tabs, richer finance summaries, and category-tinted gateway surfaces.
- The visual system covers owner Cuentas, Expensas, Documentos, Novedades, SUM, Reclamos, Comunidad and Más, plus administration Finanzas, Comunicaciones, Comunidad, Servicios, Contenido and Menú.
- New and editing forms use a consistent modal header, grouped field surfaces, native inputs, clearer attachment treatment and a stable cancel/save action row. The generic content editor now groups information and attachments with labelled icon panels.
- Mobile rendered checks covered 390 x 844 captures for owner Documents, Cuentas, Novedades, SUM, Reclamos, Reuniones, Calendario and administration Finanzas, Comunicaciones, Comunidad, Servicios and Contenido. Representative forms for cash movements and works were inspected. No overflow or console errors occurred.
- Route sweep passed 36 owner and 14 administration viewport checks at 390 x 844 and 1440 x 960, with no HTTP failures, console errors or horizontal overflow.
- Validation passed: `npm run typecheck`, `npm run lint`, `npm test` (21 unit, 5 community and 8 browser workflows), `npm run build`, and `git diff --check`.

## Communications card polish - 2026-11-06

### P0 - BLOCKERS

None found.

### P1 - IMPORTANT

None found.

### Evidence

- Rendered local captures: `studio/.qa/admin-notices-mobile.png`, `studio/.qa/admin-notices-desktop.png`, and `studio/.qa/owner-notices-mobile.png`.
- At 390 x 844 and 1440 x 1000, all 18 communication cards rendered with their category treatment and no horizontal overflow or browser errors.
- Validation passed: `npm run typecheck`, `npm run lint`, `npm test` (21 unit, 5 community and 8 browser workflows), `npm run build`, and `git diff --check`.

## Owner access usability polish - 2026-11-14

### P0 - BLOCKERS

None found.

### P1 - IMPORTANT

None found.

### Evidence

- Login now identifies an owner with unit and password. The first-time panel explicitly sends new residents to access registration.
- Registration captures name, DNI, email, unit and password, and explains request, administration review and access as three short steps.
- Administration displays unit, DNI and email before approval. Existing browser-local accounts without email remain compatible and display `No informado`.
- The end-to-end browser workflow passed registration, pending state, administration approval, direct return to SUM, account-unit binding, suspension, password recovery and suspended-access rejection.
- Rendered checks at 390 x 844 and 1440 x 900 found no horizontal overflow or browser errors. The mobile registration screen displayed all three guidance steps and every field correctly.
- Validation passed: `npm run typecheck`, `npm run lint`, `npm test` (21 unit, 5 community and 9 browser workflows), `npm run build`, and `git diff --check`.

## Owner access privacy - 2026-11-25

- Registration now asks for name, unit, email and password; DNI is absent from demo and production forms.
- Administration reviews the unit and registered email without receiving or displaying DNI.
- Migration 0007 clears historical DNI values. New registration ignores an obsolete client-supplied DNI and keeps the database value NULL.
- Demo browser storage removes DNI from requests created by earlier versions when accounts are read.
- Validation passed: typecheck, lint, build, 12 API tests, 11 demo browser workflows and the complete local HTTPS production workflow with D1, SUM races and private chat.

## Administration tools directory - 2026-11-14

### P0 - BLOCKERS

None found.

### P1 - IMPORTANT

None found.

### Evidence

- The administration tools index now presents four large frequent actions before the complete directory. All 12 existing destinations remain available and visible without opening disclosures.
- The former repeated "Atención y servicios" entry is preserved as the clearer "Panel de atención" overview; no route or capability was removed.
- Rendered captures at 390 x 844 and 1440 x 1000 show aligned cards, complete copy, 94 px or larger touch surfaces, no horizontal overflow and no console or page errors.
- Every directory destination was opened directly: owner access, services overview, SUM, claims, chat, meetings, polls, voting, documents, works, building status and portal information.
- Axe WCAG A/AA reported zero violations after the secondary text contrast adjustment.
- Validation passed: `npm run typecheck`, `npm run lint`, 35 automated workflows (21 unit, 5 community and 9 browser), `npm run build`, and `git diff --check`.

## Owner tools directory - 2026-11-14

### P0 - BLOCKERS

None found.

### P1 - IMPORTANT

None found.

### Evidence

- The owner "Más" screen now leads with four large everyday actions: SUM booking, building accounts, reporting a problem and contacting administration.
- All 14 existing destinations remain permanently visible in four groups: daily services, information and accounts, participation, and help and contacts. No disclosure must be opened to discover an option.
- Rendered captures at 390 x 844 and 1440 x 1000 show complete copy, 94 px or larger card targets, no horizontal overflow and no console or page errors.
- Every destination was opened directly, including SUM, claims, chat, accounts, documents, building status, works, meetings, calendar, listings, contacts, emergencies, FAQ and lost objects.
- Axe WCAG A/AA reported zero violations.
- Validation passed: `npm run typecheck`, `npm run lint`, 35 automated workflows (21 unit, 5 community and 9 browser), `npm run build`, and `git diff --check`.

## Installed mobile app login navigation - 2026-11-14

### P0 - BLOCKERS

None found after correction.

### Evidence

- The failure was reproduced as a split browser context: owner links opened Safari from the installed home-screen app, so the login session was not available inside the app.
- Every public owner-access link now remains in the current window when iOS standalone or installed-app display mode is active. Ordinary browser use still opens the requested new tab.
- A dedicated 390 x 844 touch test simulates iPhone standalone mode, opens `Reservar el SUM`, enters as Unit 7B, reaches the SUM route in the same page and confirms no horizontal overflow.
- Validation passed: `npm run typecheck`, `npm run lint`, `npm test` (21 unit, 5 community and 11 browser workflows), and `npm run build`.

## Owner tools directory - 2026-11-14

### P0 - BLOCKERS

None found.

### P1 - IMPORTANT

None found.

### Evidence

- The owner "Más" screen now presents four large frequent actions before the complete directory: SUM, accounts, reporting a problem and contacting administration.
- All 14 existing destinations remain visible without disclosures, grouped as daily services, information and accounts, participation, and help and contacts.
- Rendered captures at 390 x 844 and 1440 x 1000 show complete copy, 94 px or larger touch surfaces, no horizontal overflow and no console or page errors.
- Every destination was opened with an approved owner session and rendered its expected heading; authentication and unit context remained active.
- Axe WCAG A/AA reported zero violations.
- Validation passed: `npm run typecheck`, `npm run lint`, 35 automated workflows (21 unit, 5 community and 9 browser), `npm run build`, and `git diff --check`.
