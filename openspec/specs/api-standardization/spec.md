# api-standardization Specification

## Purpose
TBD - created by archiving change production-audit-plan. Update Purpose after archive.
## Requirements
### Requirement: Unified API handler for all authenticated routes
All API routes requiring authentication SHALL use `createHandler`, `authHandler`, or `adminHandler` from `lib/api-handler.ts`.

#### Scenario: Route migration completeness per module
- **WHEN** a module batch (admin/generate/projects/episodes/assets/user/misc) is migrated
- **THEN** 100% of routes in that module use unified handlers and contain no bare `error.message` returns

#### Scenario: NextAuth route exclusion
- **WHEN** the migration scans `app/api/auth/[...nextauth]/route.ts`
- **THEN** this route is excluded from migration (not a standard handler)

#### Scenario: SSE route special handling
- **WHEN** a route uses Server-Sent Events (e.g., `debug/logs/stream`)
- **THEN** the handler supports `Response` type (not only `NextResponse`)

### Requirement: Unified API response envelope
All API responses SHALL conform to the envelope format `{success: boolean, data?: T, error?: string, code?: string}`.

#### Scenario: Successful response format
- **WHEN** an API handler returns successfully
- **THEN** the response matches `{success: true, data: T}` with no `error` field

#### Scenario: Error response format
- **WHEN** an API handler encounters an error
- **THEN** the response matches `{success: false, error: string, code?: string}` with no `data` field

#### Scenario: Envelope key-set validation
- **WHEN** any API response JSON is parsed
- **THEN** the key-set is a subset of `{success, data, error, code, requestId}` and `typeof success === 'boolean'`

### Requirement: Zod input validation on all mutating endpoints
All POST/PUT/PATCH/DELETE endpoints SHALL validate request bodies using Zod schemas in strict mode.

#### Scenario: Unknown keys rejected
- **WHEN** a request body contains keys not defined in the Zod schema
- **THEN** the response is 422 Unprocessable Entity with `ZodError.issues` in the response

#### Scenario: Empty string normalization
- **WHEN** a request body contains empty strings for required fields
- **THEN** the field is treated as empty/missing value per schema definition

#### Scenario: Type coercion
- **WHEN** a request body contains string representations of numbers or booleans
- **THEN** Zod coerces them to the correct type only for number/boolean fields

### Requirement: ApiError classification matrix
The error handling framework SHALL map specific error types to fixed HTTP status codes.

#### Scenario: ValidationError mapping
- **WHEN** a `ValidationError` is thrown
- **THEN** the response status is 400

#### Scenario: AuthError mapping
- **WHEN** an `AuthError` is thrown
- **THEN** the response status is 401

#### Scenario: ForbiddenError mapping
- **WHEN** a `ForbiddenError` is thrown
- **THEN** the response status is 403

#### Scenario: RateLimitError mapping
- **WHEN** a `RateLimitError` is thrown
- **THEN** the response status is 429 with `Retry-After` header

### Requirement: SSE error contract
SSE/stream routes SHALL send structured error events before closing the stream.

#### Scenario: Stream error handling
- **WHEN** an error occurs during SSE streaming
- **THEN** the server sends `event:error` with `{code, message}` payload and closes the stream

### Requirement: Async task error persistence
Failed async tasks SHALL persist error details for debugging and retry.

#### Scenario: Task failure recording
- **WHEN** an async generation task fails
- **THEN** the system persists `{taskId, errorCode, retryCount, lastError}` to the database

