import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock adapter
const mockExecute = vi.fn();
const mockRunTransaction = vi.fn();
const mockAdapter = {
  execute: mockExecute,
  runTransaction: mockRunTransaction,
  close: vi.fn(),
};

vi.mock('../db-connection', () => ({
  getSharedAdapter: () => mockAdapter,
}));

// Mock cache to pass through
vi.mock('../cache', () => ({
  cache: { get: vi.fn(), set: vi.fn(), del: vi.fn() },
  CacheKeys: { SYSTEM_CONFIG: 'sc' },
  CacheTTL: { SYSTEM_CONFIG: 60 },
  withCache: vi.fn((_k: string, _t: number, fn: () => unknown) => fn()),
}));

// Mock bcrypt
vi.mock('bcryptjs', () => ({
  default: {
    hash: vi.fn(async (pw: string) => `hashed_${pw}`),
    compare: vi.fn(async (pw: string, hash: string) => hash === `hashed_${pw}`),
  },
}));

// Mock utils
vi.mock('../utils', () => ({
  generateId: vi.fn(() => 'test-id-001'),
}));

// Stub initializeDatabase (called by every exported fn)
let dbInitialized = false;
vi.mock('../db-pagination', () => ({
  appendLimitOffset: (sql: string, _p: unknown[], limit: number, offset: number) =>
    `${sql} LIMIT ${limit} OFFSET ${offset}`,
}));
vi.mock('../db-types', () => ({
  getAffectedRows: (result: any) => result?.affectedRows ?? 0,
}));

// Retry config validator mock
vi.mock('../retry-config-validator', () => ({
  applyHardLimits: vi.fn((c: unknown) => c),
  getDefaultRetryConfig: vi.fn(() => ({})),
  mergeRetryConfig: vi.fn((_a: unknown, b: unknown) => b),
}));

// Agent utils mock
vi.mock('../agent-utils', () => ({
  compileSystemPrompt: vi.fn(() => 'compiled'),
}));

import {
  getUserById,
  getUserByEmail,
  deleteUser,
  getGeneration,
  saveGeneration,
  getSystemConfig,
} from '../db';

beforeEach(() => {
  vi.clearAllMocks();
  // initializeDatabase uses a flag; reset module state
  dbInitialized = false;
  // Make initializeDatabase a no-op by having the tables-check succeed
  mockExecute.mockResolvedValue([[], {}]);
});

// ---- getUserById ----

describe('getUserById', () => {
  it('returns null when no rows', async () => {
    mockExecute.mockResolvedValue([[], {}]);
    const result = await getUserById('nonexistent');
    expect(result).toBeNull();
  });

  it('maps row to User object', async () => {
    const row = {
      id: 'u1',
      email: 'a@b.com',
      password: 'hash',
      name: 'Alice',
      role: 'user',
      balance: 100,
      disabled: 0,
      concurrency_limit: null,
      created_at: 1000,
      updated_at: 2000,
    };
    mockExecute.mockResolvedValue([[row], {}]);
    const user = await getUserById('u1');
    expect(user).toEqual({
      id: 'u1',
      email: 'a@b.com',
      password: 'hash',
      name: 'Alice',
      role: 'user',
      balance: 100,
      disabled: false,
      concurrencyLimit: null,
      createdAt: 1000,
      updatedAt: 2000,
    });
  });
});

// ---- getUserByEmail ----

describe('getUserByEmail', () => {
  it('returns null when no rows', async () => {
    mockExecute.mockResolvedValue([[], {}]);
    const result = await getUserByEmail('nobody@test.com');
    expect(result).toBeNull();
  });
});

// ---- deleteUser ----

describe('deleteUser', () => {
  it('returns true when affected rows > 0', async () => {
    // deleteUser uses `const [result]` — first element is ResultSetHeader (MySQL)
    mockExecute.mockResolvedValue([{ affectedRows: 1 }, {}]);
    const result = await deleteUser('u1');
    expect(result).toBe(true);
  });

  it('returns false when no rows affected', async () => {
    mockExecute.mockResolvedValue([[], { affectedRows: 0 }]);
    const result = await deleteUser('nonexistent');
    expect(result).toBe(false);
  });
});

// ---- getSystemConfig ----

describe('getSystemConfig', () => {
  it('returns default config when no rows in DB', async () => {
    mockExecute.mockResolvedValue([[], {}]);
    const config = await getSystemConfig();
    expect(config).toBeDefined();
    expect(config.defaultBalance).toBe(100);
    expect(config.pricing.soraVideo10s).toBe(100);
  });
});

// ---- saveGeneration ----

describe('saveGeneration', () => {
  it('creates generation with ID and timestamps', async () => {
    mockExecute.mockResolvedValue([[], {}]);
    const gen = await saveGeneration({
      userId: 'u1',
      type: 'sora-video',
      prompt: 'test prompt',
      params: {},
      resultUrl: null,
      cost: 10,
      status: 'pending',
      errorMessage: null,
    } as any);

    expect(gen.id).toBe('test-id-001');
    expect(gen.userId).toBe('u1');
    expect(gen.createdAt).toBeGreaterThan(0);
    expect(gen.updatedAt).toBe(gen.createdAt);
    expect(mockExecute).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO generations'),
      expect.any(Array),
    );
  });
});

// ---- getGeneration ----

describe('getGeneration', () => {
  it('returns null when no rows', async () => {
    mockExecute.mockResolvedValue([[], {}]);
    const result = await getGeneration('nonexistent');
    expect(result).toBeNull();
  });

  it('maps row to Generation object', async () => {
    const row = {
      id: 'g1',
      user_id: 'u1',
      type: 'sora-video',
      prompt: 'hello',
      params: '{}',
      result_url: 'https://example.com/video.mp4',
      cost: 100,
      balance_precharged: 1,
      balance_refunded: 0,
      status: 'completed',
      error_message: null,
      created_at: 1000,
      updated_at: 2000,
    };
    mockExecute.mockResolvedValue([[row], {}]);
    const gen = await getGeneration('g1');
    expect(gen).toBeDefined();
    expect(gen!.id).toBe('g1');
    expect(gen!.userId).toBe('u1');
    expect(gen!.balancePrecharged).toBe(true);
  });
});
