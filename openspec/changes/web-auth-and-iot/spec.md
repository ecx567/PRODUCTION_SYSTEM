# web-auth-and-iot Specification

## Domain: web-iot-route

### Requirement: /iot route availability

The system MUST expose a `/iot` route that is reachable without authentication and MUST explicitly state the auth expectation on the page (e.g., “public access” or “sign in required”).

#### Scenario: Public access

- GIVEN a visitor without an auth cookie
- WHEN they request `/iot`
- THEN a placeholder page is returned
- AND the page states the auth expectation

#### Scenario: Authenticated access

- GIVEN a visitor with a valid auth cookie
- WHEN they request `/iot`
- THEN the same placeholder page is returned

## Domain: cookie-session-auth

### Requirement: Cookie-based session persistence

The system MUST establish authentication via httpOnly cookies on login and signup and MUST use cookie/session checks (not in-memory tokens) to guard `/dashboard` access across refreshes.

#### Scenario: Refresh persistence

- GIVEN a user logged in via web
- WHEN they refresh and navigate to `/dashboard`
- THEN access is granted based on the httpOnly cookie

#### Scenario: No cookie present

- GIVEN a user without a valid auth cookie
- WHEN they navigate to `/dashboard`
- THEN access is denied or redirected to login

### Requirement: Login flow without in-memory tokens

The web client MUST treat auth state as server-validated session state and MUST NOT rely on in-memory tokens for authorization decisions.

#### Scenario: In-memory token ignored

- GIVEN a client with a stale in-memory token but no auth cookie
- WHEN they access `/dashboard`
- THEN access is denied

## Domain: user-signup-seeding

### Requirement: Signup creates a session

The system MUST allow user signup and MUST establish a cookie-based session upon successful signup.

#### Scenario: Signup example

- GIVEN a new user with valid signup data
- WHEN they submit signup
- THEN the user is created and an auth cookie is set

### Requirement: Seeded admin and example users

The system MUST seed an admin user and an example user in dev/test environments, and MUST NOT seed in production unless an explicit seed flag is enabled.

#### Scenario: Non-production seeding

- GIVEN the app starts in a dev/test environment
- WHEN seed runs
- THEN admin and example users exist

#### Scenario: Production guard

- GIVEN the app starts in production without a seed flag
- WHEN seed runs
- THEN no seed users are created

### Requirement: Backward compatibility during migration

The system SHOULD continue accepting legacy token-based auth headers and SHOULD document any deprecation timeline for token responses while web clients move to cookies.

#### Scenario: Legacy client compatibility

- GIVEN a client sending an Authorization header token
- WHEN it calls an authenticated endpoint
- THEN access is granted during the migration window
