/* eslint-disable no-console */
import type { VideoGenerationResult } from './sora-api';
import { uploadToPublicUrl, detectMimeType } from './upload-service';
import { parseJsonText } from './http-json';
import { fetchWithRetry } from './http-retry';
import { vLog } from './log-verbose';
import { pollBackendTask, POLL_TIMEOUT_MESSAGE } from './backend-poller';
import { generateWebhookToken, storeWebhookToken } from './webhook-token';

// kie.ai API 请求类型
export interface KieVideoRequest {
  model: string;
  callBackUrl?: string;
  progressCallBackUrl?: string;
  input: {
    prompt: string;
    image_urls?: string[];
    aspect_ratio?: 'portrait' | 'landscape';
    n_frames?: '10' | '15';
    size?: 'standard' | 'high';
    remove_watermark?: boolean;
    upload_method?: 's3' | 'oss';
    character_id_list?: string[];
  };
}

// kie.ai API 响应类型
export interface KieTaskResponse {
  code: number;
  msg: string;
  data: {
    taskId: string;
    model?: string;
    state?: 'waiting' | 'queuing' | 'generating' | 'success' | 'fail';
    resultJson?: string;
    failCode?: string;
    failMsg?: string;
    costTime?: number;
    progress?: number;
    createTime?: number;
    completeTime?: number;
  };
}

function buildCallbackUrl(origin: string, taskId: string, token: string): string {
  return `${origin}/api/webhook/kie?taskId=${taskId}&token=${token}`;
}

function mapAspectRatio(value?: string): 'portrait' | 'landscape' {
  return value === 'portrait' ? 'portrait' : 'landscape';
}

function mapDuration(value?: string): '10' | '15' {
  return value?.includes('15') ? '15' : '10';
}

// 检测 base64 图片的 MIME 类型（使用 upload-service 中的函数）
function detectImageMimeType(base64Data: string): string {
  const mimeType = detectMimeType(base64Data);
  return mimeType.startsWith('image/') ? mimeType : 'image/jpeg';
}

export async function createKieVideoTask(
  request: {
    prompt: string;
    model?: string;
    orientation?: string;
    seconds?: string;
    input_image?: string;
  },
  options: {
    baseUrl: string;
    apiKey: string;
    channelId?: string;
    callbackOrigin?: string;
    taskId?: string;
    hdEnabled?: boolean;
  }
): Promise<{ taskId: string; channelId?: string }> {
  const hasImage = Boolean(request.input_image);
  // 模型名跟随渠道配置，不硬编码
  const kieModel = request.model || (hasImage ? 'sora-2-image-to-video' : 'sora-2-text-to-video');

  const kieRequest: KieVideoRequest = {
    model: kieModel,
    input: {
      prompt: request.prompt,
      aspect_ratio: mapAspectRatio(request.orientation),
      n_frames: mapDuration(request.seconds),
      size: options.hdEnabled ? 'high' : 'standard',
      upload_method: 's3',
    },
  };

  if (request.input_image) {
    const mimeType = detectImageMimeType(request.input_image);
    const filename = `kie-input-${Date.now()}.${mimeType.split('/')[1] || 'jpg'}`;
    console.log('[kie.ai] 检测到图片格式:', mimeType);

    try {
      const result = await uploadToPublicUrl(request.input_image, { filename, mimeType });
      console.log(`[kie.ai] 图片已上传到 ${result.service}:`, vLog(result.url, 120));
      kieRequest.input.image_urls = [result.url];
    } catch (error) {
      console.error('[kie.ai] 图片上传失败:', error);
      throw new Error('图片上传失败，请检查图床或文件床配置');
    }
  }

  if (options.callbackOrigin && options.taskId) {
    const token = generateWebhookToken();
    await storeWebhookToken(options.taskId, token);
    kieRequest.callBackUrl = buildCallbackUrl(options.callbackOrigin, options.taskId, token);
  }

  // 构建正确的 API 端点 URL
  const baseUrl = options.baseUrl.replace(/\/+$/, ''); // 移除末尾斜杠
  const apiUrl = `${baseUrl}/api/v1/jobs/createTask`;

  console.log('[kie.ai] 请求 URL:', apiUrl);
  console.log('[kie.ai] 请求体:', vLog(JSON.stringify(kieRequest), 500));

  const response = await fetchWithRetry(fetch, apiUrl, () => ({
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${options.apiKey}`,
    },
    body: JSON.stringify(kieRequest),
  }));

  const responseText = await response.text();
  console.log('[kie.ai] 响应状态:', response.status);
  console.log('[kie.ai] 响应内容:', vLog(responseText, 500));

  const data = parseJsonText<KieTaskResponse>(responseText, 'kie.ai');

  if (data.code !== 200) {
    throw new Error(`kie.ai API 请求失败 (code: ${data.code}): ${data.msg || '未知错误'}`);
  }

  return {
    taskId: data.data.taskId,
    channelId: options.channelId,
  };
}

export async function getKieTaskStatus(
  taskId: string,
  options: {
    baseUrl: string;
    apiKey: string;
  }
): Promise<KieTaskResponse['data']> {
  // 构建正确的 API 端点 URL
  const baseUrl = options.baseUrl.replace(/\/+$/, ''); // 移除末尾斜杠
  const apiUrl = `${baseUrl}/api/v1/jobs/recordInfo?taskId=${encodeURIComponent(taskId)}`;

  const response = await fetchWithRetry(fetch, apiUrl, () => ({
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${options.apiKey}`,
    },
  }));

  // 安全解析响应
  const responseText = await response.text();
  console.log('[kie.ai] 任务状态查询完整响应:', vLog(responseText, 2000));
  const data = parseJsonText<KieTaskResponse>(responseText, 'kie.ai');

  if (data.code !== 200) {
    throw new Error(data.msg || '查询任务状态失败');
  }

  return data.data;
}

export async function pollKieTaskCompletion(
  taskId: string,
  options: {
    baseUrl: string;
    apiKey: string;
  },
  onProgress?: (progress: number, status: string) => void,
  _maxAttempts = 120,
  _intervalMs = 5000
): Promise<{ url: string; taskId: string }> {
  const fetchStatus = async () => {
    const status = await getKieTaskStatus(taskId, options);
    const progress = typeof status.progress === 'number' ? status.progress : undefined;
    const statusText = status.state || 'processing';

    if (status.state === 'success' && status.resultJson) {
      const result = JSON.parse(status.resultJson);
      const url = result.resultUrls?.[0];
      if (url) {
        return {
          parsed: { done: true, success: true, progress, statusText },
          raw: { url, taskId },
        };
      }
    }

    if (status.state === 'fail') {
      return {
        parsed: { done: true, success: false, progress, statusText, error: status.failMsg || '视频生成失败' },
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

export async function generateWithKie(
  request: {
    prompt: string;
    model?: string;
    orientation?: string;
    seconds?: string;
    input_image?: string;
  },
  onProgress?: (progress: number, status: string) => void,
  options?: {
    baseUrl?: string;
    apiKey?: string;
    channelId?: string;
    callbackOrigin?: string;
    taskId?: string;
    hdEnabled?: boolean;
  }
): Promise<VideoGenerationResult> {
  if (!options?.baseUrl || !options?.apiKey) {
    throw new Error('kie.ai API 配置缺失');
  }

  const { taskId } = await createKieVideoTask(request, {
    baseUrl: options.baseUrl,
    apiKey: options.apiKey,
    channelId: options.channelId,
    callbackOrigin: options.callbackOrigin,
    taskId: options.taskId,
    hdEnabled: options.hdEnabled,
  });

  if (!options.callbackOrigin) {
    const result = await pollKieTaskCompletion(
      taskId,
      { baseUrl: options.baseUrl, apiKey: options.apiKey },
      onProgress
    );

    return {
      id: result.taskId,
      object: 'video',
      created: Date.now(),
      model: request.model || 'kie-ai',
      data: [{ url: result.url }],
      channelId: options.channelId,
    };
  }

  return {
    id: taskId,
    object: 'video',
    created: Date.now(),
    model: request.model || 'kie-ai',
    data: [],
    channelId: options.channelId,
  };
}

// ========================================
// KIE.AI Character Creation API
// ========================================

export interface KieCharacterRequest {
  model: 'sora-2-characters-pro';
  callBackUrl?: string;
  input: {
    origin_task_id: string;
    timestamps: string;
    character_prompt: string;
    character_user_name?: string;
    safety_instruction?: string;
  };
}

export async function createKieCharacterTask(
  request: {
    originTaskId: string;
    timestamps: string;
    characterPrompt: string;
    characterUserName?: string;
  },
  options: {
    baseUrl: string;
    apiKey: string;
  }
): Promise<{ taskId: string }> {
  const kieRequest: KieCharacterRequest = {
    model: 'sora-2-characters-pro',
    input: {
      origin_task_id: request.originTaskId,
      timestamps: request.timestamps,
      character_prompt: request.characterPrompt,
    },
  };

  if (request.characterUserName) {
    kieRequest.input.character_user_name = request.characterUserName;
  }

  const baseUrl = options.baseUrl.replace(/\/+$/, '');
  const apiUrl = `${baseUrl}/api/v1/jobs/createTask`;

  console.log('[kie.ai] 角色创建请求 URL:', apiUrl);
  console.log('[kie.ai] 角色创建请求体:', vLog(JSON.stringify(kieRequest), 500));

  const response = await fetchWithRetry(fetch, apiUrl, () => ({
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${options.apiKey}`,
    },
    body: JSON.stringify(kieRequest),
  }));

  const responseText = await response.text();
  console.log('[kie.ai] 角色创建响应状态:', response.status);
  console.log('[kie.ai] 角色创建响应内容:', vLog(responseText, 500));

  const data = parseJsonText<KieTaskResponse>(responseText, 'kie.ai');

  if (data.code !== 200) {
    throw new Error(`kie.ai 角色创建失败 (code: ${data.code}): ${data.msg || '未知错误'}`);
  }

  return { taskId: data.data.taskId };
}

export async function pollKieCharacterCompletion(
  taskId: string,
  options: {
    baseUrl: string;
    apiKey: string;
  },
  maxAttempts = 55,
  intervalMs = 5000
): Promise<{ characterId: string; characterUserName?: string }> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const status = await getKieTaskStatus(taskId, options);

    if (status.state === 'success' && status.resultJson) {
      console.log('[kie.ai] 角色创建完整 status 对象:', JSON.stringify(status));
      const result = JSON.parse(status.resultJson);
      console.log('[kie.ai] 角色创建 resultJson 解析结果:', JSON.stringify(result));
      // KIE.AI 返回 resultObject 嵌套结构，也兼容顶层字段
      const obj = result.resultObject || result;
      const characterId = obj.character_id || obj.characterId || obj.id;
      const characterUserName = obj.character_user_name || obj.characterUserName;
      if (characterId) {
        console.log('[kie.ai] 角色创建完成, character_id:', characterId, 'character_user_name:', characterUserName);
        return { characterId, characterUserName };
      }
      throw new Error(`角色创建完成但未返回 character_id, resultJson: ${status.resultJson}`);
    }

    if (status.state === 'fail') {
      throw new Error(status.failMsg || '角色创建失败');
    }

    await new Promise(resolve => setTimeout(resolve, intervalMs));
  }

  throw new Error('角色创建超时');
}
