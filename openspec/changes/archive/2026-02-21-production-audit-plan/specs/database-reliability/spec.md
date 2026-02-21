## ADDED Requirements

### Requirement: Parameterized SQL for all queries
All database queries SHALL use parameterized queries (`?` placeholders) for LIMIT, OFFSET, and all user-derived values. No string interpolation in SQL text.

#### Scenario: LIMIT/OFFSET parameterization
- **WHEN** a paginated query is executed with user-provided limit and offset
- **THEN** the SQL text contains `LIMIT ? OFFSET ?` and the values appear only in the params array

#### Scenario: SQL injection resistance
- **WHEN** attacker strings (`' OR 1=1 --`, `${...}`, `;DROP`) are passed as query inputs
- **THEN** the attacker payload appears only in `params`, never embedded in the SQL text

### Requirement: Pagination helper function
A shared `normalizePagination()` function SHALL validate and clamp all pagination parameters.

#### Scenario: Pagination bounds enforcement
- **WHEN** pagination parameters are provided
- **THEN** offset ≥ 0 and 1 ≤ limit ≤ 100, with `Number()` + `Math.floor()` + clamp applied

### Requirement: NULL-safe data layer
All database functions accepting nullable inputs SHALL handle null/undefined gracefully without crashing.

#### Scenario: Null input to getProjectAssetByName
- **WHEN** `getProjectAssetByName` receives `null` or `undefined` as name
- **THEN** the function returns `null` without throwing a runtime exception

#### Scenario: Null-like value handling
- **WHEN** `null`, `undefined`, `''`, or `NaN` is passed to nullable database fields
- **THEN** no uncaught exception occurs; the function returns `null`, empty result, or validation error

### Requirement: Database migration version control
The system SHALL track database schema versions using a `schema_migrations` table with checksums.

#### Scenario: Migration table schema
- **WHEN** the migration system initializes
- **THEN** a `schema_migrations` table exists with columns `{id, checksum, executed_at, success}`

#### Scenario: Migration idempotency
- **WHEN** the same migration is executed twice on the same database
- **THEN** the second execution is a no-op (schema hash and row counts unchanged)

#### Scenario: Strict ordering
- **WHEN** migration files are registered in random order
- **THEN** the runner executes them in strict timestamp-id order

#### Scenario: Checksum drift detection
- **WHEN** an already-executed migration file's content has changed (checksum mismatch)
- **THEN** the application fails to start with an explicit error requiring human intervention

#### Scenario: Concurrent execution protection
- **WHEN** two instances attempt to run migrations simultaneously
- **THEN** only one acquires the lock (MySQL `GET_LOCK` / SQLite file lock); the other waits or fails gracefully

#### Scenario: Migration failure handling
- **WHEN** a migration fails mid-execution
- **THEN** the application stops startup, preserves the failure record, and provides a retry entry point

#### Scenario: Production baseline
- **WHEN** migrations run against an existing production database
- **THEN** the baseline version is written to `schema_migrations` and already-executed DDL is skipped

### Requirement: Savepoint-based nested transactions
Nested transaction calls SHALL use savepoint semantics instead of throwing errors.

#### Scenario: Inner rollback preserves outer transaction
- **WHEN** an inner transaction is rolled back
- **THEN** `ROLLBACK TO SAVEPOINT` is issued, and the outer transaction remains valid

#### Scenario: Nested depth support
- **WHEN** transactions are nested to depth N (1..3)
- **THEN** each level uses a distinct savepoint and can independently commit or rollback

### Requirement: Connection pool health monitoring
The MySQL connection pool SHALL implement health checking with a three-state machine.

#### Scenario: Health probe execution
- **WHEN** the heartbeat interval (30s) elapses
- **THEN** the pool executes `SELECT 1` with a 2s timeout

#### Scenario: Degradation on consecutive failures
- **WHEN** 1-2 consecutive probe failures occur
- **THEN** the pool transitions to `degraded` state

#### Scenario: Unhealthy threshold
- **WHEN** 3+ consecutive probe failures occur
- **THEN** the pool transitions to `unhealthy`, rejects new requests, and triggers rebuild

#### Scenario: Recovery after successful probe
- **WHEN** the pool is `unhealthy` and a probe succeeds
- **THEN** the pool transitions back to `healthy` and resumes serving requests

#### Scenario: Rebuild single-flight protection
- **WHEN** multiple rebuild attempts are triggered concurrently
- **THEN** only one rebuild executes (single-flight); others wait for its result

#### Scenario: Rebuild failure cooldown
- **WHEN** a pool rebuild fails
- **THEN** the next rebuild attempt waits at least 30s (cooldown)

#### Scenario: Queue limit enforcement
- **WHEN** pending requests exceed `queueLimit` (connectionLimit * 4, min=10, max=200)
- **THEN** overflow requests are rejected immediately

### Requirement: Type-safe database layer
The database layer SHALL minimize `as any` type assertions to fewer than 10 occurrences.

#### Scenario: Type assertion reduction
- **WHEN** the `as any` cleanup is complete
- **THEN** `grep "as any" lib/db*.ts` returns fewer than 10 matches
