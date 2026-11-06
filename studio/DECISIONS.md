# Decisions

- Canonical and global premium-web-studio inspected; existing specialist agents reused.
- Original workspace is empty/unborn Git. Windows rejects file/directory creation in Documents despite full ACL; implementation moved to writable C:/Users/Nicolas/Projects/portal-del-edificio.
- Browser-local versioned repository adapter; dates relative to initialization. No cross-device sharing.
- Vite SPA remains portable, Vercel config only adds documented deep-route rewrite. No platform SDK.
- Local attachments max 1 MB each, errors surfaced. Local SheetJS import with preview/mapping/validation.
- Native IAB inspection and repeatable Playwright browser tests/screenshots.
- Premium-web-studio owns art direction. Complementary frontend concept-generation workflow inspected but not adopted; provided photos and specific operational brief define assets.
- 2026-09-07 visual redesign: keep all routes and functionality, but reduce first-screen choices to three owner actions and three admin priorities. Move Novedades into the home feed, expose Servicios in primary owner navigation, and group secondary functions with native details disclosure. Use the supplied facade and city images as hero scenes with a warm ivory, deep forest, and brass editorial palette.
- 2026-11-06 MODE: POLISH. The SUM booking flow keeps native date/time controls and all existing availability rules, but presents start and finish as two large sequential touch targets. This is intentionally clearer for iPhone and older residents than a dense custom time grid.
- 2026-11-06 MODE: POLISH. SUM reservations now require selecting a unit from the 52 residential units in the supplied liquidation, excluding 13 garage entries and all personal or financial document data. The selected unit appears in availability feedback, confirmation, and a dedicated visible label in the shared reservation history.
- 2026-11-06 MODE: POLISH. On mobile, each SUM reservation is a self-contained card so its unit, schedule, status, and cancellation action remain visually connected instead of wrapping into misaligned rows.
