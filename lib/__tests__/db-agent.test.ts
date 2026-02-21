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

vi.mock('../utils', () => ({
  generateId: vi.fn(() => 'agent-id-001'),
}));

vi.mock('../db', () => ({
  initializeDatabase: vi.fn(),
}));

vi.mock('../db-types', () => ({
  getAffectedRows: (result: any) => result?.affectedRows ?? 0,
}));

import { getAgents, getAgentByKey, createAgent, rollbackAgent } from '../db-agent';

beforeEach(() => {
  vi.clearAllMocks();
  mockExecute.mockResolvedValue([[], {}]);
});

// ---- getAgents ----

describe('getAgents', () => {
  it('returns empty array when no agents', async () => {
    const result = await getAgents();
    expect(result).toEqual([]);
  });

  it('maps rows to AgentSummary[]', async () => {
    const rows = [
      { feature_key: 'story', name: 'Story', description: 'desc', enabled: 1, current_version: 3, updated_at: 1000 },
    ];
    mockExecute.mockResolvedValue([rows, {}]);
    const result = await getAgents();
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      featureKey: 'story',
      name: 'Story',
      description: 'desc',
      enabled: true,
      currentVersion: 3,
      updatedAt: 1000,
    });
  });
});

// ---- getAgentByKey ----

describe('getAgentByKey', () => {
  it('returns null when not found', async () => {
    const result = await getAgentByKey('nonexistent');
    expect(result).toBeNull();
  });

  it('maps row to LlmAgent', async () => {
    const row = {
      feature_key: 'story',
      name: 'Story Agent',
      description: 'Generates stories',
      config_json: '{"role":"writer","rules":[],"workflow":[],"examples":[],"returnFormat":"","placeholders":[]}',
      system_prompt: 'You are a writer',
      user_prompt_template: '{{input}}',
      default_config_json: '{}',
      default_system_prompt: 'default',
      default_user_prompt_template: '{{input}}',
      current_version: 2,
      enabled: 1,
      created_at: 1000,
      updated_at: 2000,
    };
    mockExecute.mockResolvedValue([[row], {}]);
    const agent = await getAgentByKey('story');
    expect(agent).toBeDefined();
    expect(agent!.featureKey).toBe('story');
    expect(agent!.currentVersion).toBe(2);
    expect(agent!.config.role).toBe('writer');
  });

  it('handles invalid config JSON gracefully', async () => {
    const row = {
      feature_key: 'bad',
      name: 'Bad',
      description: '',
      config_json: 'not-json',
      system_prompt: '',
      user_prompt_template: '',
      default_config_json: '{}',
      default_system_prompt: '',
      default_user_prompt_template: '',
      current_version: 1,
      enabled: 0,
      created_at: 1000,
      updated_at: 1000,
    };
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    mockExecute.mockResolvedValue([[row], {}]);
    const agent = await getAgentByKey('bad');
    expect(agent).toBeDefined();
    expect(agent!.config.role).toBe('');
  });
});

// ---- createAgent ----

describe('createAgent', () => {
  it('uses transaction to insert agent + version', async () => {
    const txExecute = vi.fn().mockResolvedValue([[], {}]);
    mockRunTransaction.mockImplementation(async (fn: any) => {
      await fn({ execute: txExecute, runTransaction: vi.fn(), close: vi.fn() });
    });
    // After transaction, getAgentByKey is called
    const agentRow = {
      feature_key: 'test',
      name: 'Test',
      description: 'desc',
      config_json: '{}',
      system_prompt: 'sys',
      user_prompt_template: 'usr',
      default_config_json: '{}',
      default_system_prompt: 'sys',
      default_user_prompt_template: 'usr',
      current_version: 1,
      enabled: 1,
      created_at: 1000,
      updated_at: 1000,
    };
    mockExecute.mockResolvedValue([[agentRow], {}]);

    const result = await createAgent({
      featureKey: 'test',
      name: 'Test',
      description: 'desc',
      config: { role: '', rules: [], workflow: [], examples: [], returnFormat: '', placeholders: [] },
      systemPrompt: 'sys',
      userPromptTemplate: 'usr',
    });

    expect(mockRunTransaction).toHaveBeenCalledTimes(1);
    expect(txExecute).toHaveBeenCalledTimes(2); // INSERT agent + INSERT version
    expect(result.featureKey).toBe('test');
  });
});

// ---- rollbackAgent ----

describe('rollbackAgent', () => {
  it('returns null when agent not found', async () => {
    mockExecute.mockResolvedValue([[], {}]);
    const result = await rollbackAgent('nonexistent', 1);
    expect(result).toBeNull();
  });
});
