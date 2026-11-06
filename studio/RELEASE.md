# Release

Target: Vercel production, no custom domain, no Cloudflare.

Rollback target: previous Vercel production deployment or `git revert` of the release commit followed by a fresh Vercel deployment.

The app is a static Vite SPA with a Vercel rewrite for internal route refresh. LocalStorage is the only mutable data store in V1.

Production: https://portal-del-edificio.vercel.app
Deployment inspected: https://portal-del-edificio-68pn0t9yg-ksixs-projects.vercel.app
Release commit: 0138781

2026-11-06 SUM booking interaction polish: production deploy `dpl_Dzy9KMQzXGurVirmL2WJa8vXpbWo` is READY and aliases the public portal. Browser smoke QA passed at 390 x 844. Vercel error logs: none found.

2026-11-06 Incremental task-discovery polish: production deployment `https://portal-del-edificio-2rngg8q2o-ksixs-projects.vercel.app` is READY and aliases the public portal. The deployment URL uses Vercel SSO, while the public alias is anonymously reachable. Public 390 x 844 smoke passed for Owner Chat and the Cargar expensas action without overflow or browser errors.

2026-11-06 Operational surface polish: production deployment `https://portal-del-edificio-juwnt2on0-ksixs-projects.vercel.app` is READY and aliases the public portal. Release commit: `82a95cb`. The public alias returned 200; Owner Chat rendered three elevated message cards at 390 x 844 with no horizontal overflow or browser errors.

2026-11-06 Communications card polish: production deployment `https://portal-del-edificio-falw13u98-ksixs-projects.vercel.app` is READY and aliases the public portal. Release commit: `8c9c079`. The public administration communications screen returned 200; 18 color-coded notice cards and their action footers rendered at 390 x 844 without overflow or browser errors.

2026-11-06 Cross-page card alignment audit: production deployment `https://portal-del-edificio-fe1q42gd6-ksixs-projects.vercel.app` is READY and aliases the public portal. Release commit: `61e9afb`. Public 390 x 844 checks confirmed Reclamos and Comunidad list cards retain their horizontal padding, with no overflow or browser errors.

2026-11-06 Public Cartelera polish: production deployment `https://portal-del-edificio-3ppv83wik-ksixs-projects.vercel.app` is READY and aliases the public portal. Release commit: `8222979`. The public homepage returned 200; four category-aware Cartelera cards rendered at 390 x 844 without overflow or browser errors.
