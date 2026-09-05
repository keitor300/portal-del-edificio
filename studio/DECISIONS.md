# Decisions

- Canonical and global premium-web-studio inspected; existing specialist agents reused.
- Original workspace is empty/unborn Git. Windows rejects file/directory creation in Documents despite full ACL; implementation moved to writable C:/Users/Nicolas/Projects/portal-del-edificio.
- Browser-local versioned repository adapter; dates relative to initialization. No cross-device sharing.
- Vite SPA remains portable, Vercel config only adds documented deep-route rewrite. No platform SDK.
- Local attachments max 1 MB each, errors surfaced. Local SheetJS import with preview/mapping/validation.
- Native IAB inspection and repeatable Playwright browser tests/screenshots.
- Premium-web-studio owns art direction. Complementary frontend concept-generation workflow inspected but not adopted; provided photos and specific operational brief define assets.
