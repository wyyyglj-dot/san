import { describe, it, expect } from 'vitest';
import {
  renderTemplate,
  renderPromptPair,
  validateTemplate,
  validateTemplatePair,
} from '../prompt-service';

// ---- renderTemplate ----

describe('renderTemplate', () => {
  it('replaces known variables', () => {
    expect(renderTemplate('Hello {{NAME}}', { NAME: 'World' })).toBe('Hello World');
  });

  it('replaces multiple variables', () => {
    const result = renderTemplate('{{A}} and {{B}}', { A: 'x', B: 'y' });
    expect(result).toBe('x and y');
  });

  it('replaces with empty string when variable missing', () => {
    expect(renderTemplate('Hi {{MISSING}}!', {})).toBe('Hi !');
  });

  it('handles whitespace inside braces', () => {
    expect(renderTemplate('{{ NAME }}', { NAME: 'ok' })).toBe('ok');
  });

  it('returns original when no placeholders', () => {
    expect(renderTemplate('plain text', {})).toBe('plain text');
  });
});

// ---- renderPromptPair ----

describe('renderPromptPair', () => {
  it('renders both system and user templates', () => {
    const result = renderPromptPair(
      'System: {{ROLE}}',
      'User: {{CONTENT}}',
      { ROLE: 'writer', CONTENT: 'hello' }
    );
    expect(result.systemPrompt).toBe('System: writer');
    expect(result.userPrompt).toBe('User: hello');
  });
});

// ---- validateTemplate ----

describe('validateTemplate', () => {
  it('returns empty for unknown featureKey', () => {
    expect(validateTemplate('unknown_key', 'any text')).toEqual([]);
  });

  it('returns empty when all required vars present (storyboard user)', () => {
    expect(validateTemplate('storyboard', '{{CONTENT}}', 'user')).toEqual([]);
  });

  it('reports missing required var', () => {
    const missing = validateTemplate('storyboard', 'no placeholder here', 'user');
    expect(missing).toContain('CONTENT');
  });

  it('handles whitespace in placeholder', () => {
    expect(validateTemplate('storyboard', '{{ CONTENT }}', 'user')).toEqual([]);
  });

  it('returns empty for system kind with no required system vars', () => {
    expect(validateTemplate('storyboard', 'anything', 'system')).toEqual([]);
  });

  it('reports missing system vars for prompt_enhance', () => {
    const missing = validateTemplate('prompt_enhance', 'no vars', 'system');
    expect(missing).toContain('EXPANSION_GUIDE');
    expect(missing).toContain('DURATION_GUIDE');
  });
});

// ---- validateTemplatePair ----

describe('validateTemplatePair', () => {
  it('returns empty for unknown featureKey', () => {
    expect(validateTemplatePair('nope', 'a', 'b')).toEqual([]);
  });

  it('returns empty when all vars present across both templates', () => {
    expect(
      validateTemplatePair(
        'prompt_enhance',
        '{{EXPANSION_GUIDE}} {{DURATION_GUIDE}}',
        '{{PROMPT}}'
      )
    ).toEqual([]);
  });

  it('reports missing vars', () => {
    const missing = validateTemplatePair('prompt_enhance', 'empty', 'empty');
    expect(missing).toContain('EXPANSION_GUIDE');
    expect(missing).toContain('DURATION_GUIDE');
    expect(missing).toContain('PROMPT');
  });
});
