## ADDED Requirements

### Requirement: Redis-backed sliding window rate limiting
The system SHALL enforce rate limits using Redis sliding window algorithm with Lua atomic scripts.

#### Scenario: Rate limit enforcement within window
- **WHEN** a user sends requests within a time window
- **THEN** accepted requests ≤ maxRequests (API=60/min, AUTH=5/min, GENERATE=10/min, CHAT=20/min)

#### Scenario: Rate limit rejection
- **WHEN** a user exceeds maxRequests within the window
- **THEN** the response is 429 Too Many Requests with `Retry-After` header

#### Scenario: Key isolation between users
- **WHEN** user A is rate-limited
- **THEN** user B's requests are unaffected (independent counters per `{scope}:{route}:{userId|ip}`)

#### Scenario: Window reset accuracy
- **WHEN** the rate limit window expires
- **THEN** the counter resets to 0 and subsequent requests are accepted

#### Scenario: Redis fail-open behavior
- **WHEN** Redis is unavailable (timeout/connection error)
- **THEN** requests pass through (fail-open), a structured alert event is emitted, and business write paths are unaffected

#### Scenario: Redis alert deduplication
- **WHEN** Redis is continuously unavailable
- **THEN** alerts are deduplicated with a 5-minute suppression window

#### Scenario: Redis operation timeout
- **WHEN** a Redis command takes longer than 200ms
- **THEN** the command times out, retries once, then falls back to fail-open

#### Scenario: Proxy IP trust
- **WHEN** `TRUST_PROXY=true` is set
- **THEN** the rate limiter reads the first trusted IP from `X-Forwarded-For`; otherwise uses `x-real-ip` or remote address

### Requirement: Docker Compose Redis service
The Docker deployment SHALL include a Redis service for rate limiting.

#### Scenario: Redis service in compose
- **WHEN** `docker-compose up` is executed
- **THEN** a Redis container starts alongside the application, connected via `REDIS_URL` environment variable

### Requirement: Docker health check endpoint
The application SHALL expose a health check endpoint for container orchestration.

#### Scenario: Healthy response
- **WHEN** the database connection is reachable
- **THEN** `GET /api/health` returns `{status: "ok"}` with HTTP 200

#### Scenario: Unhealthy response
- **WHEN** the database connection fails
- **THEN** `GET /api/health` returns `{status: "error"}` with HTTP 503, without exposing internal error details

#### Scenario: Docker HEALTHCHECK integration
- **WHEN** the Dockerfile is built
- **THEN** it includes `HEALTHCHECK CMD curl -f http://localhost:3000/api/health || exit 1`

### Requirement: Required environment variable validation
The application SHALL validate all required environment variables at startup.

#### Scenario: Complete variable list enforcement
- **WHEN** the application starts
- **THEN** it validates presence of: NEXTAUTH_URL, NEXTAUTH_SECRET, DB_TYPE, MYSQL_HOST, MYSQL_USER, MYSQL_PASSWORD, MYSQL_DATABASE, ADMIN_EMAIL, ADMIN_PASSWORD, REDIS_URL

#### Scenario: Missing variable startup failure
- **WHEN** any required variable is missing
- **THEN** the application fails to start with an explicit error naming the missing variable

### Requirement: Secret injection priority
Secrets SHALL follow a strict priority order with no implicit defaults.

#### Scenario: Priority enforcement
- **WHEN** secrets are loaded
- **THEN** runtime env takes precedence over secret file, and no implicit default production keys exist

### Requirement: Unified environment variable naming
All environment variables SHALL use consistent naming across `.env.example`, `docker-compose.yml`, and application code.

#### Scenario: MYSQL_DATABASE naming fix
- **WHEN** the MySQL database name is referenced
- **THEN** all locations use `MYSQL_DATABASE` (not `MYSQL_NAME`)
