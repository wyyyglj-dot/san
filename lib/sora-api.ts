/* eslint-disable no-console */
import { getSystemConfig, getVideoChannels, getVideoChannel, getVideoModels } from './db';
import { fetch as undiciFetch, Agent, FormData, type RequestInit as UndiciRequestInit, type Response as UndiciResponse } from 'undici';
import type { VideoChannel, ChannelType, LlmModel } from '@/types';
import { getPromptTemplate, renderPromptPair } from './prompt-service';
import { fetchWithRetry } from './http-retry';
import { getDefaultRetryConfig } from './retry-config-validator';
import { generateLlmText } from './llm-client';
import { parseJsonResponse } from './http-json';
import { DEFAULT_URLS } from './config-defaults';
import { refreshVerboseFlag, vLog } from './log-verbose';
import { pollBackendTask, POLL_TIMEOUT_MESSAGE } from './backend-poller';

// ========================================
// Sora OpenAI-Style Non-Streaming API
// ========================================

// 解析视频 URL（处理字符串、JSON 字符串数组、数组等格式）
export function parseVideoUrl(url: string | string[] | unknown): string {
  if (Array.isArray(url)) {
    return url.length > 0 ? parseVideoUrl(url[0]) : '';
  }
  if (typeof url !== 'string') {
    return String(url);
  }

  const trimmed = url.trim();
  if (!trimmed) {
    return trimmed;
  }

  const parsedArray = tryParseJsonArray(trimmed);
  if (parsedArray) {
    return normalizeUrlString(parsedArray);
  }

  const unwrapped = unwrapEncodedArray(trimmed);
  if (unwrapped) {
    return normalizeUrlString(unwrapped);
  }

  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    const inner = trimmed.slice(1, -1).trim();
    const innerParsed = tryParseJsonArray(inner);
    if (innerParsed) {
      return normalizeUrlString(innerParsed);
    }
    const innerUnwrapped = unwrapEncodedArray(inner);
    if (innerUnwrapped) {
      return normalizeUrlString(innerUnwrapped);
    }
  }

  return trimmed;
}

function tryParseJsonArray(value: string): string | null {
  if (!value.startsWith('[')) {
    return null;
  }
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return String(parsed[0]);
    }
  } catch {
    return null;
  }
  return null;
}

function unwrapEncodedArray(value: string): string | null {
  const trimmed = value.trim();
  const lower = trimmed.toLowerCase();

  const encodedOpen = '%5b%22';
  const encodedClose = '%22%5d';
  if (lower.startsWith(encodedOpen) && lower.endsWith(encodedClose)) {
    return trimmed.slice(encodedOpen.length, trimmed.length - encodedClose.length);
  }

  const mixedOpen = '[%22';
  const mixedClose = '%22]';
  if (lower.startsWith(mixedOpen) && lower.endsWith(mixedClose)) {
    return trimmed.slice(mixedOpen.length, trimmed.length - mixedClose.length);
  }

  return null;
}

function normalizeUrlString(value: string): string {
  const trimmed = value.trim();
  if (/^https?:%2f%2f/i.test(trimmed)) {
    try {
      return decodeURIComponent(trimmed);
    } catch {
      return trimmed;
    }
  }
  return trimmed;
}

// 安全解析 API 响应，处理 HTML 错误页面
async function safeParseApiResponse<T>(response: UndiciResponse, apiName: string): Promise<T> {
  return parseJsonResponse(response, apiName);
}

const VIDEO_ID_PATTERN = /^[A-Za-z0-9._:-]{1,128}$/;

export function isValidVideoId(value: string): boolean {
  return VIDEO_ID_PATTERN.test(value.trim());
}

// Chat Completions 返回的 completion ID 前缀（非 Sora 原生 video ID）
const COMPLETION_ID_PREFIXES = ['chatcmpl-', 'foaicmpl-'];

/** 判断 videoId 是否为 Sora 兼容的 video ID（排除 completion ID） */
export function isSoraVideoId(value: string): boolean {
  if (!isValidVideoId(value)) return false;
  const trimmed = value.trim();
  return !COMPLETION_ID_PREFIXES.some(prefix => trimmed.startsWith(prefix));
}

function normalizeVideoId(value: string): string {
  const trimmed = value.trim();
  if (!isValidVideoId(trimmed)) {
    throw new Error('Invalid video ID');
  }
  return trimmed;
}

/**
 * 将视频 ID 规范化为 /sora/v1/characters 的 from_task 参数格式。
 * 如果已经是 video_xxx 格式则直接返回，否则原样返回（由调用方负责解析）。
 */
function normalizeFromTaskId(videoId: string): string {
  return videoId.trim();
}

/**
 * 判断 videoId 是否为代理格式（model:id），而非原生 video_xxx 格式。
 * 例: "sora-2-pro:2c52445c-..." → true, "video_807c5a77-..." → false
 */
export function isProxyVideoId(videoId: string): boolean {
  const trimmed = videoId.trim();
  return trimmed.includes(':') && !trimmed.startsWith('video_');
}

/**
 * 通过查询视频状态，将代理格式 ID (model:uuid) 解析为原生 video_xxx 格式。
 * 用于 /sora/v1/characters 的 from_task 参数。
 */
export async function resolveNativeVideoId(videoId: string, channelId?: string): Promise<string> {
  const trimmed = videoId.trim();
  if (!isProxyVideoId(trimmed)) {
    return trimmed;
  }

  console.log('[Sora API] 尝试解析原生 video ID:', { proxyId: trimmed, channelId });
  try {
    const status = await getVideoStatus(trimmed, channelId);
    if (status.id && status.id.startsWith('video_')) {
      console.log('[Sora API] 解析成功:', { proxyId: trimmed, nativeId: status.id });
      return status.id;
    }
    console.log('[Sora API] 查询返回的 ID 仍非 video_ 格式:', { returnedId: status.id });
  } catch (err) {
    console.warn('[Sora API] 解析原生 video ID 失败:', err instanceof Error ? err.message : String(err));
  }
  return trimmed;
}

const DEFAULT_SORA_BASE_URL = DEFAULT_URLS.sora;

type SoraConfig = {
  apiKey: string;
  baseUrl: string;
  channelId?: string;
  channelType?: ChannelType;
};

let soraChannelCursor = 0;

function pickRoundRobinChannel(channels: VideoChannel[]): VideoChannel {
  const index = soraChannelCursor % channels.length;
  soraChannelCursor = (soraChannelCursor + 1) % channels.length;
  return channels[index];
}

// 获取 Sora 配置（优先从新渠道表读取，回退到旧 system_config）
async function getSoraConfig(options?: {
  channelId?: string;
  mode?: 'default' | 'round-robin';
  channelTypes?: ChannelType[];
}): Promise<SoraConfig> {
  const allowedTypes: ChannelType[] =
    options?.channelTypes && options.channelTypes.length > 0
      ? options.channelTypes
      : ['sora'];

  if (options?.channelId) {
    const channel = await getVideoChannel(options.channelId);
    // 显式指定 channelId 时跳过类型过滤，确保查询/下载阶段使用生成时的同一渠道
    if (channel && channel.apiKey) {
      return {
        apiKey: channel.apiKey,
        baseUrl: channel.baseUrl || DEFAULT_SORA_BASE_URL,
        channelId: channel.id,
        channelType: channel.type,
      };
    }
  }

  const channels = await getVideoChannels(true);
  const matchedChannels = channels.filter(c => allowedTypes.includes(c.type) && c.apiKey);
  if (matchedChannels.length > 0) {
    const selected =
      options?.mode === 'round-robin'
        ? pickRoundRobinChannel(matchedChannels)
        : matchedChannels[0];
    return {
      apiKey: selected.apiKey,
      baseUrl: selected.baseUrl || DEFAULT_SORA_BASE_URL,
      channelId: selected.id,
      channelType: selected.type,
    };
  }

  // 仅当允许 sora 类型时回退到系统配置
  if (allowedTypes.includes('sora')) {
    const config = await getSystemConfig();
    return {
      apiKey: config.soraApiKey || '',
      baseUrl: config.soraBaseUrl || DEFAULT_SORA_BASE_URL,
      channelType: 'sora',
    };
  }

  return {
    apiKey: '',
    baseUrl: '',
  };
}

// 创建自定义 Agent
const soraAgent = new Agent({
  bodyTimeout: 0,
  headersTimeout: 1800000, // 30分钟
  keepAliveTimeout: 1800000, // 30分钟
  keepAliveMaxTimeout: 1800000, // 30分钟
  pipelining: 0,
  connections: 30,
  connect: {
    timeout: 1800000, // 30分钟
  },
});

// ========================================
// Video Generation API (New Format)
// ========================================

export interface VideoGenerationRequest {
  prompt: string;
  model?: string;
  seconds?: '10' | '15' | '25';
  orientation?: 'landscape' | 'portrait';
  size?: string; // e.g., '1920x1080', '1080x1920'
  style_id?: string;
  input_image?: string; // Base64 encoded image
  input_image_mime?: string; // MIME type for input_image
  input_images?: string[]; // Base64 encoded images for R2V
  input_images_mimes?: string[]; // MIME types for input_images
  input_videos?: string[]; // Base64 encoded videos for omni_reference
  input_videos_mimes?: string[]; // MIME types for input_videos
  functionMode?: 'first_last_frames' | 'omni_reference';
  remix_target_id?: string;
  metadata?: string; // JSON string for extended params
  async_mode?: boolean;
}

// Video Remix request
export interface VideoRemixRequest {
  prompt: string;
  model?: string;
  seconds?: '10' | '15' | '25';
  size?: string;
  style_id?: string;
  async_mode?: boolean;
}

// Helper: check if status indicates completion
function isCompletedStatus(status: VideoTaskStatus): boolean {
  return status === 'completed' || status === 'succeeded';
}

// Helper: check if status indicates in progress
function isInProgressStatus(status: VideoTaskStatus): boolean {
  return status === 'queued' || status === 'pending' || status === 'in_progress' || status === 'processing';
}

// Video task status (new-api-main compatible)
export type VideoTaskStatus = 
  | 'queued'      // 排队中
  | 'pending'     // 等待中
  | 'in_progress' // 处理中 (new-api-main)
  | 'processing'  // 处理中 (legacy)
  | 'completed'   // 成功 (new-api-main)
  | 'succeeded'   // 成功 (legacy)
  | 'failed'      // 失败
  | 'cancelled';  // 已取消

// New API response format (new-api-main compatible)
export interface VideoTaskResponse {
  id: string;
  object: string;
  model: string;
  created_at: number;
  completed_at?: number;
  expires_at?: number;
  status: VideoTaskStatus;
  progress: number;
  size?: string;
  seconds?: string;
  quality?: string;
  url?: string;
  output?: { url?: string };
  permalink?: string;
  revised_prompt?: string;
  remixed_from_video_id?: string | null;
  metadata?: Record<string, unknown>;
  error?: {
    message: string;
    type?: string;
    code?: string;
  } | null;
}

// Legacy response format (for compatibility)
export interface VideoGenerationResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  data: Array<{
    url: string;
    permalink?: string;
    revised_prompt?: string;
    [key: string]: unknown;
  }>;
}

export interface VideoGenerationResult extends VideoGenerationResponse {
  channelId?: string;
  debugInfo?: any;
}

// ========================================
// Chat Completions Video Generation
// ========================================

// 多模态内容类型
export interface ChatCompletionTextContent {
  type: 'text';
  text: string;
}

export interface ChatCompletionImageContent {
  type: 'image_url';
  image_url: {
    url: string;
  };
}

export type ChatCompletionContentPart = ChatCompletionTextContent | ChatCompletionImageContent;

export interface ChatCompletionMessage {
  role: 'system' | 'user' | 'assistant';
  content: string | ChatCompletionContentPart[];
}

export interface ChatCompletionRequest {
  model: string;
  messages: ChatCompletionMessage[];
  temperature?: number;
  stream?: boolean;
}

export interface ChatCompletionResponse {
  id?: string;
  choices?: Array<{
    message?: {
      content?: string;
    };
    delta?: {
      content?: string;
    };
  }>;
  error?: {
    message?: string;
  };
  message?: string;
}

export interface ChatCompletionVideoContent {
  status?: string;
  video_url?: string;
  url?: string;
  task_id?: string;
  status_url?: string;
  progress?: number;
  error?: string;
}

// SSE 解析结果接口
export interface ParsedChatCompletionResponse {
  content: string;
  rawText: string;
  rawData: ChatCompletionResponse | null;
  isSse: boolean;
  streamId?: string;
  errorMessage?: string;
}

// 安全 JSON 解析
function safeJsonParse<T>(value: string): T | null {
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

// 提取 ChatCompletion 内容（兼容 message, delta, text, refusal, reasoning_content）
function extractChatCompletionContent(rawData: ChatCompletionResponse | any): string {
  if (!rawData) return '';
  return (
    rawData.choices?.[0]?.message?.content ||
    rawData.choices?.[0]?.delta?.content ||
    rawData.choices?.[0]?.delta?.reasoning_content ||
    rawData.choices?.[0]?.message?.reasoning_content ||
    rawData.choices?.[0]?.text || // Legacy completion support
    rawData.choices?.[0]?.message?.refusal || // Refusal support
    ''
  );
}

// 检测是否为 SSE 格式
function looksLikeSsePayload(text: string): boolean {
  return /^\s*(data:|event:|id:|retry:|:)/.test(text);
}

// 从响应内容提取 JSON
function extractJsonFromContent(content: string): string | null {
  const trimmed = content.trim();
  if (!trimmed) return null;
  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenceMatch) return fenceMatch[1].trim();
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) return trimmed;
  return null;
}

// 从文本提取 URL（优先匹配 markdown 链接语法，避免尾部括号污染）
function extractFirstUrl(content: string): string | null {
  // 优先从 markdown 链接 [text](url) 中提取
  const mdMatch = content.match(/\[.*?\]\((https?:\/\/[^)]+)\)/);
  if (mdMatch) return mdMatch[1];
  // 兜底：通用正则提取，并清理尾部常见标点
  const match = content.match(/https?:\/\/[^\s"'`]+/);
  if (!match) return null;
  return match[0].replace(/[)\].,;]+$/, '');
}

// 解析视频内容
function tryParseChatCompletionVideoContent(content: string): ChatCompletionVideoContent | null {
  const jsonText = extractJsonFromContent(content);
  if (jsonText) {
    try {
      const parsed = JSON.parse(jsonText);
      if (parsed && typeof parsed === 'object') {
        return parsed as ChatCompletionVideoContent;
      }
    } catch {
      // JSON 解析失败，尝试提取 URL
    }
  }
  const url = extractFirstUrl(content);
  if (url) {
    return { url };
  }

  // 检测非 JSON 格式的错误消息
  if (
    content.includes('❌') ||
    content.includes('失败') ||
    /failed/i.test(content) ||
    content.startsWith('Error:')
  ) {
    return { error: content };
  }

  return null;
}

// 解析单个 SSE 帧
function parseSseFrame(frame: string): {
  delta: string;
  done: boolean;
  streamId?: string;
  errorMessage?: string;
} {
  let delta = '';
  let done = false;
  let streamId: string | undefined;
  let errorMessage: string | undefined;

  const lines = frame.split(/\r?\n/);
  // 聚合多行 data: 内容
  let dataBuffer = '';

  for (const line of lines) {
    if (!line.startsWith('data:')) continue;
    const data = line.slice(5).trimStart();
    if (!data) continue;
    if (data === '[DONE]') {
      done = true;
      break;
    }

    // 尝试直接解析单行
    const parsed = safeJsonParse<ChatCompletionResponse>(data);
    if (parsed) {
      if (!streamId && typeof parsed.id === 'string') {
        streamId = parsed.id;
      }
      if (!errorMessage && parsed.error?.message) {
        errorMessage = parsed.error.message;
      }
      const piece = extractChatCompletionContent(parsed);
      if (piece) {
        delta += piece;
      }
    } else {
      // 可能是多行 JSON，累积到 buffer
      dataBuffer += data;
    }
  }

  // 尝试解析累积的多行 data
  if (dataBuffer) {
    const parsed = safeJsonParse<ChatCompletionResponse>(dataBuffer);
    if (parsed) {
      if (!streamId && typeof parsed.id === 'string') {
        streamId = parsed.id;
      }
      if (!errorMessage && parsed.error?.message) {
        errorMessage = parsed.error.message;
      }
      const piece = extractChatCompletionContent(parsed);
      if (piece) {
        delta += piece;
      }
    }
  }

  return { delta, done, streamId, errorMessage };
}

// 从 SSE delta 内容中提取进度百分比（匹配 "进度：XX.X%" 或 "progress: XX%"）
function extractProgressFromDelta(delta: string): number | null {
  const match = delta.match(/进度[：:]\s*([\d.]+)%/) || delta.match(/progress[：:]\s*([\d.]+)%/i);
  return match ? parseFloat(match[1]) : null;
}

// 读取 SSE 流内容
async function readChatCompletionSseContent(
  body: ReadableStream<Uint8Array> | NodeJS.ReadableStream | any,
  initialText: string = '',
  onProgress?: (progress: number, status: string) => void
): Promise<{ content: string; streamId?: string; errorMessage?: string }> {
  const reader = (body as ReadableStream<Uint8Array>).getReader();
  const decoder = new TextDecoder();
  // 标准化换行符：\r\n -> \n
  let buffer = initialText.replace(/\r\n/g, '\n');
  let content = '';
  let streamId: string | undefined;
  let errorMessage: string | undefined;

  const consumeFrames = (): boolean => {
    // 标准化换行符
    buffer = buffer.replace(/\r\n/g, '\n');
    let index = buffer.indexOf('\n\n');
    while (index !== -1) {
      const frame = buffer.slice(0, index);
      buffer = buffer.slice(index + 2);
      const parsed = parseSseFrame(frame);
      if (parsed.delta) {
        content += parsed.delta;
        // 实时提取进度并回调
        if (onProgress) {
          const progress = extractProgressFromDelta(parsed.delta);
          if (progress !== null) {
            onProgress(progress, 'processing');
          }
        }
      }
      if (!streamId && parsed.streamId) {
        streamId = parsed.streamId;
      }
      if (!errorMessage && parsed.errorMessage) {
        errorMessage = parsed.errorMessage;
      }
      if (parsed.done) {
        return true;
      }
      index = buffer.indexOf('\n\n');
    }
    return false;
  };

  // 处理初始文本中的帧
  if (consumeFrames()) {
    await reader.cancel();
    return { content, streamId, errorMessage };
  }

  // 继续读取流
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    if (value) {
      buffer += decoder.decode(value, { stream: true });
    }
    if (consumeFrames()) {
      await reader.cancel();
      return { content, streamId, errorMessage };
    }
  }

  // 处理剩余缓冲区
  buffer += decoder.decode();
  if (buffer.trim()) {
    const parsed = parseSseFrame(buffer);
    if (parsed.delta) {
      content += parsed.delta;
    }
    if (!streamId && parsed.streamId) {
      streamId = parsed.streamId;
    }
    if (!errorMessage && parsed.errorMessage) {
      errorMessage = parsed.errorMessage;
    }
  }

  return { content, streamId, errorMessage };
}

// 解析 JSON 响应
function parseChatCompletionJsonResponse(rawText: string): {
  rawData: ChatCompletionResponse | null;
  content: string;
} {
  const rawData = safeJsonParse<ChatCompletionResponse>(rawText);
  const content = extractChatCompletionContent(rawData);
  return { rawData, content };
}

// 解析完整 SSE 文本（非流式）
function parseSseText(text: string): { content: string; streamId?: string; errorMessage?: string } {
  // 标准化换行符
  const normalized = text.replace(/\r\n/g, '\n');
  const frames = normalized.split('\n\n');

  let content = '';
  let streamId: string | undefined;
  let errorMessage: string | undefined;

  console.log('[SSE Debug] Total frames:', frames.length);

  for (const frame of frames) {
    if (!frame.trim()) continue;

    // 调试：打印每个帧的原始内容
    const lines = frame.split('\n').filter(l => l.startsWith('data:'));
    for (const line of lines) {
      const data = line.slice(5).trim();
      if (data && data !== '[DONE]') {
        console.log('[SSE Debug] Frame data:', data.substring(0, 300));
      }
    }

    const parsed = parseSseFrame(frame);
    if (parsed.delta) {
      content += parsed.delta;
    }
    if (!streamId && parsed.streamId) {
      streamId = parsed.streamId;
    }
    if (!errorMessage && parsed.errorMessage) {
      errorMessage = parsed.errorMessage;
    }
    if (parsed.done) {
      break;
    }
  }

  console.log('[SSE Debug] Final content length:', content.length);
  console.log('[SSE Debug] Final content preview:', content.substring(0, 200));

  return { content, streamId, errorMessage };
}

// 主解析函数：兼容 SSE 和 JSON 响应
async function parseChatCompletionResponse(response: UndiciResponse): Promise<ParsedChatCompletionResponse> {
  const contentType = response.headers.get('content-type')?.toLowerCase() ?? '';

  // 先读取完整响应文本
  const rawText = await response.text();
  console.log('[SSE Debug] Content-Type:', contentType);
  console.log('[SSE Debug] Raw text preview:', rawText.substring(0, 200));

  // Content-Type 明确为 SSE 或内容看起来像 SSE
  const isSseFormat = contentType.includes('text/event-stream') || looksLikeSsePayload(rawText);

  if (isSseFormat) {
    console.log('[SSE Debug] Detected SSE format');
    const sseResult = parseSseText(rawText);
    return {
      content: sseResult.content,
      rawText,
      rawData: null,
      isSse: true,
      streamId: sseResult.streamId,
      errorMessage: sseResult.errorMessage,
    };
  }

  // 非 SSE，按 JSON 解析
  console.log('[SSE Debug] Detected JSON format');
  const { rawData, content } = parseChatCompletionJsonResponse(rawText);
  return { content, rawText, rawData, isSse: false };
}

// 自适应轮询间隔计算
function getPollingInterval(progress: number, stallCount: number): number {
  // 基础间隔根据进度调整
  let baseInterval: number;
  if (progress < 30) {
    baseInterval = 5000; // 0-30%: 5秒
  } else if (progress < 70) {
    baseInterval = 3000; // 30-70%: 3秒
  } else {
    baseInterval = 2000; // 70-100%: 2秒
  }
  
  // 停滞时增加间隔
  if (stallCount > 0) {
    baseInterval = Math.min(baseInterval + stallCount * 2000, 10000);
  }
  
  return baseInterval;
}

// 查询视频任务状态
export async function getVideoStatus(videoId: string, channelId?: string): Promise<VideoTaskResponse> {
  // 跳过非 Sora 兼容的 videoId
  if (!isSoraVideoId(videoId)) {
    throw new Error(`videoId "${videoId}" is not a Sora-compatible video ID, skipping status query`);
  }

  const { apiKey, baseUrl } = await getSoraConfig({ channelId });

  if (!apiKey) {
    throw new Error('Sora API Key 未配置');
  }

  const normalizedBaseUrl = baseUrl.replace(/\/$/, '');
  const normalizedVideoId = normalizeVideoId(videoId);
  const apiUrl = `${normalizedBaseUrl}/v1/videos/${encodeURIComponent(normalizedVideoId)}`;

  console.log('[Sora API] 查询视频状态:', { apiUrl, videoId, normalizedVideoId, channelId });
  
  const response = await fetchWithRetry(undiciFetch, apiUrl, () => ({
    method: 'GET',
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    dispatcher: soraAgent,
  }));
  
  const rawData = await response.json() as any;
  console.log('[Sora API] 查询响应:', vLog(JSON.stringify(rawData)));
  
  // 处理 NewAPI 包装格式
  let data = rawData;
  if (rawData?.code && rawData?.message && typeof rawData.message === 'string') {
    try {
      const parsed = JSON.parse(rawData.message);
      if (parsed?.id) {
        data = parsed;
        if (data.output?.url && !data.url) {
          data.url = data.output.url;
        }
        if (data.video_url && !data.url) {
          data.url = data.video_url;
        }
      }
    } catch {
      // 尝试正则提取
      const idMatch = rawData.message.match(/"id"\s*:\s*"([^"]+)"/);
      const statusMatch = rawData.message.match(/"status"\s*:\s*"([^"]+)"/);
      const progressMatch = rawData.message.match(/"progress"\s*:\s*(\d+)/);
      const urlMatch = rawData.message.match(/"url"\s*:\s*"(https?:\/\/[^"]+)"/);
      if (!urlMatch) {
        // 尝试匹配截断的 URL
        const truncatedUrlMatch = rawData.message.match(/"url"\s*:\s*"(https?:\/\/[^"]+)/);
        if (truncatedUrlMatch) {
          data = {
            id: idMatch?.[1] || videoId,
            status: statusMatch?.[1] || 'processing',
            progress: progressMatch ? parseInt(progressMatch[1]) : 0,
            url: truncatedUrlMatch[1],
          };
        }
      } else if (idMatch) {
        data = {
          id: idMatch[1],
          status: statusMatch?.[1] || 'processing',
          progress: progressMatch ? parseInt(progressMatch[1]) : 0,
          url: urlMatch?.[1],
        };
      }
    }
  }
  
  if (!response.ok && !data?.id) {
    const errorMessage = data?.error?.message || rawData?.message || '查询视频状态失败';
    throw new Error(errorMessage);
  }
  
  // 确保 progress 有默认值
  if (typeof data.progress !== 'number') {
    data.progress = 0;
  }
  
  // 处理 output.url 格式
  if (data.output?.url && !data.url) {
    data.url = data.output.url;
  }

  // 处理 video_url 格式（某些渠道返回 video_url 而非 url）
  if (data.video_url && !data.url) {
    data.url = data.video_url;
  }

  return data as VideoTaskResponse;
}

// 获取视频内容 URL（通过 /content 端点，跟随 302 重定向）
export async function getVideoContentUrl(videoId: string, channelId?: string): Promise<string> {
  // 跳过非 Sora 兼容的 videoId（如 chatcmpl-/foaicmpl- 前缀的 completion ID）
  if (!isSoraVideoId(videoId)) {
    throw new Error(`videoId "${videoId}" is not a Sora-compatible video ID, skipping API call`);
  }

  const { apiKey, baseUrl } = await getSoraConfig({ channelId });

  if (!apiKey) {
    throw new Error('Sora API Key 未配置');
  }

  const normalizedBaseUrl = baseUrl.replace(/\/$/, '');
  const normalizedVideoId = normalizeVideoId(videoId);
  const apiUrl = `${normalizedBaseUrl}/v1/videos/${encodeURIComponent(normalizedVideoId)}/content`;

  console.log('[Sora API] 获取视频内容:', { apiUrl, videoId, normalizedVideoId, channelId });
  
  // 使用 redirect: 'manual' 来捕获 302 重定向的 Location
  const requestInit: UndiciRequestInit = {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    redirect: 'manual',
    dispatcher: soraAgent,
  };
  const response = await fetchWithRetry(undiciFetch, apiUrl, () => requestInit);
  
  console.log('[Sora API v5] /content 响应状态:', response.status);
  
  // 如果是重定向（301, 302, 307, 308），返回 Location header 中的实际视频 URL
  if ([301, 302, 307, 308].includes(response.status)) {
    const location = response.headers.get('location');
    console.log('[Sora API] /content 重定向 Location:', vLog(location, 150));
    if (location) {
      return parseVideoUrl(location);
    }
  }
  
  // 如果是 200，可能直接返回了视频内容或 JSON
  if (response.status === 200) {
    const contentType = response.headers.get('content-type') || '';
    console.log('[Sora API v5] /content Content-Type:', contentType);

    // 如果返回的是视频二进制流，回退到查询接口获取 video_url
    if (contentType.startsWith('video/')) {
      console.log('[Sora API v5] /content 返回视频二进制，回退到查询接口获取 video_url');
      try {
        const statusData = await getVideoStatus(videoId, channelId);
        if (statusData.url) {
          return parseVideoUrl(statusData.url);
        }
      } catch (queryError) {
        console.warn('[Sora API v5] 查询接口也失败:', queryError);
      }
      // 查询接口也没拿到 URL，返回 /content URL 本身（需要认证代理）
      return apiUrl;
    }

    // 尝试读取响应内容
    const responseText = await response.text();
    console.log('[Sora API v5] /content 响应内容预览:', responseText.substring(0, 500));

    // 如果是 JSON，尝试解析获取 URL
    if (contentType.includes('application/json') || responseText.trim().startsWith('{')) {
      try {
        const data = JSON.parse(responseText) as any;
        console.log('[Sora API v5] /content JSON 解析成功:', JSON.stringify(data).substring(0, 200));
        if (data?.url) {
          return parseVideoUrl(data.url);
        }
        // 检查其他可能的 URL 字段
        if (data?.data?.url) {
          return parseVideoUrl(data.data.url);
        }
        if (data?.video_url) {
          return parseVideoUrl(data.video_url);
        }
        if (data?.content_url) {
          return parseVideoUrl(data.content_url);
        }
      } catch (parseError) {
        console.log('[Sora API v5] /content JSON 解析失败:', parseError);
      }
    }

    // 如果响应内容本身是一个 URL
    if (responseText.trim().startsWith('http')) {
      console.log('[Sora API v5] /content 响应是直接 URL');
      return parseVideoUrl(responseText.trim());
    }
  }
  
  // 如果是错误响应
  if (response.status >= 400) {
    const data = await response.json().catch(() => ({})) as any;
    console.log('[Sora API v5] /content 错误响应:', response.status, JSON.stringify(data));
    throw new Error(data?.error?.message || `获取视频内容失败: ${response.status}`);
  }
  
  // 兜底：返回 content URL（不推荐，因为需要认证）
  console.log('[Sora API v5] /content 未获取到重定向，返回原始 URL');
  throw new Error('无法获取视频直链');
}

// 轮询等待视频完成
export async function pollVideoCompletion(
  videoId: string,
  onProgress?: (progress: number, status: string) => void,
  channelId?: string
): Promise<VideoTaskResponse> {
  const config = await getSystemConfig();
  const retryConfig = config.retryConfig ?? getDefaultRetryConfig();
  const pollingConfig = retryConfig.soraPolling;
  const failedConfig = retryConfig.soraFailed;

  let lastProgress = -1;
  let stallCount = 0;
  const maxStallCount = Math.max(1, pollingConfig.stallThreshold);
  const pollStartedAt = Date.now();
  const maxPollDurationMs = Math.max(0, pollingConfig.maxPollDurationMs);
  let failedCount = 0;
  const maxFailedCount = Math.max(1, failedConfig.maxAttempts);
  const failedRetryDelayMs = Math.max(0, Math.min(failedConfig.baseDelayMs, failedConfig.maxDelayMs));
  const retryableFailedPatterns = ['stale in_progress timeout', 'stale in progress timeout'];

  const isRetryableFailedError = (message?: string | null): boolean => {
    if (!message) return false;
    const lower = message.toLowerCase();
    return retryableFailedPatterns.some(pattern => lower.includes(pattern));
  };

  while (true) {
    // 检查是否超过最大轮询时长
    if (maxPollDurationMs > 0 && Date.now() - pollStartedAt > maxPollDurationMs) {
      throw new Error('视频轮询超时：超过最大轮询时长');
    }

    const status = await getVideoStatus(videoId, channelId);
    
    if (onProgress) {
      onProgress(status.progress, status.status);
    }
    
    console.log('[Sora API] 轮询状态:', vLog(JSON.stringify({
      videoId,
      channelId,
      status: status.status,
      progress: status.progress,
      url: status.url,
      outputUrl: status.output?.url,
      model: status.model,
      error: status.error,
      elapsedMs: Date.now() - pollStartedAt,
      stallCount,
    })));
    
    // 统一处理 output.url 格式
    if (status.output?.url && !status.url) {
      status.url = status.output.url;
    }
    
    // 成功状态 (兼容 new-api-main)
    if (isCompletedStatus(status.status)) {
      // 如果没有 URL，尝试通过 /content 端点获取
      if (!status.url) {
        try {
          console.log('[Sora API v5] 状态完成但无 URL，尝试 /content 端点');
          const contentUrl = await getVideoContentUrl(videoId, channelId);
          status.url = contentUrl;
        } catch (e) {
          console.log('[Sora API v5] /content 端点获取失败:', e);
        }
      }
      return status;
    }

    if (status.status === 'failed') {
      failedCount += 1;
      const errorMessage = status.error?.message || '视频生成失败';
      // 如果失败重试被禁用或不是可重试的错误，直接抛出
      if (!failedConfig.enabled || !isRetryableFailedError(status.error?.message)) {
        throw new Error(errorMessage);
      }
      if (failedCount >= maxFailedCount) {
        throw new Error(errorMessage);
      }
      console.warn(
        `[Sora API v5] Status failed (${failedCount}/${maxFailedCount}), retrying after ${failedRetryDelayMs}ms: ${errorMessage}`
      );
      await new Promise(resolve => setTimeout(resolve, failedRetryDelayMs));
      continue;
    } else {
      failedCount = 0;
    }

    // 检测停滞
    if (status.progress === lastProgress) {
      stallCount++;
      if (stallCount >= maxStallCount) {
        throw new Error('视频生成超时：进度长时间无变化');
      }
    } else {
      stallCount = 0;
      lastProgress = status.progress;
    }

    // 自适应等待
    const interval = getPollingInterval(status.progress, stallCount);
    // 检查等待后是否会超过最大轮询时长
    if (maxPollDurationMs > 0 && Date.now() - pollStartedAt + interval > maxPollDurationMs) {
      throw new Error('视频轮询超时：超过最大轮询时长');
    }
    await new Promise(resolve => setTimeout(resolve, interval));
  }
}

export async function generateVideo(
  request: VideoGenerationRequest,
  onProgress?: (progress: number, status: string) => void,
  options?: { channelId?: string; onVideoIdReady?: (videoId: string, channelId?: string) => void }
): Promise<VideoGenerationResult> {
  void refreshVerboseFlag();
  const { apiKey, baseUrl, channelId } = await getSoraConfig({
    channelId: options?.channelId,
    mode: options?.channelId ? 'default' : 'round-robin',
  });

  if (!apiKey) {
    throw new Error('Sora API Key 未配置，请在管理后台「视频渠道」中配置 Sora 渠道');
  }

  if (!baseUrl) {
    throw new Error('Sora Base URL 未配置');
  }

  const normalizedBaseUrl = baseUrl.replace(/\/$/, '');
  const apiUrl = `${normalizedBaseUrl}/v1/videos`;

  console.log('[Sora API] 视频生成请求:', {
    apiUrl,
    channelId,
    model: request.model,
    prompt: vLog(request.prompt, 100),
    seconds: request.seconds,
    size: request.size,
    orientation: request.orientation,
    style_id: request.style_id,
    remix_target_id: request.remix_target_id,
    hasInputImage: !!request.input_image,
    inputImageLength: request.input_image?.length || 0,
  });

  const buildFormData = () => {
    const formData = new FormData();

    const prompt = request.prompt || 'Generate video';

    formData.append('prompt', prompt);
    if (request.model) formData.append('model', request.model);
    if (request.seconds) formData.append('seconds', request.seconds);
    // size 不作为独立字段发送（API 文档不支持，由 orientation 决定）
    if (request.orientation) formData.append('orientation', request.orientation);
    if (request.style_id) formData.append('style_id', request.style_id);
    if (request.remix_target_id) formData.append('remix_target_id', request.remix_target_id);

    if (request.input_image) {
      const imageBuffer = Buffer.from(request.input_image, 'base64');
      const imageBlob = new Blob([imageBuffer], { type: 'image/jpeg' });
      formData.append('input_reference', imageBlob, 'input.jpg');
    }

    return formData;
  };

  const response = await fetchWithRetry(undiciFetch, apiUrl, () => ({
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    body: buildFormData(),
    dispatcher: soraAgent,
  }));

  const rawData = await safeParseApiResponse<any>(response, 'Sora');

  // 版本标记 v4 - 改进 NewAPI 格式解析
  console.log('[Sora API v4] 原始响应:', JSON.stringify(rawData));

  // HD 回退已移除：/v1/videos 端点不接受 size 参数，分辨率由模型名称决定

  // 处理 NewAPI 包装格式：{code: "...", message: "{json string}", data: null}
  let data = rawData;
  if (rawData?.code && rawData?.message && typeof rawData.message === 'string') {
    try {
      // 尝试解析 message 字段中的 JSON
      const parsed = JSON.parse(rawData.message);
      if (parsed?.id) {
        console.log('[Sora API v5] 检测到 NewAPI 格式，解析 message 字段成功');
        // 处理 output.url 格式
        if (parsed.output?.url && !parsed.url) {
          parsed.url = parsed.output.url;
        }
        data = parsed;
      }
    } catch (parseError) {
      console.log('[Sora API v5] message JSON 解析失败:', parseError);
      // 尝试用正则提取关键字段
      try {
        const idMatch = rawData.message.match(/"id"\s*:\s*"([^"]+)"/);
        const statusMatch = rawData.message.match(/"status"\s*:\s*"([^"]+)"/);
        // 匹配 URL - 支持截断的情况（URL 可能没有闭合引号）
        // 先尝试匹配完整 URL，再尝试匹配截断的
        let urlMatch = rawData.message.match(/"url"\s*:\s*"(https?:\/\/[^"]+)"/);
        if (!urlMatch) {
          // 匹配截断的 URL（到字符串末尾）
          urlMatch = rawData.message.match(/"url"\s*:\s*"(https?:\/\/[^"]+)/);
        }
        
        if (idMatch) {
          console.log('[Sora API v5] 使用正则提取关键字段, urlFound:', !!urlMatch);
          data = {
            id: idMatch[1],
            status: statusMatch ? statusMatch[1] : undefined,
            url: urlMatch ? urlMatch[1] : undefined,
          };
        }
      } catch (regexError) {
        console.log('[Sora API v5] 正则提取失败:', regexError);
      }
    }
  }

  console.log('[Sora API] 解析后数据:', vLog(JSON.stringify({
    id: data?.id,
    status: data?.status,
    progress: data?.progress,
    url: data?.url,
    outputUrl: data?.output?.url,
    model: data?.model,
    error: data?.error,
    created_at: data?.created_at,
    permalink: data?.permalink,
    revised_prompt: data?.revised_prompt,
  })));

  // 统一处理 output.url 格式
  if (data?.output?.url && !data?.url) {
    data.url = data.output.url;
  }
  
  // 确保 progress 有默认值
  if (data && typeof data.progress !== 'number') {
    data.progress = 0;
  }

  // 检查是否是错误响应（NewAPI 格式的真正错误）
  if (!response.ok && !data?.id) {
    const errorMessage = data?.error?.message || rawData?.message || data?.error || '视频生成失败';
    console.error('[Sora API v5] 视频生成错误:', errorMessage);
    throw new Error(errorMessage);
  }

  // 检查是否是新格式响应（有 id 和 status 字段，或者有 id 和 url 字段）
  if (data?.id && (data?.status || data?.url)) {
    const taskResponse = data as VideoTaskResponse;
    
    // 如果已经成功（有 url 或状态为完成）
    const isCompleted = isCompletedStatus(taskResponse.status);
    if (taskResponse.url || isCompleted) {
      if (taskResponse.url) {
        const videoUrl = parseVideoUrl(taskResponse.url);
        console.log('[Sora API] 视频生成成功:', { videoUrl: vLog(videoUrl, 120), taskId: taskResponse.id, channelId });
        return {
          id: taskResponse.id,
          object: taskResponse.object || 'video',
          created: taskResponse.created_at || Date.now(),
          model: taskResponse.model || '',
          data: [{
            url: videoUrl,
            permalink: taskResponse.permalink,
            revised_prompt: taskResponse.revised_prompt,
          }],
          channelId,
        };
      }
      // 状态是完成但没有 URL，尝试轮询获取
      if (isCompleted && !taskResponse.url) {
        console.log('[Sora API v5] 状态已完成但无 URL，尝试轮询获取...');
      }
    }
    
    // 如果失败，抛出错误
    if (taskResponse.status === 'failed') {
      throw new Error(taskResponse.error?.message || '视频生成失败');
    }
    
    // 如果还在处理中或需要获取 URL，轮询等待
    if (isInProgressStatus(taskResponse.status) || (taskResponse.id && !taskResponse.url)) {
      if (options?.onVideoIdReady) {
        try {
          options.onVideoIdReady(taskResponse.id, channelId);
        } catch (err) {
          console.warn('[Sora API] onVideoIdReady callback failed:', err);
        }
      }
      console.log('[Sora API v5] 开始轮询... taskId:', taskResponse.id);
      const finalStatus = await pollVideoCompletion(taskResponse.id, onProgress, channelId);
      
      if (!finalStatus.url) {
        throw new Error('视频生成完成但未返回 URL');
      }
      
      const videoUrl = parseVideoUrl(finalStatus.url);
      return {
        id: finalStatus.id,
        object: finalStatus.object || 'video',
        created: finalStatus.created_at || Date.now(),
        model: finalStatus.model || '',
        data: [{
          url: videoUrl,
          permalink: finalStatus.permalink,
          revised_prompt: finalStatus.revised_prompt,
        }],
        channelId,
      };
    }
  }

  // 旧格式响应（直接返回 data 数组）
  if (data?.data && Array.isArray(data.data) && data.data.length > 0 && data.data[0]?.url) {
    console.log('[Sora API] 视频生成成功（旧格式）:', data.data[0].url);
    const legacy = data as VideoGenerationResponse;
    return { ...legacy, channelId };
  }

  // 未知格式，抛出错误
  console.error('[Sora API] 未知响应格式:', JSON.stringify(data));
  throw new Error('视频生成失败：API 返回了未知格式的响应');
}

// 异步创建视频任务（立即返回任务ID）
export async function createVideoTask(request: VideoGenerationRequest): Promise<VideoTaskResponse> {
  const { apiKey, baseUrl } = await getSoraConfig();

  if (!apiKey) {
    throw new Error('Sora API Key 未配置');
  }

  const normalizedBaseUrl = baseUrl.replace(/\/$/, '');
  const apiUrl = `${normalizedBaseUrl}/v1/videos`;

  console.log('[Sora API] 创建异步视频任务请求:', {
    apiUrl,
    prompt: vLog(request.prompt, 100),
    model: request.model,
    seconds: request.seconds,
    size: request.size,
    orientation: request.orientation,
    style_id: request.style_id,
    remix_target_id: request.remix_target_id,
    hasInputImage: !!request.input_image,
    inputImageLength: request.input_image?.length || 0,
    async_mode: true,
  });

  const buildFormData = () => {
    const formData = new FormData();

    formData.append('prompt', request.prompt || 'Generate video');
    formData.append('async_mode', 'true');

    if (request.model) formData.append('model', request.model);
    if (request.seconds) formData.append('seconds', request.seconds);
    // size 不作为独立字段发送（API 文档不支持，由 orientation 决定）
    if (request.orientation) formData.append('orientation', request.orientation);
    if (request.style_id) formData.append('style_id', request.style_id);
    if (request.remix_target_id) formData.append('remix_target_id', request.remix_target_id);

    if (request.input_image) {
      const imageBuffer = Buffer.from(request.input_image, 'base64');
      const imageBlob = new Blob([imageBuffer], { type: 'image/jpeg' });
      formData.append('input_reference', imageBlob, 'input.jpg');
    }

    return formData;
  };

  const response = await fetchWithRetry(undiciFetch, apiUrl, () => ({
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    body: buildFormData(),
    dispatcher: soraAgent,
  }));

  const data = await response.json() as any;
  console.log('[Sora API] 创建异步视频任务响应:', vLog(JSON.stringify(data)));

  if (!response.ok) {
    throw new Error(data?.error?.message || '创建视频任务失败');
  }

  return data as VideoTaskResponse;
}

// ========================================
// Video Remix API (new-api compatible)
// POST /v1/videos/{video_id}/remix
// ========================================

export async function remixVideo(
  videoId: string,
  request: VideoRemixRequest,
  onProgress?: (progress: number, status: string) => void
): Promise<VideoGenerationResponse> {
  const { apiKey, baseUrl } = await getSoraConfig();

  if (!apiKey) {
    throw new Error('Sora API Key 未配置');
  }

  if (!baseUrl) {
    throw new Error('Sora Base URL 未配置');
  }

  const normalizedBaseUrl = baseUrl.replace(/\/$/, '');
  const normalizedVideoId = normalizeVideoId(videoId);
  const apiUrl = `${normalizedBaseUrl}/v1/videos/${encodeURIComponent(normalizedVideoId)}/remix`;

  console.log('[Sora API] Remix 请求:', {
    apiUrl,
    videoId: normalizedVideoId,
    prompt: vLog(request.prompt, 100),
    model: request.model,
    seconds: request.seconds,
    size: request.size,
    style_id: request.style_id,
    async_mode: request.async_mode ?? true,
  });

  const response = await fetchWithRetry(undiciFetch, apiUrl, () => ({
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      prompt: request.prompt,
      model: request.model,
      seconds: request.seconds,
      size: request.size,
      style_id: request.style_id,
      async_mode: request.async_mode ?? true,
    }),
    dispatcher: soraAgent,
  }));

  const rawData = await response.json() as any;
  console.log('[Sora API] Remix 响应:', vLog(JSON.stringify(rawData)));

  if (!response.ok && !rawData?.id) {
    const errorMessage = rawData?.error?.message || rawData?.message || 'Remix 失败';
    throw new Error(errorMessage);
  }

  const taskResponse = rawData as VideoTaskResponse;

  // 如果已完成且有 URL
  if (isCompletedStatus(taskResponse.status) && taskResponse.url) {
    const videoUrl = parseVideoUrl(taskResponse.url);
    return {
      id: taskResponse.id,
      object: taskResponse.object || 'video',
      created: taskResponse.created_at || Date.now(),
      model: taskResponse.model || '',
      data: [{
        url: videoUrl,
        permalink: taskResponse.permalink,
        revised_prompt: taskResponse.revised_prompt,
      }],
    };
  }

  // 如果失败
  if (taskResponse.status === 'failed' || taskResponse.status === 'cancelled') {
    throw new Error(taskResponse.error?.message || 'Remix 失败');
  }

  // 异步模式或需要轮询
  if (isInProgressStatus(taskResponse.status) || (taskResponse.id && !taskResponse.url)) {
    console.log('[Sora API] Remix 开始轮询... taskId:', taskResponse.id);
    const finalStatus = await pollVideoCompletion(taskResponse.id, onProgress);

    if (!finalStatus.url) {
      throw new Error('Remix 完成但未返回 URL');
    }

    const videoUrl = parseVideoUrl(finalStatus.url);
    return {
      id: finalStatus.id,
      object: finalStatus.object || 'video',
      created: finalStatus.created_at || Date.now(),
      model: finalStatus.model || '',
      data: [{
        url: videoUrl,
        permalink: finalStatus.permalink,
        revised_prompt: finalStatus.revised_prompt,
      }],
    };
  }

  throw new Error('Remix 返回了未知格式的响应');
}

// 异步创建 Remix 任务（立即返回任务ID）
export async function createRemixTask(
  videoId: string,
  request: VideoRemixRequest
): Promise<VideoTaskResponse> {
  const { apiKey, baseUrl } = await getSoraConfig();

  if (!apiKey) {
    throw new Error('Sora API Key 未配置');
  }

  const normalizedBaseUrl = baseUrl.replace(/\/$/, '');
  const normalizedVideoId = normalizeVideoId(videoId);
  const apiUrl = `${normalizedBaseUrl}/v1/videos/${encodeURIComponent(normalizedVideoId)}/remix`;

  console.log('[Sora API] 创建 Remix 任务请求:', {
    apiUrl,
    videoId: normalizedVideoId,
    prompt: vLog(request.prompt, 100),
    model: request.model,
    seconds: request.seconds,
    size: request.size,
    style_id: request.style_id,
    async_mode: true,
  });

  const response = await fetchWithRetry(undiciFetch, apiUrl, () => ({
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      prompt: request.prompt,
      model: request.model,
      seconds: request.seconds,
      size: request.size,
      style_id: request.style_id,
      async_mode: true,
    }),
    dispatcher: soraAgent,
  }));

  const data = await response.json() as any;
  console.log('[Sora API] 创建 Remix 任务响应:', vLog(JSON.stringify(data)));

  if (!response.ok) {
    throw new Error(data?.error?.message || '创建 Remix 任务失败');
  }

  return data as VideoTaskResponse;
}


// ========================================
// Image Generation API
// ========================================

export interface ImageGenerationRequest {
  prompt: string;
  model?: string;
  n?: number;
  size?: string;
  quality?: 'standard' | 'hd';
  style?: 'natural' | 'vivid';
  response_format?: 'url' | 'b64_json';
  input_image?: string; // Base64 encoded image
}

export interface ImageGenerationResponse {
  created: number;
  data: Array<{
    url?: string;
    b64_json?: string;
    revised_prompt?: string;
  }>;
}

export async function generateImage(request: ImageGenerationRequest): Promise<ImageGenerationResponse> {
  const { apiKey, baseUrl } = await getSoraConfig();

  if (!apiKey) {
    throw new Error('Sora API Key 未配置，请在管理后台「视频渠道」中配置 Sora 渠道');
  }

  if (!baseUrl) {
    throw new Error('Sora Base URL 未配置');
  }

  const normalizedBaseUrl = baseUrl.replace(/\/$/, '');
  const apiUrl = `${normalizedBaseUrl}/v1/images/generations`;

  console.log('[Sora API] 图片生成请求:', {
    apiUrl,
    model: request.model,
    prompt: request.prompt?.substring(0, 50),
  });

  const response = await fetchWithRetry(undiciFetch, apiUrl, () => ({
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(request),
    dispatcher: soraAgent,
  }));

  const data = await response.json() as any;

  if (!response.ok) {
    const errorMessage = data?.error?.message || data?.message || '图片生成失败';
    console.error('[Sora API] 图片生成错误:', errorMessage);
    throw new Error(errorMessage);
  }

  console.log('[Sora API] 图片生成成功');
  return data as ImageGenerationResponse;
}

// ========================================
// Character Card API
// ========================================

export interface CharacterCardRequest {
  video_base64: string;
  model?: string;
  timestamps?: string;
  username?: string;
  display_name?: string;
  instruction_set?: string;
  safety_instruction_set?: string;
}

export interface CharacterCardResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  data: {
    cameo_id: string;
    username: string;
    display_name?: string;
    message: string;
  };
}

export async function createCharacterCard(request: CharacterCardRequest): Promise<CharacterCardResponse> {
  const { apiKey, baseUrl } = await getSoraConfig();

  if (!apiKey) {
    throw new Error('Sora API Key 未配置，请在管理后台「视频渠道」中配置 Sora 渠道');
  }

  if (!baseUrl) {
    throw new Error('Sora Base URL 未配置');
  }

  const normalizedBaseUrl = baseUrl.replace(/\/$/, '');
  const apiUrl = `${normalizedBaseUrl}/v1/characters`;

  console.log('[Sora API] 角色卡创建请求');

  const buildFormData = () => {
    const formData = new FormData();
    formData.append('model', request.model || 'sora-video-10s');
    formData.append('timestamps', request.timestamps || '0,3');
    if (request.username) formData.append('username', request.username);
    if (request.display_name) formData.append('display_name', request.display_name);
    if (request.instruction_set) formData.append('instruction_set', request.instruction_set);
    if (request.safety_instruction_set) formData.append('safety_instruction_set', request.safety_instruction_set);

    const videoBuffer = Buffer.from(request.video_base64, 'base64');
    const videoBlob = new Blob([videoBuffer], { type: 'video/mp4' });
    formData.append('video', videoBlob, 'video.mp4');

    return formData;
  };

  const response = await fetchWithRetry(undiciFetch, apiUrl, () => ({
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    body: buildFormData(),
    dispatcher: soraAgent,
  }));

  const data = await response.json() as any;

  if (!response.ok) {
    const errorMessage = data?.error?.message || data?.message || '角色卡创建失败';
    console.error('[Sora API] 角色卡创建错误:', errorMessage);
    throw new Error(errorMessage);
  }

  console.log('[Sora API] 角色卡创建成功:', JSON.stringify(data, null, 2));
  return data as CharacterCardResponse;
}

// ========================================
// Character Card from Task API (独立配置)
// ========================================

// 查找具有角色创建能力的模型（优先同渠道，其次跨渠道）
interface CharacterModelConfig {
  apiModel: string;
  baseUrl: string;
  apiKey: string;
  channelName: string;
}

async function findCharacterModel(preferChannelId?: string): Promise<CharacterModelConfig | null> {
  const allModels = await getVideoModels(true);

  // 优先在指定渠道中查找
  if (preferChannelId) {
    const channelModel = allModels.find(
      m => m.channelId === preferChannelId && m.features.characterCreation
    );
    if (channelModel) {
      const channel = await getVideoChannel(channelModel.channelId);
      if (channel?.enabled) {
        return {
          apiModel: channelModel.apiModel,
          baseUrl: channelModel.baseUrl || channel.baseUrl,
          apiKey: channelModel.apiKey || channel.apiKey,
          channelName: channel.name,
        };
      }
    }
  }

  // 跨渠道查找
  for (const model of allModels) {
    if (!model.features.characterCreation) continue;
    if (model.channelId === preferChannelId) continue;
    const channel = await getVideoChannel(model.channelId);
    if (!channel?.enabled) continue;
    return {
      apiModel: model.apiModel,
      baseUrl: model.baseUrl || channel.baseUrl,
      apiKey: model.apiKey || channel.apiKey,
      channelName: channel.name,
    };
  }

  return null;
}

// 安全解析角色卡 API 响应（防御 HTML 错误页面）
async function safeCharacterApiJson(response: UndiciResponse, context: string): Promise<any> {
  const contentType = response.headers.get('content-type') || '';
  const text = await response.text();

  if (contentType.includes('text/html') || text.trimStart().startsWith('<')) {
    console.error(`[${context}] API 返回 HTML 而非 JSON (status: ${response.status}):`, text.substring(0, 200));
    throw new Error(`API 错误 (状态码: ${response.status}): 服务端返回了 HTML 页面而非 JSON，请检查角色创建 API 配置`);
  }

  try {
    return JSON.parse(text);
  } catch {
    console.error(`[${context}] JSON 解析失败 (status: ${response.status}):`, text.substring(0, 200));
    throw new Error(`API 错误 (状态码: ${response.status}): ${text.substring(0, 100)}`);
  }
}

export interface CharacterCardFromTaskRequest {
  from_task: string;
  timestamps: string;
}

export interface CharacterCardFromTaskResponse {
  id: string;
  username: string;
  permalink: string;
  profile_picture_url: string;
}

export async function createCharacterCardFromTask(
  request: CharacterCardFromTaskRequest,
  channelId?: string
): Promise<CharacterCardFromTaskResponse> {
  let apiKey = '';
  let baseUrl = '';
  let modelName = 'character-training';

  // 优先级 1: 通过模型特性查找角色创建模型
  const charModel = await findCharacterModel(channelId);
  if (charModel) {
    baseUrl = charModel.baseUrl;
    apiKey = charModel.apiKey;
    modelName = charModel.apiModel;
    console.log(`[Character API] fromTask 使用角色模型: ${charModel.apiModel} (${charModel.channelName})`);
  }

  // 优先级 2: 渠道主配置回退
  if ((!baseUrl || !apiKey) && channelId) {
    const channel = await getVideoChannel(channelId);
    if (channel?.baseUrl && channel?.apiKey) {
      baseUrl = channel.baseUrl;
      apiKey = channel.apiKey;
      console.log(`[Character API] fromTask 使用渠道主配置: ${channel.name} (${channel.baseUrl})`);
    }
  }

  if (!apiKey || !baseUrl) {
    throw new Error('角色创建 API 未配置。请在管理后台的视频模型管理中为角色模型勾选「角色创建」特性');
  }

  const normalizedBaseUrl = baseUrl.replace(/\/$/, '');
  const normalizedVideoId = normalizeFromTaskId(request.from_task);
  const apiUrl = `${normalizedBaseUrl}/sora/v1/characters`;

  console.log('[Character API] 从任务创建角色卡请求:', { from_task: normalizedVideoId, original: request.from_task, timestamps: request.timestamps, model: modelName });

  const response = await fetchWithRetry(undiciFetch, apiUrl, () => ({
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      from_task: normalizedVideoId,
      timestamps: request.timestamps,
      model: modelName,
    }),
    dispatcher: soraAgent,
  }));

  const data = await safeCharacterApiJson(response, 'Character API');

  if (!response.ok) {
    const errorMessage = data?.error?.message || data?.message || '角色卡创建失败';
    console.error('[Character API] 角色卡创建错误:', errorMessage);
    throw new Error(errorMessage);
  }

  console.log('[Character API] 角色卡创建成功:', JSON.stringify(data, null, 2));
  return data as CharacterCardFromTaskResponse;
}

// ========================================
// Character Card from URL API (独立配置)
// ========================================

export interface CharacterCardFromUrlRequest {
  url: string;
  timestamps: string;
}

export async function createCharacterCardFromUrl(
  request: CharacterCardFromUrlRequest,
  channelId?: string
): Promise<CharacterCardFromTaskResponse> {
  let apiKey = '';
  let baseUrl = '';
  let modelName = 'character-training';

  // 优先级 1: 通过模型特性查找角色创建模型
  const charModel = await findCharacterModel(channelId);
  if (charModel) {
    baseUrl = charModel.baseUrl;
    apiKey = charModel.apiKey;
    modelName = charModel.apiModel;
    console.log(`[Character API] fromUrl 使用角色模型: ${charModel.apiModel} (${charModel.channelName})`);
  }

  // 优先级 2: 渠道主配置回退
  if ((!baseUrl || !apiKey) && channelId) {
    const channel = await getVideoChannel(channelId);
    if (channel?.baseUrl && channel?.apiKey) {
      baseUrl = channel.baseUrl;
      apiKey = channel.apiKey;
      console.log(`[Character API] fromUrl 使用渠道主配置: ${channel.name} (${channel.baseUrl})`);
    }
  }

  if (!apiKey || !baseUrl) {
    throw new Error('角色创建 API 未配置。请在管理后台的视频模型管理中为角色模型勾选「角色创建」特性');
  }

  const normalizedBaseUrl = baseUrl.replace(/\/$/, '');
  const normalizedUrl = parseVideoUrl(request.url);
  if (!normalizedUrl) {
    throw new Error('视频 URL 为空，无法创建角色卡');
  }
  const apiUrl = `${normalizedBaseUrl}/sora/v1/characters`;

  console.log('[Character API] 从 URL 创建角色卡请求:', { url: normalizedUrl, timestamps: request.timestamps, model: modelName });

  const response = await fetchWithRetry(undiciFetch, apiUrl, () => ({
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      url: normalizedUrl,
      timestamps: request.timestamps,
      model: modelName,
    }),
    dispatcher: soraAgent,
  }));

  const data = await safeCharacterApiJson(response, 'Character API');

  if (!response.ok) {
    const errorMessage = data?.error?.message || data?.message || '角色卡创建失败';
    console.error('[Character API] 角色卡创建错误:', errorMessage);
    throw new Error(errorMessage);
  }

  console.log('[Character API] 角色卡创建成功:', JSON.stringify(data, null, 2));
  return data as CharacterCardFromTaskResponse;
}

// ========================================
// Character Search API
// ========================================

export interface CharacterSearchRequest {
  username: string;
  intent?: 'users' | 'cameo';
  limit?: number;
}

export interface CharacterSearchResponse {
  success: boolean;
  query: string;
  count: number;
  results: Array<{
    user_id: string;
    username: string;
    display_name: string;
    profile_picture_url: string;
    can_cameo: boolean;
    token: string;
  }>;
}

export async function searchCharacters(request: CharacterSearchRequest): Promise<CharacterSearchResponse> {
  const { apiKey, baseUrl } = await getSoraConfig();

  if (!apiKey) {
    throw new Error('Sora API Key 未配置');
  }

  if (!baseUrl) {
    throw new Error('Sora Base URL 未配置');
  }

  const normalizedBaseUrl = baseUrl.replace(/\/$/, '');
  const params = new URLSearchParams();
  params.append('username', request.username);
  if (request.intent) params.append('intent', request.intent);
  if (request.limit) params.append('limit', String(request.limit));

  const apiUrl = `${normalizedBaseUrl}/v1/characters/search?${params.toString()}`;

  const response = await fetchWithRetry(undiciFetch, apiUrl, () => ({
    method: 'GET',
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    dispatcher: soraAgent,
  }));

  const data = await response.json() as any;

  if (!response.ok) {
    throw new Error(data?.error?.message || '角色搜索失败');
  }

  return data as CharacterSearchResponse;
}

// ========================================
// Invite Code API
// ========================================

export interface InviteCodeResponse {
  success: boolean;
  invite_code: string;
  remaining_count: number;
  total_count: number;
  email: string;
}

export async function getInviteCode(): Promise<InviteCodeResponse> {
  const { apiKey, baseUrl } = await getSoraConfig();

  if (!apiKey) {
    throw new Error('Sora API Key 未配置');
  }

  if (!baseUrl) {
    throw new Error('Sora Base URL 未配置');
  }

  const normalizedBaseUrl = baseUrl.replace(/\/$/, '');
  const apiUrl = `${normalizedBaseUrl}/v1/invite-codes`;

  const response = await fetchWithRetry(undiciFetch, apiUrl, () => ({
    method: 'GET',
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    dispatcher: soraAgent,
  }));

  const data = await response.json() as any;

  if (!response.ok) {
    throw new Error(data?.error?.message || '邀请码获取失败');
  }

  return data as InviteCodeResponse;
}


// ========================================
// Prompt Enhancement API
// ========================================

export interface EnhancePromptRequest {
  prompt: string;
  expansion_level?: 'short' | 'medium' | 'long';
  duration_s?: 10 | 15;
}

export interface EnhancePromptResponse {
  enhanced_prompt: string;
  _debug?: {
    apiUrl: string;
    model: string;
  };
}

// 从 LLM 响应中提取最终的增强提示词（过滤掉思考过程）
function extractFinalPrompt(rawText: string): string {
  if (!rawText) return '';

  let text = rawText.trim();

  // 策略0: 首先处理 <think>...</think> 标签（DeepSeek-R1 等模型使用）
  // 移除 <think> 标签内的所有内容，只保留标签外的内容
  const thinkTagRegex = /<think>[\s\S]*?<\/think>/gi;
  if (thinkTagRegex.test(text)) {
    console.log('[extractFinalPrompt] 检测到 <think> 标签，移除思考内容');
    const cleanedText = text.replace(thinkTagRegex, '').trim();
    if (cleanedText && cleanedText.length > 20) {
      console.log('[extractFinalPrompt] 移除 <think> 后内容长度:', cleanedText.length);
      text = cleanedText;
      // 如果移除后的内容看起来是最终结果，直接返回
      if (!cleanedText.includes('**My Thought Process') && !cleanedText.includes('Let me')) {
        return cleanedText;
      }
    }
  }

  // 检测是否包含思考过程标记
  const hasThinkingProcess =
    text.includes('**My Thought Process') ||
    text.includes('Thought Process') ||
    text.includes('Here\'s how I\'m approaching') ||
    text.includes('Let me') ||
    text.includes('I\'ll') ||
    text.includes('First, I need') ||
    text.includes('I\'m going to') ||
    text.includes('I need to') ||
    text.includes('**Prompt Optimization') ||
    text.includes('Deep Dive') ||
    text.includes('let\'s break this down');

  if (!hasThinkingProcess) {
    // 没有思考过程，直接返回
    return text;
  }

  console.log('[extractFinalPrompt] 检测到思考过程，尝试提取最终结果');

  // 策略0.5（最高优先级）: 查找 "Here it is:" 或类似标记后面的中文内容
  // Gemini 模型经常使用这种格式输出最终结果
  const hereItIsPatterns = [
    /Here it is[:\s]*([一-龥][\s\S]{50,}?)(?:\n\n[A-Z]|$)/i,
    /最终提示词[:\s]*([一-龥][\s\S]{50,}?)(?:\n\n[A-Z]|$)/i,
    /Final prompt[:\s]*([一-龥][\s\S]{50,}?)(?:\n\n[A-Z]|$)/i,
    /输出[:\s]*([一-龥][\s\S]{50,}?)(?:\n\n[A-Z]|$)/i,
  ];

  for (const pattern of hereItIsPatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      const content = match[1].trim();
      // 验证内容主要是中文
      const chineseCharCount = (content.match(/[\u4e00-\u9fa5]/g) || []).length;
      if (chineseCharCount >= 30) {
        console.log('[extractFinalPrompt] 从 "Here it is" 标记后提取, 长度:', content.length);
        return content;
      }
    }
  }

  // 策略0.6: 查找最后一个以中文开头的长段落（在思考过程之后）
  // 这通常是模型输出的最终结果
  const paragraphs = text.split(/\n\n+/);
  for (let i = paragraphs.length - 1; i >= 0; i--) {
    const para = paragraphs[i].trim();
    // 检查是否以中文开头且足够长
    if (/^[\u4e00-\u9fa5]/.test(para)) {
      const chineseCharCount = (para.match(/[\u4e00-\u9fa5]/g) || []).length;
      // 如果这个段落有足够多的中文字符，且不包含思考标记
      if (chineseCharCount >= 50 &&
          !para.includes('Let me') &&
          !para.includes('I\'ll') &&
          !para.includes('Okay') &&
          !para.includes('First')) {
        console.log('[extractFinalPrompt] 从最后一个中文段落提取, 长度:', para.length);
        return para;
      }
    }
  }

  // 策略0.7: 查找英文视觉描述提示词（针对图像/视频生成）
  // 这些提示词通常包含视觉描述术语，且不包含思考过程标记
  const visualDescriptionTerms = [
    'fluffy', 'bright-eyed', 'ginger', 'tabby', 'cat', 'dog', 'animal',
    'scene', 'lighting', 'cinematic', 'dramatic', 'soft', 'warm', 'cool',
    '8K', '4K', 'ultra-high definition', 'high resolution', 'photorealistic',
    'cozy', 'living room', 'bedroom', 'kitchen', 'outdoor', 'indoor',
    'sunlit', 'moonlit', 'golden hour', 'blue hour', 'sunset', 'sunrise',
    'dancing', 'running', 'walking', 'sitting', 'standing', 'flying',
    'vibrant', 'muted', 'pastel', 'saturated', 'desaturated',
    'bokeh', 'depth of field', 'shallow focus', 'wide angle', 'close-up',
    'portrait', 'landscape', 'macro', 'aerial', 'underwater',
  ];

  // 思考过程标记（用于排除）
  const thinkingMarkers = [
    'I\'ve made sure', 'I\'ve adhered', 'I\'ve expanded', 'I\'ve included',
    'I\'ve added', 'I\'ve ensured', 'I\'ve kept', 'I\'ve maintained',
    'Let me', 'I\'ll', 'I need to', 'I\'m going to', 'First,', 'Okay,',
    'Getting better', 'Here\'s how', 'My approach', 'Thought Process',
    'instructions:', 'requirements:', 'following the', 'adhering to',
  ];

  // 从后往前查找包含视觉描述术语的长段落
  for (let i = paragraphs.length - 1; i >= 0; i--) {
    const para = paragraphs[i].trim();
    if (para.length < 100) continue; // 跳过太短的段落

    // 检查是否包含思考标记
    const hasThinkingMarker = thinkingMarkers.some(marker =>
      para.toLowerCase().includes(marker.toLowerCase())
    );
    if (hasThinkingMarker) continue;

    // 计算视觉描述术语的匹配数量
    const visualTermCount = visualDescriptionTerms.filter(term =>
      para.toLowerCase().includes(term.toLowerCase())
    ).length;

    // 如果包含至少3个视觉描述术语，认为是最终提示词
    if (visualTermCount >= 3) {
      console.log('[extractFinalPrompt] 从英文视觉描述段落提取, 长度:', para.length, ', 视觉术语数:', visualTermCount);
      return para;
    }
  }

  // 策略1: 从后往前找，找到第一个双引号 "" 内的长内容
  // 但要排除英文内容，优先找中文内容
  const allQuotedMatches = text.match(/"([^"]{30,})"/g);
  if (allQuotedMatches && allQuotedMatches.length > 0) {
    // 从后往前找，优先找包含中文的引号内容
    for (let i = allQuotedMatches.length - 1; i >= 0; i--) {
      const quoted = allQuotedMatches[i];
      const content = quoted.slice(1, -1);
      const chineseCharCount = (content.match(/[\u4e00-\u9fa5]/g) || []).length;
      // 如果包含足够多的中文字符
      if (chineseCharCount >= 30) {
        console.log('[extractFinalPrompt] 从双引号提取中文内容, 长度:', content.length);
        return content.trim();
      }
    }
    // 如果没有找到中文内容，回退到最后一个引号内容（但要排除明显的思考内容）
    const lastQuoted = allQuotedMatches[allQuotedMatches.length - 1];
    const content = lastQuoted.slice(1, -1);
    // 排除思考过程中的引用内容
    const isThinkingContent =
      content.includes('Getting better') ||
      content.includes('Let me') ||
      content.includes('I\'ll') ||
      content.includes('I\'ve made sure') ||
      content.includes('I\'ve adhered') ||
      content.includes('I\'ve expanded') ||
      content.includes('I\'ve included') ||
      content.includes('instructions:') ||
      content.includes('requirements:') ||
      content.includes('following the') ||
      content.includes('adhering to') ||
      content.startsWith('I\'ve ') ||
      content.startsWith('I need') ||
      content.startsWith('First,') ||
      content.startsWith('Okay,');

    if (content && content.length > 30 && !isThinkingContent) {
      console.log('[extractFinalPrompt] 从最后一个双引号提取（从后往前）, 长度:', content.length);
      return content.trim();
    }

    // 如果最后一个被排除了，尝试从后往前找一个不是思考内容的引号
    for (let i = allQuotedMatches.length - 2; i >= 0; i--) {
      const quoted = allQuotedMatches[i];
      const innerContent = quoted.slice(1, -1);
      const isThinking =
        innerContent.includes('Getting better') ||
        innerContent.includes('Let me') ||
        innerContent.includes('I\'ll') ||
        innerContent.includes('I\'ve made sure') ||
        innerContent.includes('I\'ve adhered') ||
        innerContent.startsWith('I\'ve ') ||
        innerContent.startsWith('I need') ||
        innerContent.startsWith('First,');

      if (innerContent && innerContent.length > 50 && !isThinking) {
        console.log('[extractFinalPrompt] 从倒数第', allQuotedMatches.length - i, '个双引号提取, 长度:', innerContent.length);
        return innerContent.trim();
      }
    }
  }

  // 策略2: 查找中文引号包裹的长内容（""），同样从后往前
  const chineseQuotedMatches = text.match(/"([^"]{30,})"/g);
  if (chineseQuotedMatches && chineseQuotedMatches.length > 0) {
    // 取最后一个
    const lastQuoted = chineseQuotedMatches[chineseQuotedMatches.length - 1];
    const content = lastQuoted.slice(1, -1);
    if (content && content.length > 30) {
      console.log('[extractFinalPrompt] 从最后一个中文引号提取, 长度:', content.length);
      return content.trim();
    }
  }

  // 策略3: 查找最长的连续中文段落（至少包含30个中文字符）
  // 匹配以中文开头，包含中文标点和中文字符的段落
  const chineseBlockRegex = /[\u4e00-\u9fa5][\u4e00-\u9fa5\u3000-\u303f\uff00-\uffef\s，。！？、；：""''（）【】《》\w\d\-\.]+/g;
  const chineseBlocks = text.match(chineseBlockRegex);
  if (chineseBlocks && chineseBlocks.length > 0) {
    // 找到最长的中文段落
    const longestBlock = chineseBlocks
      .filter(block => {
        // 计算中文字符数量
        const chineseCharCount = (block.match(/[\u4e00-\u9fa5]/g) || []).length;
        return chineseCharCount >= 30;
      })
      .sort((a, b) => b.length - a.length)[0];
    if (longestBlock) {
      console.log('[extractFinalPrompt] 从中文段落提取, 长度:', longestBlock.length);
      return longestBlock.trim();
    }
  }

  // 策略4: 如果都没找到，返回原文
  console.log('[extractFinalPrompt] 未找到合适的提取内容，返回原文');
  return text;
}

export async function enhancePrompt(request: EnhancePromptRequest): Promise<EnhancePromptResponse> {
  // 根据 expansion_level 确定增强程度
  const levelGuide = {
    short: '简洁扩展，保持原意，添加少量细节描述，总长度控制在原文的1.5倍以内',
    medium: '适度扩展，丰富场景细节、光影效果、镜头运动等，总长度控制在原文的2-3倍',
    long: '详细扩展，全面描述场景、氛围、色彩、光影、镜头运动、情感表达等，可以较长',
  };

  const expansionGuide = levelGuide[request.expansion_level || 'medium'];
  const durationGuide = request.duration_s
    ? `视频时长为${request.duration_s}秒，请根据时长合理安排内容节奏。`
    : '';

  const DEFAULT_ENHANCE_SYSTEM = [
    '你是一个专业的AI视频/图像生成提示词优化专家。你的任务是将用户的简单描述扩展为更详细、更具表现力的提示词，以便AI能生成更高质量的视频或图像。',
    '',
    '要求：',
    '1. {{EXPANSION_GUIDE}}',
    '2. 保持原始创意和主题不变',
    '3. 添加具体的视觉细节：场景、光线、色彩、氛围、镜头角度等',
    '4. 使用专业的视觉描述术语',
    '5. {{DURATION_GUIDE}}',
    '6. 直接输出增强后的提示词，不要添加任何解释、前缀或思考过程',
    '',
    '重要：只输出最终的增强提示词文本，不要输出你的思考过程、分析步骤或任何其他内容。',
  ].join('\n');

  const { systemPrompt: sysTemplate, userPromptTemplate } = await getPromptTemplate('prompt_enhance', {
    systemPrompt: DEFAULT_ENHANCE_SYSTEM,
    userPromptTemplate: '{{PROMPT}}',
  });

  const { systemPrompt, userPrompt } = renderPromptPair(
    sysTemplate,
    userPromptTemplate,
    {
      EXPANSION_GUIDE: expansionGuide,
      DURATION_GUIDE: durationGuide,
      PROMPT: request.prompt,
    }
  );

  // 首先尝试从功能绑定系统获取 LLM 配置（LLM 模型管理）
  const { resolvePromptEnhanceLlmModel } = await import('./feature-binding');
  const model = await resolvePromptEnhanceLlmModel();

  if (model) {
    // 使用功能绑定的 LLM 配置（来自 LLM 模型管理）
    console.log('[Prompt Enhance] 使用功能绑定 LLM 配置:', {
      prompt: request.prompt?.substring(0, 50),
      expansion_level: request.expansion_level,
      duration_s: request.duration_s,
      model: model.modelName,
      provider: model.provider,
      baseUrl: model.baseUrl?.substring(0, 50),
    });

    try {
      const response = await generateLlmText(model, { systemPrompt, userPrompt });
      const rawPrompt = response.text?.trim();

      // 提取最终的增强提示词（过滤掉思考过程）
      const enhancedPrompt = rawPrompt ? extractFinalPrompt(rawPrompt) : undefined;

      if (!enhancedPrompt) {
        throw new Error('提示词增强失败：未获取到有效响应');
      }

      console.log('[Prompt Enhance] 提示词增强成功 (via Feature Binding), 长度:', enhancedPrompt.length);
      return {
        enhanced_prompt: enhancedPrompt,
        _debug: {
          apiUrl: model.baseUrl,
          model: model.modelName,
        },
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '提示词增强失败';
      console.error('[Prompt Enhance] 功能绑定 LLM 调用错误:', errorMessage);
      throw new Error(errorMessage);
    }
  }

  // 回退到 Gemini API（从系统配置读取）
  const systemConfig = await getSystemConfig();
  const now = Date.now();
  const fallbackModel: LlmModel = {
    id: 'system-gemini',
    name: 'System Gemini',
    provider: 'gemini',
    baseUrl: systemConfig.geminiBaseUrl || 'https://generativelanguage.googleapis.com',
    apiKey: systemConfig.geminiApiKey || '',
    modelName: 'gemini-2.0-flash',
    temperature: 0.7,
    maxTokens: 4096,
    enabled: true,
    createdAt: now,
    updatedAt: now,
  };

  console.log('[Prompt Enhance] 使用 Gemini API (系统配置)');

  try {
    const result = await generateLlmText(fallbackModel, {
      systemPrompt,
      userPrompt,
      maxTokens: 1024,
      temperature: 0.7,
    });

    const rawPrompt = result.text?.trim();

    // 提取最终的增强提示词（过滤掉思考过程）
    const enhancedPrompt = rawPrompt ? extractFinalPrompt(rawPrompt) : undefined;

    if (!enhancedPrompt) {
      throw new Error('提示词增强失败：未获取到有效响应');
    }

    console.log('[Prompt Enhance] 提示词增强成功 (via Gemini API), 长度:', enhancedPrompt.length);
    return {
      enhanced_prompt: enhancedPrompt,
      _debug: {
        apiUrl: fallbackModel.baseUrl,
        model: fallbackModel.modelName,
      },
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '提示词增强失败';
    console.error('[Prompt Enhance] Gemini API 调用错误:', errorMessage);
    throw new Error(errorMessage);
  }
}

// ========================================
// Chat Completions Video Generation
// ========================================

// 构建 Chat Completions 消息
function buildChatCompletionMessages(request: VideoGenerationRequest): ChatCompletionMessage[] {
  // 构建视频生成参数（不包含 prompt 和 input_image，这些放在消息内容中）
  const videoParams: Record<string, unknown> = {};
  if (request.seconds) videoParams.seconds = request.seconds;
  if (request.orientation) videoParams.orientation = request.orientation;
  if (request.size) videoParams.size = request.size;
  if (request.style_id) videoParams.style_id = request.style_id;
  if (request.remix_target_id) videoParams.remix_target_id = request.remix_target_id;

  // 构建用户提示词（包含视频参数）
  const promptText = request.prompt || 'Generate video';
  const paramsStr = Object.keys(videoParams).length > 0
    ? `\n\nVideo parameters: ${JSON.stringify(videoParams)}`
    : '';
  const fullPrompt = promptText + paramsStr;

  // 调试日志
  console.log('[Chat Completions] 构建消息:', {
    prompt: promptText.substring(0, 100),
    hasInputImage: !!request.input_image,
    hasInputImages: !!(request.input_images && request.input_images.length > 0),
    inputImageCount: request.input_images?.length || (request.input_image ? 1 : 0),
    videoParams,
  });

  // 构建用户消息内容
  let userContent: string | ChatCompletionContentPart[];

  if (request.input_images && request.input_images.length > 1) {
    // R2V：多张参考图
    const imageParts: ChatCompletionContentPart[] = request.input_images.map((img, idx) => {
      const mime = request.input_images_mimes?.[idx] || 'image/jpeg';
      const imageUrl = img.startsWith('data:')
        ? img
        : `data:${mime};base64,${img}`;
      return { type: 'image_url', image_url: { url: imageUrl } };
    });
    userContent = [
      { type: 'text', text: fullPrompt },
      ...imageParts,
    ];
    console.log(`[Chat Completions] 使用多模态格式（R2V，${imageParts.length}张图）`);
  } else if (request.input_image) {
    // I2V：单张参考图
    const mime = request.input_image_mime || 'image/jpeg';
    const imageUrl = request.input_image.startsWith('data:')
      ? request.input_image
      : `data:${mime};base64,${request.input_image}`;

    userContent = [
      { type: 'text', text: fullPrompt },
      { type: 'image_url', image_url: { url: imageUrl } },
    ];
    console.log('[Chat Completions] 使用多模态格式（图生视频）');
  } else {
    // T2V：纯文本
    userContent = fullPrompt;
    console.log('[Chat Completions] 使用纯文本格式（文生视频）');
  }

  return [
    {
      role: 'user',
      content: userContent,
    },
  ];
}

// 轮询 Chat Completions 状态
async function pollChatCompletionStatus(
  statusUrl: string,
  apiKey: string,
  onProgress?: (progress: number, status: string) => void
): Promise<ChatCompletionVideoContent> {
  const fetchStatus = async () => {
    const response = await fetchWithRetry(undiciFetch, statusUrl, () => ({
      method: 'GET',
      headers: { Authorization: `Bearer ${apiKey}` },
      dispatcher: soraAgent,
    }));

    const payload = await response.json().catch(() => ({})) as any;

    let parsed: ChatCompletionVideoContent | null = null;
    if (payload?.choices?.[0]?.message?.content) {
      parsed = tryParseChatCompletionVideoContent(payload.choices[0].message.content);
    }
    if (!parsed) {
      parsed = {
        status: payload.status,
        url: payload.video_url || payload.url || payload.output?.url,
        progress: payload.progress,
        error: payload.error?.message || payload.error,
      };
    }

    const progress = typeof parsed.progress === 'number' ? parsed.progress : undefined;
    const statusText = parsed.status || 'processing';
    const resolvedUrl = parsed.video_url || parsed.url;

    if (resolvedUrl) {
      return {
        parsed: { done: true, success: true, progress, statusText },
        raw: { ...parsed, url: resolvedUrl } as ChatCompletionVideoContent,
      };
    }

    if (parsed.status === 'failed' || parsed.status === 'cancelled') {
      return {
        parsed: { done: true, success: false, progress, statusText, error: parsed.error || 'Video generation failed' },
        raw: parsed as ChatCompletionVideoContent,
      };
    }

    return {
      parsed: { done: false, success: false, progress, statusText },
      raw: parsed as ChatCompletionVideoContent,
    };
  };

  try {
    return await pollBackendTask(fetchStatus, { onProgress });
  } catch (err) {
    if (err instanceof Error && err.message === POLL_TIMEOUT_MESSAGE) {
      throw new Error('Video generation timed out');
    }
    throw err;
  }
}

// 通过 Chat Completions 生成视频
export async function generateVideoWithChatCompletions(
  request: VideoGenerationRequest,
  onProgress?: (progress: number, status: string) => void,
  options?: {
    channelId?: string;
    baseUrl?: string;
    apiKey?: string;
    model?: string;
  }
): Promise<VideoGenerationResult> {
  const resolvedConfig = options?.apiKey && options?.baseUrl
    ? { apiKey: options.apiKey, baseUrl: options.baseUrl, channelId: options.channelId }
    : await getSoraConfig({ channelId: options?.channelId, channelTypes: ['openai-compatible'] });

  const { apiKey, baseUrl, channelId } = resolvedConfig;

  if (!apiKey) throw new Error('API key is missing');
  if (!baseUrl) throw new Error('Base URL is missing');

  const model = options?.model || request.model;
  if (!model) throw new Error('Chat model is required');

  const normalizedBaseUrl = baseUrl.replace(/\/$/, '');
  const apiUrl = `${normalizedBaseUrl}/v1/chat/completions`;

  // 构建调试上下文，用于错误信息
  const debugContext = { apiUrl, model, channelId };

  const payload: ChatCompletionRequest = {
    model,
    messages: buildChatCompletionMessages(request),
    temperature: 0.2,
    stream: true,
  };

  console.log('[Sora API] Chat Completions 视频生成请求:', {
    apiUrl,
    model,
    channelId,
    prompt: vLog(request.prompt, 100),
    seconds: request.seconds,
    size: request.size,
    orientation: request.orientation,
    style_id: request.style_id,
    hasInputImage: !!request.input_image,
    hasInputImages: !!(request.input_images && request.input_images.length > 0),
    inputImageCount: request.input_images?.length || (request.input_image ? 1 : 0),
    temperature: payload.temperature,
    stream: payload.stream,
  });

  const response = await fetchWithRetry(undiciFetch, apiUrl, () => ({
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
    dispatcher: soraAgent,
  }));

  // 使用兼容型解析器（SSE 优先，JSON 回退）
  // 对于 SSE 流，使用流式读取以支持实时进度回调
  const contentType = response.headers.get('content-type')?.toLowerCase() ?? '';
  const isSseStream = contentType.includes('text/event-stream');
  let parsedResponse: ParsedChatCompletionResponse;

  if (isSseStream && response.body) {
    const sseResult = await readChatCompletionSseContent(response.body, '', onProgress);
    parsedResponse = {
      content: sseResult.content,
      rawText: sseResult.content,
      rawData: null,
      isSse: true,
      streamId: sseResult.streamId,
      errorMessage: sseResult.errorMessage,
    };
  } else {
    parsedResponse = await parseChatCompletionResponse(response);
  }
  const { content, rawData, rawText } = parsedResponse;

  if (!response.ok) {
    const errorMessage =
      parsedResponse.errorMessage ||
      rawData?.error?.message ||
      rawData?.message ||
      rawText ||
      content ||
      'Request failed';
    // 增强错误信息，包含请求 URL 和模型
    const enhancedError = new Error(`${errorMessage} [请求: ${debugContext.apiUrl}, 模型: ${debugContext.model}]`);
    (enhancedError as any).debugContext = debugContext;
    throw enhancedError;
  }

  // 检查 SSE 流内部的错误（HTTP 200 但流中包含错误）
  if (parsedResponse.errorMessage) {
    const enhancedError = new Error(`${parsedResponse.errorMessage} [请求: ${debugContext.apiUrl}, 模型: ${debugContext.model}]`);
    (enhancedError as any).debugContext = debugContext;
    throw enhancedError;
  }

  console.log('[Sora API] Raw content:', content, '| SSE:', parsedResponse.isSse);
  
  if (!content) {
    const preview = rawText.length > 500 ? rawText.substring(0, 500) + '...' : rawText;
    console.error('[Sora API] Response missing content. Raw response preview:', preview);
    throw new Error(`Response missing content. Raw response preview: ${preview}`);
  }

  // let parsed = tryParseChatCompletionVideoContent(content);
  // if (!parsed) throw new Error('Response missing video payload');
    let parsed = tryParseChatCompletionVideoContent(content);
  if (!parsed) {
    // 改进错误信息，包含响应片段
    const preview = content.length > 100 ? content.substring(0, 100) + '...' : content;
    throw new Error(`Response missing video payload. Content: ${preview}`);
  }
  if (parsed.error) throw new Error(parsed.error);

  if (typeof parsed.progress === 'number' && onProgress) {
    onProgress(parsed.progress, parsed.status || 'processing');
  }

  // 需要轮询
  if (parsed.status_url && !(parsed.video_url || parsed.url)) {
    const polled = await pollChatCompletionStatus(parsed.status_url, apiKey, onProgress);
    parsed = { ...parsed, ...polled };
  }

  const videoUrl = parsed.video_url || parsed.url;
  if (!videoUrl) throw new Error('No video URL returned');

  const normalizedUrl = parseVideoUrl(videoUrl);
  const taskId = parsed.task_id || parsedResponse.streamId || rawData?.id || `video_${Date.now()}`;

  return {
    id: taskId,
    object: 'video',
    created: Date.now(),
    model,
    data: [{ url: normalizedUrl }],
    channelId,
  };
}
