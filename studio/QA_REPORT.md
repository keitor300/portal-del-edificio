# QA Report

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
- Production smoke passed at `https://portal-del-edificio.vercel.app/demo/propietario/servicios/chat` using a 390 x 844 viewport: HTTP 200, three message cards rendered, no horizontal overflow and no browser errors.

## Communications card polish - 2026-11-06

### P0 - BLOCKERS

None found.

### P1 - IMPORTANT

None found.

### Evidence

- Rendered local captures: `studio/.qa/admin-notices-mobile.png`, `studio/.qa/admin-notices-desktop.png`, and `studio/.qa/owner-notices-mobile.png`.
- At 390 x 844 and 1440 x 1000, all 18 communication cards rendered with their category treatment and no horizontal overflow or browser errors.
- Validation passed: `npm run typecheck`, `npm run lint`, `npm test` (21 unit, 5 community and 8 browser workflows), `npm run build`, and `git diff --check`.
