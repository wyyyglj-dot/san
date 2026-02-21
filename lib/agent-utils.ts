import type { LlmAgent, SafeLlmAgent, AgentConfig } from '@/types';

const MAX_PROMPT_LENGTH = 50000;
const MAX_NAME_LENGTH = 100;
const MAX_DESCRIPTION_LENGTH = 500;

export function toSafeAgent(agent: LlmAgent): SafeLlmAgent {
  const { defaultConfig, defaultSystemPrompt, defaultUserPromptTemplate, ...rest } = agent;
  return rest;
}

export function compileSystemPrompt(config: AgentConfig): string {
  const sections: string[] = [];
  if (config.role?.trim()) {
    sections.push(`# Role\n${config.role.trim()}`);
  }
  if (config.rules?.length > 0) {
    const items = config.rules
      .map((r, i) => `${i + 1}. ${r.title}: ${r.content}`)
      .join('\n');
    sections.push(`# Rules\n${items}`);
  }
  if (config.workflow?.length > 0) {
    const items = config.workflow
      .map((s, i) => `${i + 1}. ${s.title}: ${s.content}`)
      .join('\n');
    sections.push(`# Workflow\n${items}`);
  }
  if (config.examples?.length > 0) {
    const items = config.examples
      .map((e) => `## ${e.title}\nInput: ${e.input}\nOutput: ${e.output}`)
      .join('\n\n');
    sections.push(`# Examples\n${items}`);
  }
  if (config.returnFormat?.trim()) {
    sections.push(`# Output Format\n${config.returnFormat.trim()}`);
  }
  return sections.join('\n\n');
}

export function compileUserPromptTemplate(config: AgentConfig): string {
  const requiredKeys = (config.placeholders ?? [])
    .filter((p) => p.required)
    .map((p) => p.key);
  if (requiredKeys.length === 0) return '';
  if (requiredKeys.length === 1) return `{{${requiredKeys[0]}}}`;
  const preferredKey = requiredKeys.find((key) => key === 'CONTENT' || key === 'PROMPT');
  if (preferredKey) return `{{${preferredKey}}}`;
  return requiredKeys.map((key) => `{{${key}}}`).join('\n\n');
}

export function validateAgentConfig(config: unknown): { valid: boolean; error?: string } {
  if (!config || typeof config !== 'object') {
    return { valid: false, error: 'config 必须为对象' };
  }
  const c = config as Record<string, unknown>;
  if (c.role !== undefined && typeof c.role !== 'string') {
    return { valid: false, error: 'config.role 必须为字符串' };
  }
  if (c.rules !== undefined && !Array.isArray(c.rules)) {
    return { valid: false, error: 'config.rules 必须为数组' };
  }
  if (c.workflow !== undefined && !Array.isArray(c.workflow)) {
    return { valid: false, error: 'config.workflow 必须为数组' };
  }
  if (c.examples !== undefined && !Array.isArray(c.examples)) {
    return { valid: false, error: 'config.examples 必须为数组' };
  }
  if (c.returnFormat !== undefined && typeof c.returnFormat !== 'string') {
    return { valid: false, error: 'config.returnFormat 必须为字符串' };
  }
  if (c.placeholders !== undefined && !Array.isArray(c.placeholders)) {
    return { valid: false, error: 'config.placeholders 必须为数组' };
  }
  const json = JSON.stringify(config);
  if (json.length > MAX_PROMPT_LENGTH) {
    return { valid: false, error: `config 超过最大长度限制 (${MAX_PROMPT_LENGTH} 字符)` };
  }
  return { valid: true };
}

export function validateAgentInput(body: Record<string, unknown>): { valid: boolean; error?: string } {
  if (body.name && typeof body.name === 'string' && body.name.length > MAX_NAME_LENGTH) {
    return { valid: false, error: `name 超过最大长度限制 (${MAX_NAME_LENGTH} 字符)` };
  }
  if (body.description && typeof body.description === 'string' && body.description.length > MAX_DESCRIPTION_LENGTH) {
    return { valid: false, error: `description 超过最大长度限制 (${MAX_DESCRIPTION_LENGTH} 字符)` };
  }
  if (body.userPromptTemplate && typeof body.userPromptTemplate === 'string' && body.userPromptTemplate.length > MAX_PROMPT_LENGTH) {
    return { valid: false, error: `userPromptTemplate 超过最大长度限制 (${MAX_PROMPT_LENGTH} 字符)` };
  }
  if (body.systemPrompt && typeof body.systemPrompt === 'string' && body.systemPrompt.length > MAX_PROMPT_LENGTH) {
    return { valid: false, error: `systemPrompt 超过最大长度限制 (${MAX_PROMPT_LENGTH} 字符)` };
  }
  return { valid: true };
}
