# Portal del Edificio

MODE: REDESIGN. V1 demo for a 52-unit building, owner Unidad 7B. Full attached brief is scope.
Objective: accessible, client-ready everyday portal. Audience includes adults over 70 on iPhone.
Stack: React, Vite, TypeScript, Tailwind, React Router, local state. No real authentication, private data, payments, messaging, backend or Cloudflare setup.

## Creative Gate - CLOSED
Concept: The shared noticeboard of the building, upgraded into a calm private-club concierge for everyday community life. The redesign keeps the portal practical while making the building and its shared spaces visible at first glance.
Direction: warm ivory canvas, deep forest #123b2d, olive surfaces, restrained brass #ad8348, and ink text. Use real building photography as the visual anchor. Keep urgency amber only for warnings. Prefer grouped progressive disclosure over a wall of choices.
Typography: local Inter for reading and controls, Georgia fallback for display headings. Owner body 17px/1.6, admin 16px, headings 34-56px inside visual hero bands, section 22-25px. Minimum 48px primary targets, 44px controls; visible focus; zero letter spacing.
Hierarchy: identity + compact role selector; image-led greeting; one urgent notice; three owner priority actions; activity and news; secondary functions collapsed by topic. Administration follows the same hierarchy with three priorities and a collapsed More actions group.
Journey: owner mobile navigation is Inicio / Mi edificio / Servicios / Más; Novedades remains reachable from the home feed. Admin desktop keeps four stable destinations and mobile uses the existing drawer. Details panels expose the complete feature set without front-loading it.
Scenes: owner home with facade hero; owner grouped menu; admin home with city-view hero; admin grouped menu; existing operational pages unchanged.
SUM booking polish: unit, date, start and finish remain native controls; the unit is a closed selector containing the 52 dwellings, while start and finish are two labelled, high-contrast choice surfaces with a visible selected state and concise availability feedback. On narrow phones they stack vertically in the order of use.
Imagery: supplied facade on home, lobby/building information, SUM booking, city/terrace gallery. Original full image accessible. Do not label building photos as evidence of work progress.
Motion: short feedback transitions only, reduced-motion supported.
Assets: four supplied JPEGs, Lucide icons, simple PWA icon and real downloadable demo PDFs.

## Media Gate - CLOSED
Provider none; supplied photographs; no generation/prompt needed. Cost zero. JPEG originals, one integration pass plus QA corrections. User supplied for demo; retain source watermarks and no claim of image ownership. No edits to geometry/light/marks. QA: all four load, no stretching, descriptive alt, full gallery image available.

## Authorization
User explicitly requests final Vercel production and GitHub publication if available; authorized for this new portal. Preview QA before promotion. No DNS/custom domain changes.

## Creative Gate - 2026-11-12 Reference Redesign - CLOSED
Objective: bring the supplied high-fidelity reference into the public landing, owner portal, administration dashboard, and shared operational patterns without changing functional behavior.
User: residents and administration of Edificio 13 y 34; the interface must remain legible and touch-friendly for older residents.
Concept: a calm, premium building desk. The visual order is photography, urgent context, then a small set of large, self-explanatory actions.
Visual direction: warm ivory canvas, rounded white capsule header, deep forest primary actions, coral only for urgent alerts, and soft green, blue, amber, and blush task surfaces. Shadows stay subtle and borders preserve definition.
Typography: Inter remains the UI font; strong sans headings and labels replace the former editorial emphasis so operational screens remain immediate and clear.
Imagery: only the supplied facade, hall, SUM, and city-view photos. No generated media, new providers, or changes to source images.
Hierarchy and journey: public landing presents the facade hero, compact notifications, four primary access cards, building status, and the next community event. Owner and administration preserve their current data and routes, but use the same visual hierarchy and large action cards. Internal screens use the capsule header, clearer panel surfaces, color-coded state, and roomy touch targets.
Motion: brief hover and focus elevation only; all transitions are disabled under reduced motion.
Validation: desktop and mobile reference comparison, safe navigation through CTAs and menu, form and state checks, overflow, contrast, reduced motion, typecheck, lint, existing tests, and build. No preview or production deployment without further user authorization.
