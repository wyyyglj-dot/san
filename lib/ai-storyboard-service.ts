import { generateLlmText } from './llm-client';
import { getLlmModelById } from './db-llm';
import { getPromptTemplate, renderPromptPair } from './prompt-service';
import { getSchemaForFeature } from './schema-registry';

export interface StoryboardShot {
  index: number;
  description: string;
  prompt: string;
  durationSeconds?: number;
}

export interface StoryboardResult {
  shots: StoryboardShot[];
}

const DEFAULT_SYSTEM_PROMPT =
  'You are a strict JSON generator. Split the episode script into storyboard shots. ' +
  'Return only valid JSON that matches the schema. Do not include markdown or extra text. ' +
  'Each shot must include index, description, and an English image generation prompt.';

const DEFAULT_USER_TEMPLATE = [
  '将以下剧本内容拆分为分镜。',
  '返回 JSON，包含 shots 数组。',
  '每个分镜包含：',
  '- index (number, 从 1 开始)',
  '- description (string, 该分镜的剧情描述)',
  '- prompt (string, 英文图像生成提示词，描述画面构图、角色、场景、光影)',
  '- durationSeconds (number, 可选, 建议时长)',
  '',
  '剧本内容:',
  '"""',
  '{{CONTENT}}',
  '"""',
].join('\n');

function extractJsonPayload(text: string): string {
  // Strip BOM and invisible chars
  const cleaned = text.replace(/^\uFEFF/, '').trim();

  const fencedMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fencedMatch?.[1]) return fencedMatch[1].trim();

  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return cleaned.slice(firstBrace, lastBrace + 1);
  }

  return cleaned;
}

/** Handle common LLM JSON quirks: trailing commas, single quotes, comments, truncation */
function sanitizeJsonText(raw: string): string {
  let s = raw;
  // Remove single-line comments
  s = s.replace(/\/\/[^\n]*/g, '');
  // Remove trailing commas before } or ]
  s = s.replace(/,\s*([}\]])/g, '$1');
  return s;
}

/** Attempt to repair truncated JSON by closing unclosed brackets */
function repairTruncatedJson(text: string): string | null {
  const opens: string[] = [];
  let inString = false;
  let escape = false;
  for (const ch of text) {
    if (escape) { escape = false; continue; }
    if (ch === '\\' && inString) { escape = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === '{') opens.push('}');
    else if (ch === '[') opens.push(']');
    else if (ch === '}' || ch === ']') opens.pop();
  }
  if (opens.length === 0) return null; // not truncated
  // Close any trailing comma, then close brackets
  let repaired = text.replace(/,\s*$/, '');
  // If we're inside an incomplete string value, close it
  if (inString) repaired += '"';
  while (opens.length) repaired += opens.pop();
  return repaired;
}

function normalizeString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function normalizeNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const raw = Number(value);
  if (!Number.isFinite(raw)) return null;
  return raw;
}

function normalizeShot(value: unknown): StoryboardShot | null {
  if (!value || typeof value !== 'object') return null;
  const item = value as Record<string, unknown>;

  const indexRaw = normalizeNumber(item.index ?? item.order ?? item.no);
  if (indexRaw === null) return null;

  const description = normalizeString(item.description ?? item.desc ?? item.text);
  const prompt = normalizeString(item.prompt ?? item.imagePrompt ?? item.image_prompt);
  if (!description || !prompt) return null;

  const durationRaw = normalizeNumber(
    item.durationSeconds ?? item.duration ?? item.seconds,
  );
  const durationSeconds =
    durationRaw !== null && durationRaw > 0 ? durationRaw : undefined;

  return {
    index: Math.max(1, Math.floor(indexRaw)),
    description,
    prompt,
    ...(durationSeconds !== undefined ? { durationSeconds } : {}),
  };
}

function normalizeShots(value: unknown): StoryboardShot[] {
  const items = Array.isArray(value) ? value : value ? [value] : [];
  return items
    .map(normalizeShot)
    .filter((item): item is StoryboardShot => Boolean(item));
}

export async function generateStoryboard(
  episodeContent: string,
  textModelId: string,
): Promise<StoryboardResult> {
  const content = episodeContent?.trim();
  if (!content) {
    throw new Error('Episode content is empty');
  }

  const model = await getLlmModelById(textModelId);
  if (!model || !model.enabled) {
    throw new Error('Text model is not available');
  }

  const { systemPrompt, userPromptTemplate } = await getPromptTemplate('storyboard', {
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
    jsonSchema: getSchemaForFeature('storyboard') ?? undefined,
    temperature: 0.2,
  });

  console.log('[storyboard] LLM raw response:', response.text);
  if (response.usage) {
    console.log('[storyboard] token usage:', JSON.stringify(response.usage));
  }

  const rawPayload = extractJsonPayload(response.text);
  const sanitized = sanitizeJsonText(rawPayload);

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(sanitized) as Record<string, unknown>;
  } catch {
    // Attempt truncation repair (maxTokens may have cut the JSON)
    const repaired = repairTruncatedJson(sanitized);
    if (repaired) {
      try {
        parsed = JSON.parse(repaired) as Record<string, unknown>;
      } catch {
        console.error('[storyboard] raw LLM response:', response.text);
        throw new Error('Failed to parse storyboard JSON');
      }
    } else {
      console.error('[storyboard] raw LLM response:', response.text);
      throw new Error('Failed to parse storyboard JSON');
    }
  }

  const result = {
    shots: normalizeShots(parsed.shots ?? parsed.items ?? []),
  };
  console.log(`[storyboard] parsed ${result.shots.length} shots successfully`);
  return result;
}
