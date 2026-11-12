# Deploy QA

Production deployment verified on 2026-09-05.

URL: https://portal-del-edificio.vercel.app
Deployment: https://portal-del-edificio-g9w4zk08f-ksixs-projects.vercel.app
Inspector: https://vercel.com/ksixs-projects/portal-del-edificio/DRmzasKn49Ymp1cdEZR7KYftWdhG
Status: READY. Vercel project: `portal-del-edificio` in team `ksixs-projects`.
Commit: `36a6708`.

## Production smoke

- Native CUA browser used against the public URL.
- `/demo/administracion` rendered the administration home with all four navigation areas and working action links.
- `/demo/propietario/novedades` rendered all seeded notices with owner-scoped detail links.
- `/demo/propietario/servicios/sum` rendered the owner booking form with the current date, available slot, regulation and existing reservation list.
- `/demo/administracion/servicios?tab=sum` rendered the manual reservation form, building reservations and blocked-date controls.
- `/demo/administracion/servicios/sum` redirected to the canonical administrative SUM tab.
- All checked routes reported zero console errors or warnings, no horizontal overflow at the browser viewport, and no broken images.

## Release evidence

- Local `npm test`, `npm run build`, `npm run typecheck` and `npm run lint` passed before deployment.
- The deploy build completed remotely and Vercel reported `READY`.
- No backend, authentication, database or cross-device synchronization was introduced; the demo boundary remains documented in `QA_REPORT.md`.

## Preview QA - Interior surfaces and forms (2026-11-12)

- Preview: https://portal-del-edificio-pn4xaf7ft-ksixs-projects.vercel.app
- Branch: `redesign/interiores-formularios`
- Commit: `3b3b790`.
- Vercel status: `READY`.
- Production was not changed for this scope.

### Online smoke

- Checked at 390 x 844 and 1440 x 960: owner accounts, owner documents, owner notices, administration finances, administration communications, and administration works.
- Every checked screen rendered without horizontal overflow or console errors.
- Opened and verified the new cash-movement modal and the works editor modal on the preview deployment.

### Local verification

- `npm run typecheck`, `npm run lint`, `npm run build`, and `npm test` passed.
- Test suites: 21 unit checks, 5 community checks, and 8 browser checks.
