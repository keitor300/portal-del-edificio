# Release

Target: Vercel production, no custom domain, no Cloudflare.

Rollback target: previous Vercel production deployment or `git revert` of the release commit followed by a fresh Vercel deployment.

The app is a static Vite SPA with a Vercel rewrite for internal route refresh. LocalStorage is the only mutable data store in V1.
