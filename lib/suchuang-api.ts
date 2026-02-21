/* eslint-disable no-console */
import type { VideoGenerationResult } from './sora-api';
import { parseJsonResponse } from './http-json';
import { pollBackendTask, POLL_TIMEOUT_MESSAGE } from './backend-poller';

// ========================================
// 速创(Wuyin) API 类型定义
// ========================================

// 提交请求参数
export interface SuchuangSubmitRequest {
  prompt: string;
  url?: string;           // 参考图 URL
  aspectRatio?: '9:16' | '16:9';
  duration?: '10' | '15';
  size?: 'small';
  remixTargetId?: string; // 续作 PID
}

// 提交响应
export interface SuchuangSubmitResponse {
  code: number;
  msg: string;
  data: {
    id: string;  // 任务 ID (PID)
  };
}

// 查询响应
export interface SuchuangDetailResponse {
  code: number;
  msg: string;
  data: {
    id: string;
    status: 0 | 1 | 2 | 3;  // 0=排队, 1=成功, 2=失败, 3=生成中
    content: string;         // 提示词
    remote_url?: string;     // 视频下载地址
    fail_reason?: string;    // 失败原因
    duration?: number;
    aspectRatio?: string;
    created_at?: string;
    updated_at?: string;
  };
  exec_time?: number;
}

// 角色创建响应
export interface SuchuangCharacterResponse {
  code: number;
  msg: string;
  data: {
    id: string;  // 角色 ID
  };
  exec_time?: number;
}

// ========================================
// 辅助函数
// ========================================

function mapAspectRatio(orientation?: string): '9:16' | '16:9' {
  return orientation === 'landscape' ? '16:9' : '9:16';
}

function mapDuration(seconds?: string): '10' | '15' {
  return seconds?.includes('15') ? '15' : '10';
}

// 安全解析响应
async function safeParseResponse<T>(response: Response, apiName: string): Promise<T> {
  return parseJsonResponse(response, apiName);
}

// ========================================
// API 函数
// ========================================

// 提交视频生成任务
export async function createSuchuangVideoTask(
  request: {
    prompt: string;
    model?: string;
    orientation?: string;
    seconds?: string;
    input_image?: string;
    remixTargetId?: string;
  },
  options: {
    baseUrl: string;
    apiKey: string;
    channelId?: string;
    useNewApi?: boolean;  // 是否使用 sora2-new (高质量版)
  }
): Promise<{ taskId: string; channelId?: string }> {
  const baseUrl = options.baseUrl.replace(/\/+$/, '');
  const endpoint = options.useNewApi ? '/api/sora2-new/submit' : '/api/sora2/submit';
  const apiUrl = `${baseUrl}${endpoint}`;

  // 构建 form-data
  const formData = new URLSearchParams();
  formData.append('prompt', request.prompt);
  formData.append('aspectRatio', mapAspectRatio(request.orientation));
  formData.append('duration', mapDuration(request.seconds));

  if (request.input_image) {
    // 如果有图片，需要先上传获取 URL
    // TODO: 实现图片上传逻辑
    // formData.append('url', imageUrl);
  }

  if (request.remixTargetId) {
    formData.append('remixTargetId', request.remixTargetId);
  }

  console.log('[速创] 请求 URL:', apiUrl);
  console.log('[速创] 请求参数:', Object.fromEntries(formData));

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Authorization': options.apiKey,
      'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8',
    },
    body: formData.toString(),
  });

  const data = await safeParseResponse<SuchuangSubmitResponse>(response, '速创');

  console.log('[速创] 响应:', data);

  if (data.code !== 200) {
    throw new Error(`速创 API 请求失败 (code: ${data.code}): ${data.msg || '未知错误'}`);
  }

  return {
    taskId: data.data.id,
    channelId: options.channelId,
  };
}

// 查询任务状态
export async function getSuchuangTaskStatus(
  taskId: string,
  options: {
    baseUrl: string;
    apiKey: string;
  }
): Promise<SuchuangDetailResponse['data']> {
  const baseUrl = options.baseUrl.replace(/\/+$/, '');
  const apiUrl = `${baseUrl}/api/sora2/detail?id=${encodeURIComponent(taskId)}`;

  const response = await fetch(apiUrl, {
    method: 'GET',
    headers: {
      'Authorization': options.apiKey,
    },
  });

  const data = await safeParseResponse<SuchuangDetailResponse>(response, '速创');

  if (data.code !== 200) {
    throw new Error(data.msg || '查询任务状态失败');
  }

  return data.data;
}

// 轮询等待任务完成
export async function pollSuchuangTaskCompletion(
  taskId: string,
  options: {
    baseUrl: string;
    apiKey: string;
  },
  onProgress?: (progress: number, status: string) => void,
  _maxAttempts = 120,
  _intervalMs = 5000
): Promise<{ url: string; taskId: string }> {
  const statusMap: Record<number, string> = {
    0: 'queued',
    1: 'completed',
    2: 'failed',
    3: 'processing',
  };

  const startTime = Date.now();

  const fetchStatus = async () => {
    const status = await getSuchuangTaskStatus(taskId, options);
    const statusText = statusMap[status.status] || 'unknown';

    let progress = 0;
    if (status.status === 0) progress = 5;
    else if (status.status === 3) {
      const elapsedMin = (Date.now() - startTime) / 60_000;
      progress = Math.min(30 + Math.floor(elapsedMin * 6), 90);
    }
    else if (status.status === 1) progress = 100;

    if (status.status === 1 && status.remote_url) {
      console.log('[速创] 任务完成:', status.remote_url);
      return {
        parsed: { done: true, success: true, progress, statusText },
        raw: { url: status.remote_url, taskId },
      };
    }

    if (status.status === 2) {
      return {
        parsed: { done: true, success: false, progress, statusText, error: status.fail_reason || '视频生成失败' },
        raw: { url: '', taskId },
      };
    }

    return {
      parsed: { done: false, success: false, progress, statusText },
      raw: { url: '', taskId },
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

// 统一生成入口
export async function generateWithSuchuang(
  request: {
    prompt: string;
    model?: string;
    orientation?: string;
    seconds?: string;
    input_image?: string;
    remixTargetId?: string;
  },
  onProgress?: (progress: number, status: string) => void,
  options?: {
    baseUrl?: string;
    apiKey?: string;
    channelId?: string;
    useNewApi?: boolean;
  }
): Promise<VideoGenerationResult> {
  if (!options?.baseUrl || !options?.apiKey) {
    throw new Error('速创 API 配置缺失');
  }

  // 创建任务
  const { taskId } = await createSuchuangVideoTask(request, {
    baseUrl: options.baseUrl,
    apiKey: options.apiKey,
    channelId: options.channelId,
    useNewApi: options.useNewApi,
  });

  // 轮询等待完成
  const result = await pollSuchuangTaskCompletion(
    taskId,
    { baseUrl: options.baseUrl, apiKey: options.apiKey },
    onProgress
  );

  return {
    id: result.taskId,
    object: 'video',
    created: Date.now(),
    model: request.model || 'suchuang-sora2',
    data: [{ url: result.url }],
    channelId: options.channelId,
  };
}

// ========================================
// 角色 API (可选)
// ========================================

export async function createSuchuangCharacter(
  request: {
    pid?: string;      // 视频任务 ID
    url?: string;      // 外部视频 URL
    timestamps?: string; // 角色出现的秒数范围，如 "0,3"
  },
  options: {
    baseUrl: string;
    apiKey: string;
  }
): Promise<string> {
  const baseUrl = options.baseUrl.replace(/\/+$/, '');
  const apiUrl = `${baseUrl}/api/sora2/character`;

  const formData = new URLSearchParams();
  if (request.pid) formData.append('pid', request.pid);
  if (request.url) formData.append('url', request.url);
  if (request.timestamps) formData.append('timestamps', request.timestamps);

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Authorization': options.apiKey,
      'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8',
    },
    body: formData.toString(),
  });

  const data = await safeParseResponse<SuchuangCharacterResponse>(response, '速创');

  if (data.code !== 200) {
    throw new Error(`创建角色失败: ${data.msg}`);
  }

  return data.data.id;
}
