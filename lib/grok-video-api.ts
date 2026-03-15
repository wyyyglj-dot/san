/* eslint-disable no-console */
import { parseJsonText } from './http-json';
import { vLog } from './log-verbose';
import { pollBackendTask, POLL_TIMEOUT_MESSAGE } from './backend-poller';
import { uploadToPublicUrl, detectMimeType } from './upload-service';
import { parseVideoUrl, type VideoGenerationRequest, type VideoGenerationResult } from './sora-api';

export interface GrokVideoRequest {
  model: string;
  prompt: string;
  image?: string | string[];
}

export interface GrokVideoTaskResponse {
  id: string;
  status: 'queued' | 'in_progress' | 'completed' | 'failed' | 'cancelled';
  progress: number;
  video_url: string | null;
  error?: { message: string; code: string };
}

const GROK_CREATE_TIMEOUT_MS = 60_000;
const GROK_STATUS_TIMEOUT_MS = 30_000;

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number,
  timeoutMessage: string,
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(timeoutMessage);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function detectImageMimeType(base64Data: string, fallbackMimeType?: string): string {
  const mimeType = fallbackMimeType || detectMimeType(base64Data);
  return mimeType.startsWith('image/') ? mimeType : 'image/jpeg';
}

async function uploadBase64Image(base64Data: string, fallbackMimeType?: string): Promise<string> {
  const mimeType = detectImageMimeType(base64Data, fallbackMimeType);
  const ext = mimeType.split('/')[1] || 'jpg';
  const filename = `grok-video-input-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  console.log('[grok-video] 上传图片:', { mimeType, filename });

  const result = await uploadToPublicUrl(base64Data, { filename, mimeType });
  console.log(`[grok-video] 图片已上传到 ${result.service}:`, vLog(result.url, 120));
  return result.url;
}

function pickImageInputs(request: VideoGenerationRequest): Array<{ data: string; mimeType?: string }> {
  if (request.input_images?.length) {
    return request.input_images
      .slice(0, 5)
      .map((data, index) => ({ data, mimeType: request.input_images_mimes?.[index] }))
      .filter((item) => typeof item.data === 'string' && item.data.length > 0);
  }

  if (request.input_image) {
    return [{ data: request.input_image, mimeType: request.input_image_mime }];
  }

  return [];
}

function extractTaskError(task: GrokVideoTaskResponse & { error?: GrokVideoTaskResponse['error'] | string | null; message?: string }): string {
  if (typeof task.error === 'string' && task.error.trim()) {
    return task.error.trim();
  }
  if (task.error?.message?.trim()) {
    return task.error.message.trim();
  }
  if (typeof task.message === 'string' && task.message.trim()) {
    return task.message.trim();
  }
  if (task.status === 'cancelled') {
    return '视频生成已取消';
  }
  return '视频生成失败';
}

function mapTaskProgress(status: GrokVideoTaskResponse['status'], progress?: number): number {
  if (typeof progress === 'number' && Number.isFinite(progress)) {
    if (status === 'completed') return 100;
    return Math.max(0, Math.min(99, Math.floor(progress)));
  }

  switch (status) {
    case 'queued':
      return 5;
    case 'in_progress':
      return 50;
    case 'completed':
      return 100;
    default:
      return 0;
  }
}

function extractVideoUrl(task: GrokVideoTaskResponse & { url?: string | null }): string {
  const rawUrl = task.video_url ?? task.url ?? '';
  return parseVideoUrl(rawUrl);
}

async function getGrokVideoTaskStatus(
  taskId: string,
  options: {
    baseUrl: string;
    apiKey: string;
  }
): Promise<GrokVideoTaskResponse & { url?: string | null; message?: string }> {
  const baseUrl = options.baseUrl.replace(/\/+$/, '');
  const apiUrl = `${baseUrl}/v1/videos/${encodeURIComponent(taskId)}`;

  const response = await fetchWithTimeout(apiUrl, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${options.apiKey}`,
    },
  }, GROK_STATUS_TIMEOUT_MS, 'Grok 视频任务查询超时');

  const responseText = await response.text();
  console.log('[grok-video] 任务状态响应:', response.status, vLog(responseText, 1000));

  if (!response.ok) {
    throw new Error(`Grok 视频任务查询失败 (HTTP ${response.status}): ${vLog(responseText, 500)}`);
  }

  return parseJsonText<GrokVideoTaskResponse & { url?: string | null; message?: string }>(responseText, 'Grok 视频');
}

async function pollGrokVideoTaskCompletion(
  taskId: string,
  options: {
    baseUrl: string;
    apiKey: string;
  },
  onProgress?: (progress: number, status: string) => void,
): Promise<GrokVideoTaskResponse & { url?: string | null; message?: string }> {
  const fetchStatus = async () => {
    const task = await getGrokVideoTaskStatus(taskId, options);
    const progress = mapTaskProgress(task.status, task.progress);
    const statusText = task.status;

    if (task.status === 'completed') {
      const videoUrl = extractVideoUrl(task);
      if (!videoUrl) {
        return {
          parsed: { done: true, success: false, progress, statusText, error: 'Grok 视频任务已完成但缺少视频 URL' },
          raw: task,
        };
      }

      return {
        parsed: { done: true, success: true, progress: 100, statusText },
        raw: task,
      };
    }

    if (task.status === 'failed' || task.status === 'cancelled') {
      return {
        parsed: { done: true, success: false, progress, statusText, error: extractTaskError(task) },
        raw: task,
      };
    }

    return {
      parsed: { done: false, success: false, progress, statusText },
      raw: task,
    };
  };

  try {
    return await pollBackendTask(fetchStatus, { onProgress });
  } catch (err) {
    if (err instanceof Error && err.message === POLL_TIMEOUT_MESSAGE) {
      throw new Error('任务超时');
    }
    throw err;
  }
}

export async function generateWithGrokVideo(
  request: VideoGenerationRequest,
  onProgress?: (progress: number, status: string) => void,
  options?: {
    baseUrl: string;
    apiKey: string;
    channelId?: string;
    onVideoIdReady?: (videoId: string, channelId?: string) => void;
  }
): Promise<VideoGenerationResult> {
  if (!options?.baseUrl || !options?.apiKey) {
    throw new Error('Grok 视频 API 配置缺失');
  }

  onProgress?.(5, '准备请求');

  const body: GrokVideoRequest = {
    model: request.model || 'grok-video',
    prompt: request.prompt,
  };

  const imageInputs = pickImageInputs(request);
  if (imageInputs.length > 0) {
    onProgress?.(10, imageInputs.length > 1 ? '上传参考图片' : '上传参考图');
    try {
      const imageUrls = await Promise.all(
        imageInputs.map((image) => uploadBase64Image(image.data, image.mimeType))
      );
      body.image = imageUrls.length === 1 ? imageUrls[0] : imageUrls;
    } catch (error) {
      console.error('[grok-video] 图片上传失败:', error);
      throw new Error('参考图片上传失败，请检查图床配置');
    }
  }

  const baseUrl = options.baseUrl.replace(/\/+$/, '');
  const apiUrl = `${baseUrl}/v1/videos`;

  console.log('[grok-video] 请求 URL:', apiUrl);
  console.log('[grok-video] 请求体:', vLog(JSON.stringify(body), 500));

  onProgress?.(20, '提交生成任务');

  const response = await fetchWithTimeout(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${options.apiKey}`,
    },
    body: JSON.stringify(body),
  }, GROK_CREATE_TIMEOUT_MS, 'Grok 视频任务创建超时');

  const responseText = await response.text();
  console.log('[grok-video] 创建任务响应:', response.status, vLog(responseText, 1000));

  if (!response.ok) {
    throw new Error(`Grok 视频 API 请求失败 (HTTP ${response.status}): ${vLog(responseText, 500)}`);
  }

  const task = parseJsonText<GrokVideoTaskResponse & { url?: string | null; message?: string }>(responseText, 'Grok 视频');
  const taskId = typeof task.id === 'string' ? task.id.trim() : '';

  if (!taskId) {
    throw new Error(`Grok 视频 API 响应缺少任务 ID: ${vLog(responseText, 500)}`);
  }

  options?.onVideoIdReady?.(taskId, options?.channelId);

  if (task.status === 'failed' || task.status === 'cancelled') {
    throw new Error(extractTaskError(task));
  }

  if (task.status === 'completed') {
    const videoUrl = extractVideoUrl(task);
    if (!videoUrl) {
      throw new Error(`Grok 视频任务已完成但缺少视频 URL: ${vLog(responseText, 500)}`);
    }

    return {
      id: taskId,
      object: 'video',
      created: Date.now(),
      model: body.model,
      data: [{ url: videoUrl }],
      channelId: options.channelId,
    };
  }

  const finalTask = await pollGrokVideoTaskCompletion(
    taskId,
    { baseUrl: options.baseUrl, apiKey: options.apiKey },
    onProgress,
  );

  const videoUrl = extractVideoUrl(finalTask);
  if (!videoUrl) {
    throw new Error('Grok 视频任务已完成但缺少视频 URL');
  }

  return {
    id: finalTask.id || taskId,
    object: 'video',
    created: Date.now(),
    model: body.model,
    data: [{ url: videoUrl }],
    channelId: options.channelId,
  };
}
