import { generateLlmText } from './llm-client';
import { getLlmModelById } from './db-llm';
import { getPromptTemplate, renderPromptPair } from './prompt-service';
import { getSchemaForFeature } from './schema-registry';

export interface AssetAnalysisItem {
  name: string;
  description: string | null;
  attributes: Record<string, unknown> | null;
  sourceText: string | null;
  confidence: number | null;
}

export interface AssetAnalysisResult {
  characters: AssetAnalysisItem[];
  scenes: AssetAnalysisItem[];
  props: AssetAnalysisItem[];
}

const ANALYSIS_SCHEMA = {
  type: 'object',
  properties: {
    characters: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          description: { type: 'string' },
          attributes: { type: 'object', additionalProperties: true },
          sourceText: { type: 'string' },
          confidence: { type: 'number' },
        },
        required: ['name'],
      },
    },
    scenes: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          description: { type: 'string' },
          attributes: { type: 'object', additionalProperties: true },
          sourceText: { type: 'string' },
          confidence: { type: 'number' },
        },
        required: ['name'],
      },
    },
    props: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          description: { type: 'string' },
          attributes: { type: 'object', additionalProperties: true },
          sourceText: { type: 'string' },
          confidence: { type: 'number' },
        },
        required: ['name'],
      },
    },
  },
  required: ['characters', 'scenes', 'props'],
};

const DEFAULT_SYSTEM_PROMPT =
  'You are a strict JSON generator. Analyze the episode content and extract assets. Return only valid JSON that matches the schema. Do not include markdown or extra text.';

const DEFAULT_USER_TEMPLATE = [
  '从以下剧本内容中提取所有角色、场景和道具。',
  '返回 JSON，包含 characters、scenes、props 三个数组。',
  '每个元素包含：',
  '- name (string, 必填)',
  '- description (string, 简短描述)',
  '- attributes (object, 类型特有属性):',
  '  角色: { gender, age, personality, descriptors }',
  '  场景: { timeOfDay, atmosphere }',
  '  道具: { importance }',
  '- sourceText (string, 原文引用片段)',
  '- confidence (number, 0-1 置信度)',
  '',
  '剧本内容:',
  '"""',
  '{{CONTENT}}',
  '"""',
].join('\n');

function extractJsonPayload(text: string): string {
  const fencedMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fencedMatch?.[1]) return fencedMatch[1].trim();

  const firstBrace = text.indexOf('{');
  const lastBrace = text.lastIndexOf('}');
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return text.slice(firstBrace, lastBrace + 1);
  }

  return text.trim();
}

function normalizeString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function normalizeAttributes(value: unknown): Record<string, unknown> | null {
  if (!value) return null;
  if (typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value.trim());
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      return null;
    }
  }
  return null;
}

function normalizeConfidence(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const raw = Number(value);
  if (!Number.isFinite(raw)) return null;
  return Math.min(1, Math.max(0, raw));
}

function normalizeItem(value: unknown): AssetAnalysisItem | null {
  if (typeof value === 'string') {
    const name = normalizeString(value);
    if (!name) return null;
    return { name, description: null, attributes: null, sourceText: null, confidence: null };
  }

  if (!value || typeof value !== 'object') return null;
  const item = value as Record<string, unknown>;
  const name = normalizeString(item.name ?? item.title ?? item.label);
  if (!name) return null;

  return {
    name,
    description: normalizeString(item.description ?? item.desc ?? item.summary),
    attributes: normalizeAttributes(item.attributes ?? item.meta ?? item.details),
    sourceText: normalizeString(item.sourceText ?? item.source_text ?? item.source),
    confidence: normalizeConfidence(item.confidence ?? item.score),
  };
}

function dedupeItems(items: AssetAnalysisItem[]): AssetAnalysisItem[] {
  const seen = new Set<string>();
  const result: AssetAnalysisItem[] = [];
  for (const item of items) {
    const key = item.name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(item);
  }
  return result;
}

function normalizeItems(value: unknown): AssetAnalysisItem[] {
  const items = Array.isArray(value) ? value : value ? [value] : [];
  const normalized = items
    .map(normalizeItem)
    .filter((item): item is AssetAnalysisItem => Boolean(item));
  return dedupeItems(normalized);
}

export async function analyzeEpisodeAssets(
  episodeContent: string,
  textModelId: string
): Promise<AssetAnalysisResult> {
  const content = episodeContent?.trim();
  if (!content) {
    throw new Error('Episode content is empty');
  }

  const model = await getLlmModelById(textModelId);
  if (!model || !model.enabled) {
    throw new Error('Text model is not available');
  }

  const { systemPrompt, userPromptTemplate } = await getPromptTemplate('asset_analyze', {
    systemPrompt: DEFAULT_SYSTEM_PROMPT,
    userPromptTemplate: DEFAULT_USER_TEMPLATE,
  });
  const { systemPrompt: renderedSys, userPrompt } = renderPromptPair(
    systemPrompt,
    userPromptTemplate,
    { CONTENT: content }
  );

  const response = await generateLlmText(model, {
    systemPrompt: renderedSys,
    userPrompt,
    jsonSchema: getSchemaForFeature('asset_analyze') ?? undefined,
    temperature: 0.2,
  });

  const payload = extractJsonPayload(response.text);
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(payload) as Record<string, unknown>;
  } catch {
    throw new Error('Failed to parse asset analysis JSON');
  }

  return {
    characters: normalizeItems(parsed.characters ?? parsed.character ?? []),
    scenes: normalizeItems(parsed.scenes ?? parsed.scene ?? []),
    props: normalizeItems(parsed.props ?? parsed.prop ?? []),
  };
}
