import { describe, it, expect } from 'vitest';
import {
  toSafeAgent,
  compileSystemPrompt,
  compileUserPromptTemplate,
  validateAgentConfig,
  validateAgentInput,
} from '../agent-utils';
import type { LlmAgent, AgentConfig } from '@/types';

// ---- helpers ----

function makeFakeAgent(overrides: Partial<LlmAgent> = {}): LlmAgent {
  return {
    featureKey: 'test_agent',
    name: 'Test Agent',
    description: 'desc',
    config: { role: '', rules: [], workflow: [], examples: [], returnFormat: '', placeholders: [] },
    systemPrompt: 'sys',
    userPromptTemplate: 'usr',
    defaultConfig: { role: 'dr', rules: [], workflow: [], examples: [], returnFormat: '', placeholders: [] },
    defaultSystemPrompt: 'default-sys',
    defaultUserPromptTemplate: 'default-usr',
    currentVersion: 1,
    enabled: true,
    createdAt: 0,
    updatedAt: 0,
    ...overrides,
  };
}

function makeConfig(overrides: Partial<AgentConfig> = {}): AgentConfig {
  return {
    role: '',
    rules: [],
    workflow: [],
    examples: [],
    returnFormat: '',
    placeholders: [],
    ...overrides,
  };
}

// ---- toSafeAgent ----

describe('toSafeAgent', () => {
  it('strips defaultConfig / defaultSystemPrompt / defaultUserPromptTemplate', () => {
    const agent = makeFakeAgent();
    const safe = toSafeAgent(agent);
    expect(safe).not.toHaveProperty('defaultConfig');
    expect(safe).not.toHaveProperty('defaultSystemPrompt');
    expect(safe).not.toHaveProperty('defaultUserPromptTemplate');
  });

  it('preserves public fields', () => {
    const agent = makeFakeAgent({ featureKey: 'abc', name: 'Hello' });
    const safe = toSafeAgent(agent);
    expect(safe.featureKey).toBe('abc');
    expect(safe.name).toBe('Hello');
    expect(safe.systemPrompt).toBe('sys');
  });
});

// ---- compileSystemPrompt ----

describe('compileSystemPrompt', () => {
  it('returns empty string for empty config', () => {
    expect(compileSystemPrompt(makeConfig())).toBe('');
  });

  it('includes role section', () => {
    const result = compileSystemPrompt(makeConfig({ role: 'You are a writer' }));
    expect(result).toContain('# Role');
    expect(result).toContain('You are a writer');
  });

  it('includes numbered rules', () => {
    const result = compileSystemPrompt(
      makeConfig({
        rules: [
          { id: '1', title: 'Be concise', content: 'Keep it short' },
          { id: '2', title: 'Be accurate', content: 'No hallucination' },
        ],
      })
    );
    expect(result).toContain('# Rules');
    expect(result).toContain('1. Be concise: Keep it short');
    expect(result).toContain('2. Be accurate: No hallucination');
  });

  it('includes workflow steps', () => {
    const result = compileSystemPrompt(
      makeConfig({
        workflow: [{ id: '1', title: 'Analyze', content: 'Read input' }],
      })
    );
    expect(result).toContain('# Workflow');
    expect(result).toContain('1. Analyze: Read input');
  });

  it('includes examples with input/output', () => {
    const result = compileSystemPrompt(
      makeConfig({
        examples: [{ id: '1', title: 'Demo', input: 'hello', output: 'world' }],
      })
    );
    expect(result).toContain('# Examples');
    expect(result).toContain('## Demo');
    expect(result).toContain('Input: hello');
    expect(result).toContain('Output: world');
  });

  it('includes output format', () => {
    const result = compileSystemPrompt(makeConfig({ returnFormat: 'JSON' }));
    expect(result).toContain('# Output Format');
    expect(result).toContain('JSON');
  });

  it('joins multiple sections with double newline', () => {
    const result = compileSystemPrompt(makeConfig({ role: 'R', returnFormat: 'F' }));
    expect(result).toBe('# Role\nR\n\n# Output Format\nF');
  });
});

// ---- compileUserPromptTemplate ----

describe('compileUserPromptTemplate', () => {
  it('returns empty string when no required placeholders', () => {
    expect(compileUserPromptTemplate(makeConfig())).toBe('');
    expect(
      compileUserPromptTemplate(
        makeConfig({
          placeholders: [{ id: '1', key: 'OPT', description: '', required: false }],
        })
      )
    ).toBe('');
  });

  it('returns single placeholder directly', () => {
    const result = compileUserPromptTemplate(
      makeConfig({
        placeholders: [{ id: '1', key: 'CONTENT', description: '', required: true }],
      })
    );
    expect(result).toBe('{{CONTENT}}');
  });

  it('prefers CONTENT key when multiple required', () => {
    const result = compileUserPromptTemplate(
      makeConfig({
        placeholders: [
          { id: '1', key: 'FOO', description: '', required: true },
          { id: '2', key: 'CONTENT', description: '', required: true },
        ],
      })
    );
    expect(result).toBe('{{CONTENT}}');
  });

  it('prefers PROMPT key when multiple required', () => {
    const result = compileUserPromptTemplate(
      makeConfig({
        placeholders: [
          { id: '1', key: 'FOO', description: '', required: true },
          { id: '2', key: 'PROMPT', description: '', required: true },
        ],
      })
    );
    expect(result).toBe('{{PROMPT}}');
  });

  it('joins all keys when no preferred key found', () => {
    const result = compileUserPromptTemplate(
      makeConfig({
        placeholders: [
          { id: '1', key: 'A', description: '', required: true },
          { id: '2', key: 'B', description: '', required: true },
        ],
      })
    );
    expect(result).toBe('{{A}}\n\n{{B}}');
  });
});

// ---- validateAgentConfig ----

describe('validateAgentConfig', () => {
  it('rejects null / non-object', () => {
    expect(validateAgentConfig(null).valid).toBe(false);
    expect(validateAgentConfig(undefined).valid).toBe(false);
    expect(validateAgentConfig('str').valid).toBe(false);
  });

  it('accepts empty object', () => {
    expect(validateAgentConfig({}).valid).toBe(true);
  });

  it('rejects non-string role', () => {
    expect(validateAgentConfig({ role: 123 }).valid).toBe(false);
  });

  it('rejects non-array rules', () => {
    expect(validateAgentConfig({ rules: 'bad' }).valid).toBe(false);
  });

  it('rejects non-array workflow', () => {
    expect(validateAgentConfig({ workflow: {} }).valid).toBe(false);
  });

  it('rejects non-array examples', () => {
    expect(validateAgentConfig({ examples: 42 }).valid).toBe(false);
  });

  it('rejects non-string returnFormat', () => {
    expect(validateAgentConfig({ returnFormat: [] }).valid).toBe(false);
  });

  it('rejects non-array placeholders', () => {
    expect(validateAgentConfig({ placeholders: 'x' }).valid).toBe(false);
  });

  it('rejects oversized config', () => {
    const huge = { role: 'x'.repeat(60000) };
    expect(validateAgentConfig(huge).valid).toBe(false);
    expect(validateAgentConfig(huge).error).toContain('最大长度限制');
  });
});

// ---- validateAgentInput ----

describe('validateAgentInput', () => {
  it('accepts valid input', () => {
    expect(validateAgentInput({ name: 'ok', description: 'fine' }).valid).toBe(true);
  });

  it('rejects oversized name', () => {
    const result = validateAgentInput({ name: 'x'.repeat(101) });
    expect(result.valid).toBe(false);
    expect(result.error).toContain('name');
  });

  it('rejects oversized description', () => {
    const result = validateAgentInput({ description: 'x'.repeat(501) });
    expect(result.valid).toBe(false);
    expect(result.error).toContain('description');
  });

  it('rejects oversized userPromptTemplate', () => {
    const result = validateAgentInput({ userPromptTemplate: 'x'.repeat(50001) });
    expect(result.valid).toBe(false);
    expect(result.error).toContain('userPromptTemplate');
  });

  it('rejects oversized systemPrompt', () => {
    const result = validateAgentInput({ systemPrompt: 'x'.repeat(50001) });
    expect(result.valid).toBe(false);
    expect(result.error).toContain('systemPrompt');
  });
});
