# Release

Target: Vercel production, no custom domain, no Cloudflare.

Rollback target: previous Vercel production deployment or `git revert` of the release commit followed by a fresh Vercel deployment.

The app is a static Vite SPA with a Vercel rewrite for internal route refresh. LocalStorage is the only mutable data store in V1.

Production: https://portal-del-edificio.vercel.app
Deployment inspected: https://portal-del-edificio-68pn0t9yg-ksixs-projects.vercel.app
Release commit: 99c3215

2026-11-06 SUM booking interaction polish: production deploy `dpl_Dzy9KMQzXGurVirmL2WJa8vXpbWo` is READY and aliases the public portal. Browser smoke QA passed at 390 x 844. Vercel error logs: none found.
