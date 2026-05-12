# Design: Web Auth & IoT Route

## Technical Approach

Dual-mode auth migration: login/signup sets httpOnly cookies AND returns JWT body for legacy clients. Add `/session` endpoint for cookie-based validation. Dashboard guard switches from in-memory token check to cookie session check. `/iot` page is a public Next.js route. Seeding runs on dev/test startup.

## Architecture Decisions

| Decision | Choice | Alternatives | Rationale |
|----------|--------|-------------|-----------|
| Auth cookie payload | Access JWT as session cookie | Opaque session ID, refresh JWT | Zero new infra; JWT already validated server-side; reuse existing `validate_token` |
| Cookie names | `session` (access) + `refresh` (refresh) | Single combined cookie | Aligns with existing token pair design; refresh cookie enables silent rotation |
| Session validation endpoint | `GET /api/v1/auth/session` returns user info | Inline cookie decode in middleware | Lets web client treat session as opaque; avoids coupling Next.js to JWT internals |
| Signup tenant | Auto-assign to default tenant `"Default Farm"` | Require tenant_id in request | Simplifies first-time UX; user can switch later via tenant-switch |
| Seed mechanism | `app/seed.py` called in lifespan when `ENVIRONMENT != "production"` | CLI command, migration data | Automatic in dev; no separate step needed; production guard by env check |
| Legacy compatibility | Keep `Authorization` header + JWT body response | Remove token response | `get_current_user` unchanged; web uses cookies but mobile can still use header |

## Data Flow

```text
Login/Signup:
  Web Form → POST /api/v1/auth/login
           → Backend validates credentials
           → Backend sets Set-Cookie: session=<access_jwt>; HttpOnly; Path=/; Max-Age=900
           → Backend sets Set-Cookie: refresh=<refresh_jwt>; HttpOnly; Path=/; Max-Age=604800
           → Backend responds 200 { access_token, refresh_token }  (legacy compat)
           → Web client redirects to /dashboard

Session Check:
  Dashboard Layout → GET /api/v1/auth/session (cookie auto-sent)
                   → Backend reads `session` cookie, validates JWT
                   → Backend responds { user_id, email, role, tenant_id } or 401
                   → Web: if 401, redirect to /login; if ok, render dashboard

Public /iot:
  Visitor → GET /iot
          → Next.js renders static placeholder page (no API call)
          → Page shows "Public access" badge
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `backend/app/api/v1/auth.py` | Modify | Add `POST /signup`, `GET /session`; set httpOnly cookies on login/signup |
| `backend/app/domain/auth/schemas.py` | Modify | Add `SignupRequest`, `SessionResponse`, `UserResponse` schemas |
| `backend/app/domain/auth/middleware.py` | Modify | Add `get_current_user_from_cookie()` dependency |
| `backend/app/seed.py` | New | Seed admin (`admin@crop.local`) + example user (`farmer@crop.local`) with a default tenant |
| `backend/app/main.py` | Modify | Call seed in lifespan when `ENVIRONMENT != "production"` |
| `backend/tests/test_auth.py` | New | Tests for signup, session endpoint, cookie flow |
| `web/src/app/iot/page.tsx` | New | Public placeholder page with "Public access" indicator |
| `web/src/app/dashboard/layout.tsx` | Modify | Replace `getAccessToken()` with cookie session check |
| `web/src/lib/api.ts` | Modify | Add `checkSession()`, remove in-memory token dependency for auth guard |
| `web/src/app/auth/login/page.tsx` | Modify | Use cookie-based login; no manual `setTokens()` |
| `web/src/app/auth/signup/page.tsx` | New | Signup form with email/password |
| `web/src/components/top-bar.tsx` | Modify | Logout clears server-side session (call `/auth/logout`) |
| `web/tests/dashboard.spec.ts` | Modify | Update for cookie-based auth flow |

## Interfaces / Contracts

```python
# backend/app/domain/auth/schemas.py additions
class SignupRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=8)
    name: str | None = None

class SessionResponse(BaseModel):
    user_id: str
    email: str
    role: str
    tenant_id: str
```

```python
# backend/app/api/v1/auth.py additions
@router.post("/signup", status_code=201)
async def signup(body: SignupRequest, db, redis) -> TokenResponse:
    ...

@router.get("/session")
async def check_session(user: Annotated[AuthPayload, Depends(get_current_user_from_cookie)]) -> SessionResponse:
    ...

@router.post("/logout")
async def logout(response: Response):
    response.delete_cookie("session")
    response.delete_cookie("refresh")
```

```python
# backend/app/domain/auth/middleware.py addition
async def get_current_user_from_cookie(request: Request) -> AuthPayload:
    token = request.cookies.get("session")
    if not token:
        raise _CREDENTIALS_EXC
    payload = validate_token(token, expected_type="access")
    return AuthPayload(payload)
```

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | Signup validation, cookie creation helpers | Pytest with `AsyncClient`, inspect `Set-Cookie` headers |
| Unit | Session endpoint with valid/expired/missing cookie | Pytest with cookie injection via `client.cookies` |
| Unit | Seed idempotency (running seed twice) | Pytest; verify no duplicates |
| Integration | Login → cookie persisted → refresh → dashboard access | Pytest full flow with `AsyncClient` cookies |
| E2E | Signup → auto-login → dashboard visible | Playwright; fill form, verify redirect, verify dashboard loads |
| E2E | /iot loads without login | Playwright; navigate directly, confirm "Public access" text |
| E2E | Dashboard redirects to login without cookie | Playwright; clear cookies, navigate to /dashboard, check redirect |

## Migration / Rollout

1. **Phase 1 — Backend**: Deploy cookie-enabled auth endpoints (`/signup`, `/session`, cookies on `/login`). `get_current_user` unchanged. Legacy clients unaffected.
2. **Phase 2 — Web**: Deploy cookie-based dashboard guard. Old dashboard layout still works if user hasn't refreshed (in-memory token still present).
3. **Phase 3 — Cleanup** (post-migration): Remove in-memory token code from `api.ts`; deprecate `TokenResponse` body if no legacy consumers.
- **Rollback**: Revert dashboard layout to in-memory guard; keep `/session` endpoint as optional.

## Open Questions

- [ ] Should refresh cookie rotation update the cookie on each successful refresh?
- [ ] What default tenant name/ID to use for signup auto-assignment?
