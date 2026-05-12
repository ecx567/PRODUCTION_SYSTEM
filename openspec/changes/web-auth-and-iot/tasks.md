# Tasks: web-auth-and-iot

## Phase 1: Foundation — Backend Core

- [x] 1.1 Add `SignupRequest`, `SessionResponse` schemas to `backend/app/domain/auth/schemas.py`
- [x] 1.2 Add `get_current_user_from_cookie()` to `backend/app/domain/auth/middleware.py`
- [x] 1.3 Create `backend/app/seed.py` — seed admin (`admin@crop.local`) + example/farmer user with default tenant
- [x] 1.4 Add seed call in `backend/app/main.py` lifespan when `ENVIRONMENT != "production"`

## Phase 2: Backend Endpoints

- [x] 2.1 Add `set_auth_cookies()` / `clear_auth_cookies()` cookie helpers to auth router
- [x] 2.2 Modify `POST /login` — set httpOnly `session` + `refresh` cookies (retain JSON body for legacy)
- [x] 2.3 Add `POST /signup` — create user + set cookies + return TokenResponse (legacy compat)
- [x] 2.4 Add `GET /session` — validate `session` cookie, return SessionResponse or 401
- [x] 2.5 Add `POST /logout` — delete `session` + `refresh` cookies

## Review Workload Forecast

- 400-line budget risk: Medium
- Chained PRs recommended: No
- Decision needed before apply: No
- Chain strategy: stacked-to-main (PR 1 targets main)

## Delivery

- Current batch: PR 1 — Backend Core + Backend Endpoints
- Mode: standard (no strict TDD)
