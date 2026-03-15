/* eslint-disable no-console */
/**
 * Gemini Agent Service
 *
 * 为 Story-to-Video Agent 系统提供 Gemini LLM 服务封装
 * 支持文本生成、JSON Schema 输出、流式响应
 */

import { getSystemConfig } from './db';

// ========================================
// 类型定义
// ========================================

export interface GeminiGenerateOptions {
  systemPrompt: string;
  userPrompt: string;
  jsonSchema?: object;
  maxTokens?: number;
  temperature?: number;
}

export interface GeminiStreamOptions {
  systemPrompt: string;
  userPrompt: string;
  onChunk: (text: string) => void;
  onComplete?: (fullText: string) => void;
  onError?: (error: Error) => void;
}

export interface GeminiResponse {
  text: string;
  finishReason?: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

// ========================================
// 配置获取
// ========================================

async function getGeminiConfig(): Promise<{ apiKey: string; baseUrl: string }> {
  const config = await getSystemConfig();
  return {
    apiKey: config.geminiApiKey || process.env.GEMINI_API_KEY || '',
    baseUrl: config.geminiBaseUrl || process.env.GEMINI_BASE_URL || 'https://generativelanguage.googleapis.com',
  };
}

// ========================================
// 核心生成函数
// ========================================

/**
 * @deprecated Use generateLlmText from lib/llm-client instead.
 */
export async function generateWithGemini(options: GeminiGenerateOptions): Promise<GeminiResponse> {
  const { apiKey, baseUrl } = await getGeminiConfig();

  if (!apiKey) {
    throw new Error('Gemini API Key 未配置');
  }

  const model = 'gemini-2.0-flash';
  const url = `${baseUrl.replace(/\/$/, '')}/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const contents = [
    {
      role: 'user',
      parts: [{ text: options.userPrompt }],
    },
  ];

  // 构建 generationConfig（不使用 thinkingConfig，因为第三方 API 代理可能不支持）
  const generationConfig: Record<string, unknown> = {
    maxOutputTokens: options.maxTokens || 4096,
    temperature: options.temperature ?? 0.7,
  };

  const requestBody: Record<string, unknown> = {
    contents,
    systemInstruction: {
      parts: [{ text: options.systemPrompt }],
    },
    generationConfig,
  };

  // 如果提供了 JSON Schema，启用结构化输出
  if (options.jsonSchema) {
    (requestBody.generationConfig as Record<string, unknown>).responseMimeType = 'application/json';
    (requestBody.generationConfig as Record<string, unknown>).responseSchema = options.jsonSchema;
  }

  console.log('[GeminiAgent] 发送请求:', { model, promptLength: options.userPrompt.length });

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[GeminiAgent] API 错误:', { status: response.status, body: errorText.slice(0, 500) });
    throw new Error(`Gemini API 错误 (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  const candidate = data.candidates?.[0];

  if (!candidate?.content?.parts || candidate.content.parts.length === 0) {
    throw new Error('Gemini API 返回空响应');
  }

  // Gemini 2.5+/3.0 模型可能返回多个 parts：
  // - parts[0] 可能是 thought（思考内容）
  // - parts[1] 可能是 text（最终输出）
  // 我们需要找到最后一个包含 text 的 part（跳过 thought）
  let text: string | undefined;
  const parts = candidate.content.parts;

  console.log('[GeminiAgent] 响应 parts 数量:', parts.length);

  // 从后往前遍历，找到第一个有 text 的 part（优先取最后的 text）
  for (let i = parts.length - 1; i >= 0; i--) {
    const part = parts[i];
    // 打印每个 part 的结构（用于调试）
    console.log(`[GeminiAgent] Part ${i}:`, {
      hasText: !!part.text,
      hasThought: !!part.thought,
      textLength: part.text?.length || 0,
      thoughtLength: part.thought?.length || 0,
    });

    // 优先使用 text 字段（跳过有实际内容的 thought 字段）
    // 注意：part.thought 可能存在但为空字符串，需要检查 length
    if (part.text && !part.thought?.length) {
      text = part.text;
      console.log(`[GeminiAgent] 使用 Part ${i} 的 text 内容`);
      break;
    }
  }

  // 如果没有找到纯 text 的 part，尝试使用任何有 text 的 part
  if (!text) {
    for (let i = parts.length - 1; i >= 0; i--) {
      if (parts[i].text) {
        text = parts[i].text;
        console.log(`[GeminiAgent] 回退：使用 Part ${i} 的 text 内容（可能包含思考）`);
        break;
      }
    }
  }

  // 如果还是没有 text，尝试使用 thought（某些模型可能只返回 thought）
  if (!text) {
    for (let i = parts.length - 1; i >= 0; i--) {
      if (parts[i].thought) {
        text = parts[i].thought;
        console.log(`[GeminiAgent] 回退：使用 Part ${i} 的 thought 内容`);
        break;
      }
    }
  }

  if (!text) {
    console.error('[GeminiAgent] 无法从响应中提取文本，parts:', JSON.stringify(parts).substring(0, 500));
    throw new Error('Gemini API 返回空响应：无法提取文本内容');
  }

  const usage = data.usageMetadata;

  console.log('[GeminiAgent] 响应成功:', { textLength: text.length, finishReason: candidate.finishReason });

  return {
    text,
    finishReason: candidate.finishReason,
    usage: usage ? {
      promptTokens: usage.promptTokenCount || 0,
      completionTokens: usage.candidatesTokenCount || 0,
      totalTokens: usage.totalTokenCount || 0,
    } : undefined,
  };
}

// ========================================
// 流式生成函数
// ========================================

export async function streamWithGemini(options: GeminiStreamOptions): Promise<void> {
  const { apiKey, baseUrl } = await getGeminiConfig();

  if (!apiKey) {
    throw new Error('Gemini API Key 未配置');
  }

  const model = 'gemini-2.0-flash';
  const url = `${baseUrl.replace(/\/$/, '')}/v1beta/models/${model}:streamGenerateContent?key=${apiKey}`;

  const contents = [
    {
      role: 'user',
      parts: [{ text: options.userPrompt }],
    },
  ];

  const requestBody = {
    contents,
    systemInstruction: {
      parts: [{ text: options.systemPrompt }],
    },
    generationConfig: {
      maxOutputTokens: 4096,
      temperature: 0.7,
    },
  };

  console.log('[GeminiAgent] 开始流式请求:', { model, promptLength: options.userPrompt.length });

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gemini API 错误 (${response.status}): ${errorText}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('无法获取响应流');
    }

    const decoder = new TextDecoder();
    let fullText = '';
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // 解析 JSON 行
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.trim()) continue;

        try {
          // Gemini 流式响应是 JSON 数组格式
          const data = JSON.parse(line.replace(/^\[|\]$/g, '').replace(/^,/, ''));
          const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
          if (text) {
            fullText += text;
            options.onChunk(text);
          }
        } catch {
          // 忽略解析错误，可能是不完整的 JSON
        }
      }
    }

    console.log('[GeminiAgent] 流式响应完成:', { totalLength: fullText.length });
    options.onComplete?.(fullText);
  } catch (error) {
    console.error('[GeminiAgent] 流式请求错误:', error);
    options.onError?.(error instanceof Error ? error : new Error(String(error)));
    throw error;
  }
}

// ========================================
// JSON 解析工具
// ========================================

export function extractJson<T = unknown>(text: string): T {
  // 尝试直接解析
  try {
    return JSON.parse(text);
  } catch {
    // 尝试提取 JSON 代码块
    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[1].trim());
    }

    // 尝试提取 { } 或 [ ] 包裹的内容
    const objectMatch = text.match(/\{[\s\S]*\}/);
    if (objectMatch) {
      return JSON.parse(objectMatch[0]);
    }

    const arrayMatch = text.match(/\[[\s\S]*\]/);
    if (arrayMatch) {
      return JSON.parse(arrayMatch[0]);
    }

    throw new Error('无法从响应中提取 JSON');
  }
}

// ========================================
// JSON 修复器
// ========================================

export function repairJson(text: string): string {
  let result = text.trim();

  // 移除 markdown 代码块标记
  result = result.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');

  // 修复常见问题
  // 1. 移除尾部逗号
  result = result.replace(/,(\s*[}\]])/g, '$1');

  // 2. 修复未闭合的字符串
  const quoteCount = (result.match(/"/g) || []).length;
  if (quoteCount % 2 !== 0) {
    result += '"';
  }

  // 3. 修复未闭合的括号
  const openBraces = (result.match(/\{/g) || []).length;
  const closeBraces = (result.match(/\}/g) || []).length;
  for (let i = 0; i < openBraces - closeBraces; i++) {
    result += '}';
  }

  const openBrackets = (result.match(/\[/g) || []).length;
  const closeBrackets = (result.match(/\]/g) || []).length;
  for (let i = 0; i < openBrackets - closeBrackets; i++) {
    result += ']';
  }

  return result;
}

// ========================================
// 安全 JSON 解析
// ========================================

export function safeParseJson<T = unknown>(text: string, defaultValue: T): T {
  try {
    return extractJson<T>(text);
  } catch {
    try {
      const repaired = repairJson(text);
      return JSON.parse(repaired);
    } catch {
      console.warn('[GeminiAgent] JSON 解析失败，使用默认值');
      return defaultValue;
    }
  }
}
