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

- Preview: https://portal-del-edificio-git-redesign-interior-2cdecc-ksixs-projects.vercel.app
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

## Preview QA - Owner access usability (2026-11-14)

- Preview: https://portal-del-edificio-dptn6b7f8-ksixs-projects.vercel.app
- Branch: `feature/acceso-propietarios-demo`
- Commit: `0f60af9`.
- Vercel status: `READY`.
- Online 390 x 844 workflow passed: public SUM link opened login in a new tab, new-owner guidance opened registration, email and unit were saved, Administration displayed and approved the request, and login returned to SUM with the approved unit selected.
- No horizontal overflow, console errors, or page errors were found.

## Administration tools directory (2026-11-14)

- Preview: https://portal-del-edificio-5toprr55s-ksixs-projects.vercel.app
- Preview deployment: `dpl_8wLpmAKFp64uzXYF3tstB4rP5ybd`, status `READY`.
- Production: https://portal-del-edificio.vercel.app
- Production deployment: `dpl_3U5BLo9Foy5uEL4vKRvZE2HueoLk`, status `READY`.
- Release commit: `d5f77cb`.
- Protected preview and public production checks passed at 390 x 844 and 1440 x 1000: four frequent actions, 12 complete directory destinations, no horizontal overflow, no console or page errors.
- Public smoke confirmed `Coordinar el SUM` reaches `/demo/administracion/servicios?tab=sum` in both viewports.

## Owner tools directory (2026-11-14)

- Preview: https://portal-del-edificio-684u93l7c-ksixs-projects.vercel.app
- Preview deployment: `dpl_HWvxgwKXv54hXZtFSCKbWyj78w6M`, status `READY`.
- Production: https://portal-del-edificio.vercel.app
- Production deployment: `dpl_47yPZ3HcXfGaL1QkHgtVxttzeXjn`, status `READY`.
- Release commit: `3cfffb9`.
- Protected preview and public production checks passed at 390 x 844 and 1440 x 1000: four frequent owner actions, 14 complete directory destinations, no horizontal overflow, no console or page errors.
- Public smoke confirmed `Ver cuentas` reaches `/demo/propietario/edificio/cuentas` in both viewports.

## Installed-app owner access and chat polish (2026-11-14)

- Preview: https://portal-del-edificio-fftozn7s2-ksixs-projects.vercel.app
- Preview deployment: `dpl_7McsmoSpqiUfMATRJGPEFXGS5iPq`, status `READY`.
- Production: https://portal-del-edificio.vercel.app
- Production deployment: `dpl_Gb7PJrkWZhhEXwebLdXCwPLXB7Ec`, status `READY`.
- Release commits: `f7089bc` and `900d045`.
- Protected preview and public production checks passed at 390 x 844: one-tap Unit 7B access, direct navigation to the requested owner route, session persistence after closing/reopening the app context, no horizontal overflow, no console errors, and zero WCAG A/AA violations.
