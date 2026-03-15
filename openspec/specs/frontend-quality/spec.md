# frontend-quality Specification

## Purpose
TBD - created by archiving change production-audit-plan. Update Purpose after archive.
## Requirements
### Requirement: React Query API client with unified fetch wrapper
The frontend SHALL use a centralized `apiFetch()` wrapper integrated with React Query for all API calls.

#### Scenario: Response contract enforcement
- **WHEN** `apiFetch()` receives a response
- **THEN** it validates the envelope format `{success, data?, error?, code?, requestId?}` and throws on protocol errors

#### Scenario: Request timeout
- **WHEN** an API request exceeds 10 seconds
- **THEN** `apiFetch()` aborts via AbortController and throws `ApiError(code='UPSTREAM_TIMEOUT')`

#### Scenario: Authentication handling
- **WHEN** an API response returns 401
- **THEN** the client redirects to the login page

#### Scenario: React Query global defaults
- **WHEN** React Query is initialized
- **THEN** defaults are `staleTime=30s, gcTime=5min, retry=2, refetchOnWindowFocus=false`

### Requirement: Component decomposition for create page
The `create/page.tsx` (1181 lines, 30+ state) SHALL be decomposed into focused sub-components.

#### Scenario: Component size compliance
- **WHEN** the refactoring is complete
- **THEN** no single component file exceeds 300 lines

#### Scenario: State variable reduction
- **WHEN** the page is decomposed
- **THEN** no single component manages more than 10 state variables

### Requirement: Workspace store separation
The `workspace-store.ts` (649 lines) SHALL be split into domain-specific Zustand stores.

#### Scenario: Store decomposition
- **WHEN** the store is split
- **THEN** separate stores exist for episodes, assets, and UI state

#### Scenario: Facade backward compatibility
- **WHEN** the store is split
- **THEN** a facade re-exports from granular stores to avoid breaking existing imports during migration

### Requirement: Vitest testing infrastructure
The project SHALL use Vitest with React Testing Library for unit and component testing.

#### Scenario: Coverage thresholds
- **WHEN** tests are run with coverage
- **THEN** global coverage ≥ 60%, `lib/` coverage ≥ 70%, `api-handler` coverage ≥ 80%

#### Scenario: CI test matrix
- **WHEN** CI pipeline runs
- **THEN** tests execute against sqlite, mysql, and mysql+redis-down configurations

#### Scenario: Critical failure path coverage
- **WHEN** the test suite is reviewed
- **THEN** it includes tests for: token replay, token expiry, redis unavailable (fail-open), connection pool unhealthy recovery

### Requirement: User credits non-negativity invariant
The system SHALL guarantee user credit balance never goes below zero under any concurrency scenario.

#### Scenario: Concurrent generation requests
- **WHEN** N concurrent generation requests are submitted for a user who can only afford M (N > M)
- **THEN** at most M requests are accepted and the balance remains ≥ 0

### Requirement: Referential integrity for generations and assets
Every generation record and project asset SHALL maintain valid foreign key references.

#### Scenario: Orphan prevention during deletion
- **WHEN** a project or user is deleted while background tasks are running
- **THEN** no orphaned records are created (assets always reference valid projects, generations always reference valid users)

