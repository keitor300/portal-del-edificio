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
