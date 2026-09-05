# Deploy QA

Production deployment verified on 2026-09-05.

URL: https://portal-del-edificio.vercel.app
Deployment: https://portal-del-edificio-mrqddzt17-ksixs-projects.vercel.app
Status: READY. Vercel project: `portal-del-edificio` in team `ksixs-projects`.

Checks completed against the public URL with Playwright/Edge fallback because native CUA browser initialization was unavailable: home, direct internal route refresh, role switch, owner bottom navigation, admin notice creation, local persistence, SUM route, and image loading at 390px and 1440px. HTTP status was 200 for each checked direct route. Production images were additionally awaited until complete before asserting natural dimensions.
