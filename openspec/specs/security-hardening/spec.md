# security-hardening Specification

## Purpose
TBD - created by archiving change production-audit-plan. Update Purpose after archive.
## Requirements
### Requirement: Error stack trace masking in production
The system SHALL NOT expose error stack traces, file paths, or raw Error.message in API responses when `NODE_ENV=production`.

#### Scenario: Internal server error in production
- **WHEN** an API handler throws an unhandled error in production mode
- **THEN** the response body contains only `{success: false, error: <fallbackMessage>, code: "INTERNAL_ERROR"}` with no stack trace

#### Scenario: Sentinel text injection
- **WHEN** an error containing file paths like `C:\secret\file.ts` or `at fn(...)` is thrown
- **THEN** the response body does not contain any substring matching stack trace patterns

### Requirement: Docker secrets runtime injection
The system SHALL inject all secrets via runtime environment variables, with no hardcoded secret values in docker-compose.yml.

#### Scenario: Compose file contains no literal secrets
- **WHEN** docker-compose.yml is scanned for high-entropy strings or password literals
- **THEN** all secret entries match `${VAR:?required}` pattern

#### Scenario: Missing required variable blocks startup
- **WHEN** any required env var (NEXTAUTH_SECRET, MYSQL_PASSWORD, ADMIN_PASSWORD, REDIS_URL) is omitted
- **THEN** the container fails to start with an explicit missing-var error

### Requirement: Env file contains no real credentials
The system SHALL ensure `.env.local` contains only placeholder values, never real production secrets.

#### Scenario: Secret rotation after exposure
- **WHEN** a secret is found in version control
- **THEN** the secret MUST be rotated immediately and all existing sessions invalidated

### Requirement: Unified error response masking
All API routes SHALL return sanitized error messages that do not leak internal implementation details.

#### Scenario: Catch block error masking
- **WHEN** a catch block in `image/route.ts`, `sora/route.ts`, or `register/route.ts` catches an error
- **THEN** the response returns only the route's `fallbackMessage`, not `error.message`

### Requirement: Webhook callback verification via URL token
The KIE-AI webhook endpoint SHALL verify callbacks using a one-time URL token.

#### Scenario: Valid token consumption
- **WHEN** a webhook callback arrives with a valid, unexpired token
- **THEN** the token is atomically consumed (compare-and-set) and the task state is updated

#### Scenario: Replayed token returns idempotent success
- **WHEN** a webhook callback arrives with an already-consumed token
- **THEN** the response is 200 OK with no state mutation

#### Scenario: Expired token rejection
- **WHEN** a webhook callback arrives with a token older than 24h
- **THEN** the response is 410 Gone with no state mutation

#### Scenario: Invalid token rejection
- **WHEN** a webhook callback arrives with an unrecognized token
- **THEN** the response is 401 Unauthorized, and the log does not contain the raw token value

### Requirement: Debug endpoint admin protection
All `/api/debug/*` endpoints SHALL require admin role authentication.

#### Scenario: Non-admin access to debug endpoint
- **WHEN** a non-admin authenticated user accesses `/api/debug/quota`
- **THEN** the response is 403 Forbidden with no data returned

### Requirement: Password change requires current password verification
The password change endpoint SHALL require `currentPassword` for all password modifications.

#### Scenario: Missing currentPassword
- **WHEN** a password change request omits `currentPassword`
- **THEN** the response is 400 Bad Request and the password hash remains unchanged

#### Scenario: Wrong currentPassword
- **WHEN** a password change request provides an incorrect `currentPassword`
- **THEN** the response is 401 Unauthorized and the password hash remains unchanged

### Requirement: Admin page route protection in middleware
The middleware SHALL redirect unauthenticated users accessing `/admin/*` to the login page.

#### Scenario: Unauthenticated admin page access
- **WHEN** an unauthenticated user navigates to `/admin/users`
- **THEN** the middleware redirects to `/login` with a return URL parameter

