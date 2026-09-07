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
