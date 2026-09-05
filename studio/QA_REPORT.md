# QA Report

## P0 - BLOCKERS

None found.

## P1 - IMPORTANT

None found after correction. The first route sweep found a missing illustrative lost-item image; the seed now uses the accessible no-image state.

## P2 - POLISH

The demo uses local browser persistence by design. A fresh browser starts with seed data; changes do not sync across devices.

## Evidence

- Build: `npm run build` passed.
- TypeScript: `npm run typecheck` passed.
- Lint: `npm run lint` passed.
- Unit/model tests: 11 passed for finance import and SUM booking rules.
- Functional browser path: admin creates notice and owner sees it; owner creates a SUM booking that remains occupied after refresh; owner votes once; admin import route renders; no console errors.
- Render sweep: 26 routes at 320, 390, 768 and 1280px (104 checks), zero horizontal overflow and zero broken images.
- Visual screenshots: `studio/.qa/home.png` (390px) and `studio/.qa/admin-desktop.png` (1440px). Both inspected after rendering.
- Visual direction: quiet white/neutral surfaces, forest green action accent, real supplied building photography, large controls, open lists and five owner areas.
- Public homepage critic gate: the duplicated featured-news/list pattern was removed; the homepage now exposes six functional access points, a SUM hero CTA, a dedicated SUM module, building status/work progress, and all supplied building photographs. Verified at 390px and 1440px with no console errors, broken images, or horizontal overflow.
- Public interaction check: all six homepage action links resolve, the SUM CTA opens the real booking form, and a confirmed booking persists in local browser storage.

## Known demo boundaries

- No real authentication, role security, backend, payment, official emergency contacts, push/email/WhatsApp, or legal voting.
- Excel files are parsed locally and never uploaded.
