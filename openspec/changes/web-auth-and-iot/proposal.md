# Proposal: web-auth-and-iot

## Intent

Ensure the web app has an /iot entry point and make authentication durable across refreshes by moving to httpOnly cookie sessions, while enabling signup and seeded users for immediate access.

## Scope

### In Scope
- Add minimal `/iot` route in web app.
- Persist auth via httpOnly cookies across backend and web.
- Add signup endpoint and seed/example users (admin + general).
- Update dashboard guard to rely on cookie/session.

### Out of Scope
- Full IoT UI or device management features.
- Mobile app auth changes beyond shared backend behavior.
- OAuth/social login flows.

## Capabilities

### New Capabilities
- `web-iot-route`: Placeholder `/iot` page in Next.js app.
- `cookie-session-auth`: httpOnly cookie-based auth persistence across refreshes.
- `user-signup-seeding`: Signup + seeded admin/example users.

### Modified Capabilities
- None

## Approach

- Web: add App Router page for `/iot` (minimal placeholder).
- Backend: issue/refresh httpOnly auth cookies on login/signup; expose session check endpoint.
- Web: swap token-in-memory guard for cookie/session check on `/dashboard`.
- Seeding: add startup seed for admin + example user, plus signup flow.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `web/app/iot/page.tsx` | New | Minimal /iot route page. |
| `web/app/dashboard/*` | Modified | Guard uses cookie/session instead of in-memory token. |
| `backend/auth/*` | Modified | Set httpOnly cookies on login/signup/refresh. |
| `backend/routes/*` | Modified | Add signup endpoint and session check. |
| `backend/seed/*` | New/Modified | Seed admin + example users. |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Cookie config mismatch across envs | Med | Centralize cookie settings; verify in dev/prod. |
| Existing clients rely on token response | Low | Keep token response temporarily or document change. |
| Seed users conflict with real data | Low | Seed only in dev/test or guard by env flag. |

## Rollback Plan

- Revert cookie auth changes to token-only flow.
- Remove `/iot` route and signup/seed endpoints.
- Restore dashboard guard to token-in-memory behavior.

## Dependencies

- Consistent backend session middleware and cookie settings.

## Success Criteria

- [ ] Visiting `/iot` returns a placeholder page.
- [ ] Login/signup persists across refresh via httpOnly cookie.
- [ ] Seeded admin + example users exist in dev/test.
- [ ] `/dashboard` guard works after refresh without in-memory token.
