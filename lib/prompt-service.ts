import { cache } from './cache';
import { getLlmPromptByKey } from './db-llm';
import { getAgentByKey } from './db-agent';

// Re-export from shared utils for backward compatibility
export { compileSystemPrompt } from './agent-utils';

export interface PromptTemplate {
  systemPrompt: string;
  userPromptTemplate: string;
}

type TemplateKind = 'system' | 'user';

const PROMPT_CACHE_PREFIX = 'llm_prompt:';
const PROMPT_CACHE_TTL = 300; // 5 minutes

const REQUIRED_VARS: Record<string, { system: string[]; user: string[] }> = {
  storyboard: { system: [], user: ['CONTENT'] },
  asset_analyze: { system: [], user: ['CONTENT'] },
  prompt_enhance: { system: ['EXPANSION_GUIDE', 'DURATION_GUIDE'], user: ['PROMPT'] },
};

function getCacheKey(featureKey: string): string {
  return `${PROMPT_CACHE_PREFIX}${featureKey}`;
}

export async function getPromptTemplate(
  featureKey: string,
  defaults: PromptTemplate
): Promise<PromptTemplate> {
  const cacheKey = getCacheKey(featureKey);
  const cached = cache.get<PromptTemplate>(cacheKey);
  if (cached) return cached;

  // 优先尝试 Agent 模式
  const agent = await getAgentByKey(featureKey);
  if (agent && agent.enabled) {
    const resolved: PromptTemplate = {
      systemPrompt: agent.systemPrompt?.trim() || defaults.systemPrompt,
      userPromptTemplate: agent.userPromptTemplate?.trim() || defaults.userPromptTemplate,
    };
    cache.set(cacheKey, resolved, PROMPT_CACHE_TTL);
    return resolved;
  }

  // Fallback 到原 llm_prompts 逻辑
  const prompt = await getLlmPromptByKey(featureKey);

  let resolved = defaults;
  if (prompt && prompt.enabled) {
    resolved = {
      systemPrompt: prompt.systemPrompt?.trim() || defaults.systemPrompt,
      userPromptTemplate: prompt.userPromptTemplate?.trim() || defaults.userPromptTemplate,
    };
  }

  // Fallback: if DB template is missing required placeholders, use defaults
  const missingSys = validateTemplate(featureKey, resolved.systemPrompt, 'system');
  const missingUsr = validateTemplate(featureKey, resolved.userPromptTemplate, 'user');
  if (missingSys.length > 0 || missingUsr.length > 0) {
    resolved = {
      systemPrompt: missingSys.length > 0 ? defaults.systemPrompt : resolved.systemPrompt,
      userPromptTemplate: missingUsr.length > 0 ? defaults.userPromptTemplate : resolved.userPromptTemplate,
    };
  }

  cache.set(cacheKey, resolved, PROMPT_CACHE_TTL);
  return resolved;
}

export function renderTemplate(
  template: string,
  vars: Record<string, string>
): string {
  return template.replace(
    /\{\{\s*([A-Z0-9_]+)\s*\}\}/g,
    (_, key: string) => vars[key] ?? ''
  );
}

export function renderPromptPair(
  systemPrompt: string,
  userPromptTemplate: string,
  vars: Record<string, string>
): { systemPrompt: string; userPrompt: string } {
  return {
    systemPrompt: renderTemplate(systemPrompt, vars),
    userPrompt: renderTemplate(userPromptTemplate, vars),
  };
}

export function validateTemplate(
  featureKey: string,
  template: string,
  kind: TemplateKind = 'user'
): string[] {
  const spec = REQUIRED_VARS[featureKey];
  if (!spec) return [];

  const required = spec[kind];
  if (!required || required.length === 0) return [];

  const missing: string[] = [];
  for (const key of required) {
    const pattern = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`);
    if (!pattern.test(template)) {
      missing.push(key);
    }
  }
  return missing;
}

export function validateTemplatePair(
  featureKey: string,
  systemPrompt: string,
  userPromptTemplate: string
): string[] {
  const spec = REQUIRED_VARS[featureKey];
  if (!spec) return [];

  const required = Array.from(new Set([...(spec.system || []), ...(spec.user || [])]));
  if (required.length === 0) return [];

  const combined = `${systemPrompt}\n${userPromptTemplate}`;
  const missing: string[] = [];
  for (const key of required) {
    const pattern = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`);
    if (!pattern.test(combined)) {
      missing.push(key);
    }
  }
  return missing;
}

/**
 * 异步版本的模板校验，支持从 Agent placeholders 动态读取必填变量。
 */
export async function validateTemplateAsync(
  featureKey: string,
  template: string,
  kind: TemplateKind = 'user'
): Promise<string[]> {
  const spec = REQUIRED_VARS[featureKey];
  if (spec) {
    return validateTemplate(featureKey, template, kind);
  }

  const agent = await getAgentByKey(featureKey);
  if (!agent?.config?.placeholders?.length) return [];

  const required = agent.config.placeholders
    .filter((p) => p.required)
    .map((p) => p.key);

  if (required.length === 0) return [];

  const missing: string[] = [];
  for (const key of required) {
    const pattern = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`);
    if (!pattern.test(template)) {
      missing.push(key);
    }
  }
  return missing;
}

export function invalidatePromptCache(featureKey: string): void {
  cache.delete(getCacheKey(featureKey));
}
