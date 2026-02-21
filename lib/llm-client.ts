import type { LlmModel } from '@/types';

export interface LlmGenerateOptions {
  systemPrompt: string;
  userPrompt: string;
  jsonSchema?: object;
  maxTokens?: number;
  temperature?: number;
}

export interface LlmResponse {
  text: string;
  reasoningText?: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

const DEFAULT_TEMPERATURE = 0.7;
const DEFAULT_MAX_TOKENS = 4096;

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/$/, '');
}

function buildOpenAiUrl(baseUrl: string): string {
  const trimmed = normalizeBaseUrl(baseUrl);
  if (trimmed.endsWith('/v1/chat/completions')) return trimmed;
  if (trimmed.endsWith('/chat/completions')) return trimmed;
  if (trimmed.endsWith('/v1')) return `${trimmed}/chat/completions`;
  return `${trimmed}/v1/chat/completions`;
}

function resolveTemperature(config: LlmModel, options: LlmGenerateOptions): number {
  return options.temperature ?? config.temperature ?? DEFAULT_TEMPERATURE;
}

function resolveMaxTokens(config: LlmModel, options: LlmGenerateOptions): number {
  return options.maxTokens ?? config.maxTokens ?? DEFAULT_MAX_TOKENS;
}

// 10 分钟兜底超时，防止连接彻底挂死
const GEMINI_FETCH_TIMEOUT_MS = 10 * 60 * 1000;

/**
 * 从 streamGenerateContent 的流式响应中累积完整 JSON 数组。
 * Gemini 流式接口返回的是一个 JSON 数组（每个元素是一个 candidate chunk），
 * 我们需要把所有 chunk 拼接后解析。
 */
async function consumeGeminiStream(
  body: ReadableStream<Uint8Array>,
): Promise<unknown[]> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
  }
  buffer += decoder.decode();

  // streamGenerateContent 返回 JSON 数组: [{...}, {...}, ...]
  const trimmed = buffer.trim();
  if (!trimmed) return [];
  try {
    const parsed = JSON.parse(trimmed);
    return Array.isArray(parsed) ? parsed : [parsed];
  } catch {
    // 某些代理可能返回 NDJSON（每行一个 JSON 对象）
    const chunks: unknown[] = [];
    for (const line of trimmed.split('\n')) {
      const l = line.trim().replace(/^,/, '');
      if (!l || l === '[' || l === ']') continue;
      try { chunks.push(JSON.parse(l)); } catch { /* skip */ }
    }
    return chunks;
  }
}

async function generateWithGemini(
  config: LlmModel,
  options: LlmGenerateOptions
): Promise<LlmResponse> {
  const baseUrl = normalizeBaseUrl(config.baseUrl);
  // 使用 streamGenerateContent 流式接口：headers 秒回，彻底避免 headersTimeout
  const url = `${baseUrl}/v1beta/models/${config.modelName}:streamGenerateContent?key=${config.apiKey}`;
  const temperature = resolveTemperature(config, options);
  const maxTokens = resolveMaxTokens(config, options);

  console.log(`[llm-client] Gemini stream request → ${baseUrl}/v1beta/models/${config.modelName}:streamGenerateContent`);
  console.log(`[llm-client] params: temperature=${temperature}, maxTokens=${maxTokens}, jsonSchema=${!!options.jsonSchema}`);

  const requestBody: Record<string, unknown> = {
    contents: [
      {
        role: 'user',
        parts: [{ text: options.userPrompt }],
      },
    ],
    systemInstruction: {
      parts: [{ text: options.systemPrompt }],
    },
    generationConfig: {
      maxOutputTokens: maxTokens,
      temperature,
    },
  };

  if (options.jsonSchema) {
    const configObj = requestBody.generationConfig as Record<string, unknown>;
    configObj.responseMimeType = 'application/json';
    configObj.responseSchema = options.jsonSchema;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), GEMINI_FETCH_TIMEOUT_MS);

  let response: Response;
  const startTime = Date.now();
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timeoutId);
    if (controller.signal.aborted) {
      throw new Error(`Gemini API request timed out after ${GEMINI_FETCH_TIMEOUT_MS / 1000}s`);
    }
    throw err;
  }

  console.log(`[llm-client] Gemini stream response: status=${response.status}, elapsed=${Date.now() - startTime}ms`);

  if (!response.ok) {
    clearTimeout(timeoutId);
    const errorText = await response.text();
    console.error(`[llm-client] Gemini error body:`, errorText);
    throw new Error(`Gemini API error (${response.status}): ${errorText}`);
  }

  // 流式读取完整响应
  let chunks: unknown[];
  try {
    if (!response.body) {
      throw new Error('Gemini stream response has no body');
    }
    chunks = await consumeGeminiStream(response.body);
  } finally {
    clearTimeout(timeoutId);
  }
  const elapsed = Date.now() - startTime;
  console.log(`[llm-client] Gemini stream completed: ${chunks.length} chunks, elapsed=${elapsed}ms`);

  // 合并所有 chunk 的 parts 和 usageMetadata
  const allParts: Array<{ text?: string; thought?: boolean | string }> = [];
  let usageMetadata: Record<string, number> | undefined;
  for (const chunk of chunks) {
    const c = chunk as Record<string, unknown>;
    const candidate = (c.candidates as Array<Record<string, unknown>>)?.[0];
    const parts = candidate?.content as Record<string, unknown> | undefined;
    if (Array.isArray(parts?.parts)) {
      allParts.push(...(parts.parts as Array<{ text?: string; thought?: boolean | string }>));
    }
    if (c.usageMetadata) {
      usageMetadata = c.usageMetadata as Record<string, number>;
    }
  }

  // 流式响应中文本分散在多个 chunk 的 parts 里，需要拼接
  const textChunks: string[] = [];
  const reasoningChunks: string[] = [];
  for (const part of allParts) {
    const thoughtFlag = part?.thought;
    const isThought = thoughtFlag === true || (typeof thoughtFlag === 'string' && thoughtFlag.trim().length > 0);
    if (isThought) {
      if (typeof thoughtFlag === 'string' && thoughtFlag.trim().length > 0) {
        reasoningChunks.push(thoughtFlag.trim());
      } else if (typeof part?.text === 'string' && part.text.length > 0) {
        reasoningChunks.push(part.text);
      }
    } else if (typeof part?.text === 'string' && part.text.length > 0) {
      textChunks.push(part.text);
    }
  }

  let text = textChunks.join('');
  const reasoningText = reasoningChunks.length > 0 ? reasoningChunks.join('') : undefined;
  if (!text && reasoningText) {
    text = reasoningText;
  }

  if (!text) {
    console.error('[llm-client] Gemini empty response, chunks:', chunks.length);
    throw new Error('Gemini response is empty');
  }

  if (usageMetadata) {
    const prompt = usageMetadata.promptTokenCount || 0;
    const total = usageMetadata.totalTokenCount || 0;
    const completion = total > prompt ? total - prompt : (usageMetadata.candidatesTokenCount || 0);
    return {
      text,
      reasoningText,
      usage: { promptTokens: prompt, completionTokens: completion, totalTokens: total },
    };
  }
  return { text, reasoningText };
}

async function generateWithOpenAiCompatible(
  config: LlmModel,
  options: LlmGenerateOptions
): Promise<LlmResponse> {
  const url = buildOpenAiUrl(config.baseUrl);
  const temperature = resolveTemperature(config, options);
  const maxTokens = resolveMaxTokens(config, options);

  console.log(`[llm-client] OpenAI-compatible request → ${url}, model=${config.modelName}`);
  console.log(`[llm-client] params: temperature=${temperature}, maxTokens=${maxTokens}`);

  const body: Record<string, unknown> = {
    model: config.modelName,
    messages: [
      { role: 'system', content: options.systemPrompt },
      { role: 'user', content: options.userPrompt },
    ],
    temperature,
    max_tokens: maxTokens,
  };

  const startTime = Date.now();
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify(body),
  });
  const elapsed = Date.now() - startTime;

  console.log(`[llm-client] OpenAI-compatible response: status=${response.status}, elapsed=${elapsed}ms`);

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[llm-client] OpenAI-compatible error body:`, errorText);
    let message = errorText;
    try {
      const parsed = JSON.parse(errorText);
      message = parsed?.error?.message || message;
    } catch {
      // Ignore parse error and use raw text.
    }
    throw new Error(`OpenAI-compatible API error (${response.status}): ${message}`);
  }

  const data = await response.json();
  const message = data?.choices?.[0]?.message;
  const content = typeof message?.content === 'string' ? message.content : '';
  const reasoning = typeof message?.reasoning_content === 'string' ? message.reasoning_content : '';
  const text = content.trim().length > 0 ? content : reasoning;
  const reasoningText = reasoning.trim().length > 0 ? reasoning : undefined;

  if (!text) {
    console.error('[llm-client] OpenAI-compatible empty response, full data:', JSON.stringify(data));
    throw new Error('OpenAI-compatible response is empty');
  }

  const usage = data.usage;
  return {
    text,
    reasoningText,
    usage: usage ? {
      promptTokens: usage.prompt_tokens || 0,
      completionTokens: usage.completion_tokens || 0,
      totalTokens: usage.total_tokens || 0,
    } : undefined,
  };
}

export async function generateLlmText(
  config: LlmModel,
  options: LlmGenerateOptions
): Promise<LlmResponse> {
  if (!config.apiKey) {
    throw new Error('LLM API key is missing');
  }
  if (!config.baseUrl) {
    throw new Error('LLM base URL is missing');
  }
  if (!config.modelName) {
    throw new Error('LLM model name is missing');
  }

  if (config.provider === 'gemini') {
    return generateWithGemini(config, options);
  }
  if (config.provider === 'openai-compatible') {
    return generateWithOpenAiCompatible(config, options);
  }

  throw new Error(`Unsupported LLM provider: ${config.provider}`);
}
