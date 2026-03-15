# webhook-verification Specification

## Purpose
TBD - created by archiving change production-audit-plan. Update Purpose after archive.
## Requirements
### Requirement: Webhook token generation specification
The webhook system SHALL generate cryptographically secure one-time tokens.

#### Scenario: Token entropy
- **WHEN** a webhook token is generated
- **THEN** it contains exactly 32 bytes of cryptographic random entropy encoded as base64url

### Requirement: Webhook token secure storage
Webhook tokens SHALL be stored as hashes only, never in plaintext.

#### Scenario: Hash-only persistence
- **WHEN** a webhook token is persisted to the database
- **THEN** only the SHA-256 hash is stored; the plaintext token never appears in the database

#### Scenario: Log safety
- **WHEN** a webhook token is logged (valid, invalid, or expired)
- **THEN** the log entry does not contain the raw token value

### Requirement: Webhook token lifecycle management
Webhook tokens SHALL have a defined TTL and deterministic expiry behavior.

#### Scenario: Token TTL enforcement
- **WHEN** a token is older than 24 hours
- **THEN** the webhook endpoint returns 410 Gone

#### Scenario: Token destruction after task completion
- **WHEN** a generation task reaches terminal state (completed/failed)
- **THEN** the associated webhook token is marked as consumed/expired

### Requirement: Atomic token consumption
Webhook token consumption SHALL be atomic to prevent concurrent double-consumption.

#### Scenario: Compare-and-set consumption
- **WHEN** a valid token is consumed
- **THEN** a single SQL statement atomically marks it as consumed (compare-and-set)

#### Scenario: Concurrent double-submit prevention
- **WHEN** two identical webhook callbacks arrive simultaneously
- **THEN** only one succeeds in consuming the token; the other receives idempotent 200

### Requirement: Webhook state determinism under out-of-order delivery
The webhook system SHALL resolve out-of-order state updates to the correct terminal state.

#### Scenario: Out-of-order webhook delivery
- **WHEN** webhook updates for a task arrive in reverse order (e.g., "completed" before "processing")
- **THEN** the final database state reflects the terminal state ("completed"), not the last-received state

