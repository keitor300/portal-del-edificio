# Release

Target: Vercel production, no custom domain, no Cloudflare.

Rollback target: previous Vercel production deployment or `git revert` of the release commit followed by a fresh Vercel deployment.

The app is a static Vite SPA with a Vercel rewrite for internal route refresh. LocalStorage is the only mutable data store in V1.

Production: https://portal-del-edificio.vercel.app
Deployment inspected: https://portal-del-edificio-mrqddzt17-ksixs-projects.vercel.app
Release commit: d193d75
