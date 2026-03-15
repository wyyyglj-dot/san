/**
 * 统一图像生成器
 * 根据渠道类型动态选择请求方式
 */

import { getImageModelWithChannel, getSystemConfig } from './db';
import { uploadToPicUI } from './picui';
import { fetchWithRetry } from './http-retry';
import type { ChannelType, ApiEndpointType, GenerateResult } from '@/types';

export interface ImageGenerateRequest {
  modelId: string;
  prompt: string;
  aspectRatio?: string;
  imageSize?: string;
  images?: Array<{ mimeType: string; data: string }>;
}

// Key 轮询索引
const keyIndexMap = new Map<string, number>();

function getNextApiKey(keys: string, channelId: string): string {
  const keyList = keys.split(',').map(k => k.trim()).filter(k => k);
  if (keyList.length === 0) {
    throw new Error('API Key 未配置');
  }
  const currentIndex = keyIndexMap.get(channelId) || 0;
  const key = keyList[currentIndex % keyList.length];
  keyIndexMap.set(channelId, currentIndex + 1);
  return key;
}

// 下载图片并转换为 base64
async function downloadImageAsBase64(imageUrl: string): Promise<string> {
  const response = await fetchWithRetry(fetch, imageUrl);
  if (!response.ok) {
    throw new Error(`下载图片失败 (${response.status})`);
  }
  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const base64 = buffer.toString('base64');
  const contentType = response.headers.get('content-type') || 'image/jpeg';
  return `data:${contentType};base64,${base64}`;
}

// 上传图片到图床获取 URL
async function uploadImageForApi(
  imageData: string,
  index: number
): Promise<string> {
  const config = await getSystemConfig();
  if (!config.picuiApiKey) {
    throw new Error('参考图需要配置 PicUI 图床');
  }
  const filename = `input_${Date.now()}_${index}.jpg`;
  const url = await uploadToPicUI(imageData, filename);
  if (!url) {
    throw new Error('参考图上传失败');
  }
  return url;
}

// ========================================
// OpenAI Compatible API
// ========================================

async function generateWithOpenAI(
  request: ImageGenerateRequest,
  baseUrl: string,
  apiKey: string,
  apiModel: string,
  channelId: string
): Promise<GenerateResult> {
  const key = getNextApiKey(apiKey, channelId);
  const url = `${baseUrl.replace(/\/$/, '')}/v1/images/generations`;

  console.log('[OpenAI] 开始生成图片:', { url, model: apiModel });

  const payload: Record<string, unknown> = {
    model: apiModel,
    prompt: request.prompt,
    n: 1,
    response_format: 'b64_json',
  };

  // 添加尺寸参数
  if (request.aspectRatio) {
    // 尝试从 model config 获取对应分辨率，这里简化处理
    const sizeMap: Record<string, string> = {
      '1:1': '1024x1024',
      '16:9': '1792x1024',
      '9:16': '1024x1792',
      '3:2': '1536x1024',
      '2:3': '1024x1536',
      '3:4': '768x1024',
      '4:3': '1024x768',
    };
    payload.size = sizeMap[request.aspectRatio] || '1024x1024';
  }

  const response = await fetchWithRetry(fetch, url, () => ({
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  }));

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[OpenAI] API 错误响应:', { status: response.status, body: errorText.slice(0, 500) });
    throw new Error(`OpenAI API 错误 (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  console.log('[OpenAI] API 响应成功，解析数据...');
  const imageData = data.data?.[0];

  if (!imageData?.b64_json && !imageData?.url) {
    throw new Error('API 返回成功但未包含图片');
  }

  const resultUrl = imageData.b64_json
    ? `data:image/png;base64,${imageData.b64_json}`
    : imageData.url;

  return {
    type: 'gemini-image', // 统一类型
    url: resultUrl,
    cost: 0, // 由调用方设置
  };
}

// ========================================
// OpenAI Compatible API (Chat Format)
// 用于支持 /v1/chat/completions 端点的图像生成模型
// ========================================

async function generateWithOpenAIChat(
  request: ImageGenerateRequest,
  baseUrl: string,
  apiKey: string,
  apiModel: string,
  channelId: string
): Promise<GenerateResult> {
  const key = getNextApiKey(apiKey, channelId);
  const url = `${baseUrl.replace(/\/$/, '')}/v1/chat/completions`;

  console.log('[OpenAI-Chat] 开始生成图片:', { url, model: apiModel });

  const messages: Array<Record<string, unknown>> = [
    {
      role: 'user',
      content: request.prompt,
    },
  ];

  const payload: Record<string, unknown> = {
    model: apiModel,
    messages,
    stream: false,
  };

  const response = await fetchWithRetry(fetch, url, () => ({
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  }));

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[OpenAI-Chat] API 错误响应:', { status: response.status, body: errorText.slice(0, 500) });
    throw new Error(`OpenAI Chat API 错误 (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  console.log('[OpenAI-Chat] API 响应成功，解析数据...');

  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error('API 返回成功但未包含内容');
  }

  // 尝试从响应中提取图片
  // 1. 检查是否有 base64 图片数据（某些模型在 content 中直接返回 multimodal 内容）
  if (Array.isArray(content)) {
    for (const part of content) {
      if (part.type === 'image_url' && part.image_url?.url) {
        return { type: 'gemini-image', url: part.image_url.url, cost: 0 };
      }
    }
  }

  // 2. 检查字符串内容中的图片
  if (typeof content === 'string') {
    // 尝试从 Markdown 图片格式提取 URL: ![...](url)
    const markdownMatch = content.match(/!\[.*?\]\((https?:\/\/[^)]+)\)/);
    if (markdownMatch) {
      return { type: 'gemini-image', url: markdownMatch[1], cost: 0 };
    }

    // 尝试提取 base64 图片: data:image/...;base64,...
    const base64Match = content.match(/(data:image\/[^;]+;base64,[A-Za-z0-9+/=]+)/);
    if (base64Match) {
      return { type: 'gemini-image', url: base64Match[1], cost: 0 };
    }

    // 尝试提取纯 URL
    const urlMatch = content.match(/(https?:\/\/[^\s"'<>]+\.(?:jpg|jpeg|png|gif|webp|bmp)(?:\?[^\s"'<>]*)?)/i);
    if (urlMatch) {
      return { type: 'gemini-image', url: urlMatch[1], cost: 0 };
    }
  }

  // 3. 检查 data.data 字段（某些兼容 API 会在 chat 响应中附带 data 字段）
  if (data.data?.[0]?.b64_json) {
    return {
      type: 'gemini-image',
      url: `data:image/png;base64,${data.data[0].b64_json}`,
      cost: 0,
    };
  }
  if (data.data?.[0]?.url) {
    return { type: 'gemini-image', url: data.data[0].url, cost: 0 };
  }

  throw new Error('Chat API 返回成功但未能从响应中提取图片');
}

// ========================================
// Gemini Native API
// ========================================

async function generateWithGemini(
  request: ImageGenerateRequest,
  baseUrl: string,
  apiKey: string,
  apiModel: string,
  channelId: string
): Promise<GenerateResult> {
  const key = getNextApiKey(apiKey, channelId);
  const url = `${baseUrl.replace(/\/$/, '')}/v1beta/models/${apiModel}:generateContent?key=${key}`;

  const parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }> = [];

  // 添加参考图
  if (request.images && request.images.length > 0) {
    for (const img of request.images) {
      parts.push({
        inlineData: {
          mimeType: img.mimeType || 'image/jpeg',
          data: img.data.replace(/^data:[^;]+;base64,/, ''),
        },
      });
    }
  }

  // 添加提示词
  if (request.prompt) {
    parts.push({ text: request.prompt });
  }

  const generationConfig: Record<string, unknown> = {
    imageConfig: {
      aspectRatio: request.aspectRatio || '1:1',
    },
  };

  if (request.imageSize) {
    (generationConfig.imageConfig as Record<string, unknown>).imageSize = request.imageSize;
  }

  const response = await fetchWithRetry(fetch, url, () => ({
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts }],
      generationConfig,
    }),
  }));

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API 错误 (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  const generatedImages: string[] = [];

  if (data.candidates?.[0]?.content?.parts) {
    for (const part of data.candidates[0].content.parts) {
      if (part.inlineData?.data) {
        const mime = part.inlineData.mimeType || 'image/png';
        generatedImages.push(`data:${mime};base64,${part.inlineData.data}`);
      }
    }
  }

  if (generatedImages.length === 0) {
    const textPart = data.candidates?.[0]?.content?.parts?.find((p: { text?: string }) => p.text);
    if (textPart?.text) {
      // 检测是否为图片 URL（某些 Gemini 配置会返回 URL 而非 base64）
      const text = textPart.text.trim();

      // 尝试从 Markdown 图片格式提取 URL: ![...](url)
      const markdownMatch = text.match(/!\[.*?\]\((https?:\/\/[^)]+)\)/);
      if (markdownMatch) {
        return {
          type: 'gemini-image',
          url: markdownMatch[1],
          cost: 0,
        };
      }

      // 检测纯 URL 格式
      if (/^https?:\/\/.+\.(jpg|jpeg|png|gif|webp|bmp)/i.test(text) || /^https?:\/\/.*\/(image|img|picture|photo)\//i.test(text)) {
        return {
          type: 'gemini-image',
          url: text,
          cost: 0,
        };
      }
      throw new Error(`生成失败: ${textPart.text}`);
    }
    throw new Error('API 返回成功但未包含图片');
  }

  return {
    type: 'gemini-image',
    url: generatedImages[0],
    cost: 0,
  };
}

// ========================================
// ModelScope API
// ========================================

const MODELSCOPE_ASYNC_MODELS = new Set([
  'Qwen/Qwen-Image-Edit-2509',
  'Qwen/Qwen-Image',
  'black-forest-labs/FLUX.2-dev',
]);

async function pollModelScopeTask(baseUrl: string, apiKey: string, taskId: string): Promise<string> {
  const maxAttempts = 60;
  const interval = 5000;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const response = await fetchWithRetry(fetch, `${baseUrl}v1/tasks/${taskId}`, () => ({
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'X-ModelScope-Task-Type': 'image_generation',
      },
    }));

    if (!response.ok) {
      throw new Error(`ModelScope 任务查询失败 (${response.status})`);
    }

    const data = await response.json();

    if (data.task_status === 'SUCCEED') {
      const outputUrl = data.output_images?.[0];
      if (!outputUrl) throw new Error('任务完成但未返回图片');
      return outputUrl;
    }

    if (data.task_status === 'FAILED') {
      throw new Error(data.message || '任务失败');
    }

    await new Promise(resolve => setTimeout(resolve, interval));
  }

  throw new Error('任务超时');
}

async function generateWithModelScope(
  request: ImageGenerateRequest,
  baseUrl: string,
  apiKey: string,
  apiModel: string,
  channelId: string,
  size?: string
): Promise<GenerateResult> {
  const key = getNextApiKey(apiKey, channelId);
  const normalizedBaseUrl = baseUrl.replace(/\/$/, '') + '/';
  const url = `${normalizedBaseUrl}v1/images/generations`;
  const useAsync = MODELSCOPE_ASYNC_MODELS.has(apiModel);

  // 上传参考图获取 URL
  const imageUrls: string[] = [];
  if (request.images && request.images.length > 0) {
    for (let i = 0; i < request.images.length; i++) {
      const img = request.images[i];
      const imgUrl = await uploadImageForApi(img.data, i);
      imageUrls.push(imgUrl);
    }
  }

  const payload: Record<string, unknown> = {
    model: apiModel,
    prompt: request.prompt,
    ...(size && { size }),
    ...(imageUrls.length > 0 && { image_url: imageUrls }),
  };

  const response = await fetchWithRetry(fetch, url, () => ({
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json',
      ...(useAsync ? { 'X-ModelScope-Async-Mode': 'true' } : {}),
    },
    body: JSON.stringify(payload),
  }));

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`ModelScope API 错误 (${response.status}): ${errorText}`);
  }

  if (useAsync) {
    const data = await response.json();
    if (!data.task_id) throw new Error('未返回任务 ID');
    const imageUrl = await pollModelScopeTask(normalizedBaseUrl, key, data.task_id);
    const base64Image = await downloadImageAsBase64(imageUrl);
    return { type: 'zimage-image', url: base64Image, cost: 0 };
  }

  const data = await response.json();
  if (!data.images?.[0]?.url) {
    throw new Error('API 返回成功但未包含图片');
  }

  const base64Image = await downloadImageAsBase64(data.images[0].url);
  return { type: 'zimage-image', url: base64Image, cost: 0 };
}

// ========================================
// Gitee AI API
// ========================================

function parseDataUrl(dataUrl: string): { mimeType: string; data: string } | null {
  if (!dataUrl.startsWith('data:')) return null;

  const endOfPrefix = dataUrl.indexOf(';base64,');
  if (endOfPrefix === -1) return null;

  const mimeType = dataUrl.slice(5, endOfPrefix);
  const data = dataUrl.slice(endOfPrefix + 8);

  return { mimeType, data };
}

async function generateWithGitee(
  request: ImageGenerateRequest,
  baseUrl: string,
  apiKey: string,
  apiModel: string,
  channelId: string,
  size?: string
): Promise<GenerateResult> {
  const key = getNextApiKey(apiKey, channelId);
  const normalizedBaseUrl = baseUrl.replace(/\/$/, '') + '/';

  // 特殊模型处理
  if (apiModel === 'SeedVR2-3B') {
    return generateWithGiteeUpscale(request, normalizedBaseUrl, key, apiModel);
  }
  if (apiModel === 'RMBG-2.0') {
    return generateWithGiteeMatting(request, normalizedBaseUrl, key, apiModel);
  }

  const url = `${normalizedBaseUrl}v1/images/generations`;
  const payload = {
    prompt: request.prompt,
    model: apiModel,
    ...(size && { size }),
  };

  const response = await fetchWithRetry(fetch, url, () => ({
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  }));

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gitee API 错误 (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  if (!data.data?.[0]?.b64_json) {
    throw new Error('API 返回成功但未包含图片');
  }

  const imageData = data.data[0];
  const mimeType = imageData.type || 'image/png';
  return {
    type: 'gitee-image',
    url: `data:${mimeType};base64,${imageData.b64_json}`,
    cost: 0,
  };
}

async function generateWithGiteeUpscale(
  request: ImageGenerateRequest,
  baseUrl: string,
  apiKey: string,
  apiModel: string
): Promise<GenerateResult> {
  const url = `${baseUrl}v1/images/upscaling`;
  const input = request.images?.[0];
  if (!input?.data) throw new Error('缺少参考图');

  const buildFormData = () => {
    const formData = new FormData();
    formData.append('model', apiModel);
    formData.append('outscale', '1');
    formData.append('output_format', 'jpg');

    if (input.data.startsWith('http')) {
      formData.append('image_url', input.data);
    } else {
      const parsed = parseDataUrl(input.data);
      const mimeType = parsed?.mimeType || input.mimeType || 'application/octet-stream';
      const base64Data = parsed?.data || input.data;
      const buffer = Buffer.from(base64Data, 'base64');
      const blob = new Blob([buffer], { type: mimeType });
      formData.append('image', blob, 'input.jpg');
    }

    return formData;
  };

  const response = await fetchWithRetry(fetch, url, () => ({
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}` },
    body: buildFormData(),
  }));

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gitee API 错误 (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  const imageData = data.data?.[0];
  if (!imageData?.url && !imageData?.b64_json) {
    throw new Error('API 返回成功但未包含图片');
  }

  const resultUrl = imageData.url || `data:${imageData.type || 'image/jpeg'};base64,${imageData.b64_json}`;
  return { type: 'gitee-image', url: resultUrl, cost: 0 };
}

async function generateWithGiteeMatting(
  request: ImageGenerateRequest,
  baseUrl: string,
  apiKey: string,
  apiModel: string
): Promise<GenerateResult> {
  const url = `${baseUrl}v1/images/mattings`;
  const input = request.images?.[0];
  if (!input?.data) throw new Error('缺少参考图');

  const buildFormData = () => {
    const formData = new FormData();
    formData.append('model', apiModel);

    if (input.data.startsWith('http')) {
      formData.append('image_url', input.data);
    } else {
      const parsed = parseDataUrl(input.data);
      const mimeType = parsed?.mimeType || input.mimeType || 'application/octet-stream';
      const base64Data = parsed?.data || input.data;
      const buffer = Buffer.from(base64Data, 'base64');
      const blob = new Blob([buffer], { type: mimeType });
      formData.append('image', blob, 'input.webp');
    }

    return formData;
  };

  const response = await fetchWithRetry(fetch, url, () => ({
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'X-Failover-Enabled': 'true',
    },
    body: buildFormData(),
  }));

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gitee API 错误 (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  const imageData = data.data?.[0];
  if (!imageData?.url && !imageData?.b64_json) {
    throw new Error('API 返回成功但未包含图片');
  }

  const resultUrl = imageData.url || `data:${imageData.type || 'image/png'};base64,${imageData.b64_json}`;
  return { type: 'gitee-image', url: resultUrl, cost: 0 };
}

// ========================================
// Sora API
// ========================================

async function generateWithSora(
  request: ImageGenerateRequest,
  baseUrl: string,
  apiKey: string,
  apiModel: string,
  channelId: string
): Promise<GenerateResult> {
  const key = getNextApiKey(apiKey, channelId);
  const normalizedBaseUrl = baseUrl.replace(/\/$/, '');
  const url = `${normalizedBaseUrl}/v1/images/generations`;

  // 根据 aspectRatio 选择模型和尺寸
  let model = apiModel || 'sora-image';
  let size = '1024x1024';

  if (request.aspectRatio) {
    switch (request.aspectRatio) {
      case '16:9':
        model = 'sora-image-landscape';
        size = '1792x1024';
        break;
      case '9:16':
        model = 'sora-image-portrait';
        size = '1024x1792';
        break;
      case '1:1':
      default:
        model = 'sora-image';
        size = '1024x1024';
        break;
    }
  }

  const payload: Record<string, unknown> = {
    prompt: request.prompt,
    model,
    size,
    n: 1,
    response_format: 'url',
  };

  // 添加参考图（垫图）- 使用 input_image 参数传递 base64
  if (request.images && request.images.length > 0) {
    const img = request.images[0];
    // API 支持带 data:image/...;base64, 前缀的格式
    payload.input_image = img.data;
  }

  const response = await fetchWithRetry(fetch, url, () => ({
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  }));

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Sora API 错误 (${response.status}): ${errorText}`);
  }

  const data = await response.json();

  // OpenAI 格式响应: { data: [{ url: '...' }] }
  const imageData = data.data?.[0];
  if (!imageData?.url && !imageData?.b64_json) {
    throw new Error('API 返回成功但未包含图片');
  }

  const resultUrl = imageData.url || `data:image/png;base64,${imageData.b64_json}`;
  return {
    type: 'sora-image',
    url: resultUrl,
    cost: 0,
  };
}

// ========================================
// 统一入口
// ========================================

export async function generateImage(request: ImageGenerateRequest): Promise<GenerateResult> {
  console.log('[ImageGenerator] 开始生成图片:', { modelId: request.modelId, prompt: request.prompt?.slice(0, 50) });

  const modelConfig = await getImageModelWithChannel(request.modelId);
  if (!modelConfig) {
    throw new Error('模型不存在或未配置');
  }

  const { model, channel, effectiveBaseUrl, effectiveApiKey } = modelConfig;
  console.log('[ImageGenerator] 渠道配置:', { channelType: channel.type, baseUrl: effectiveBaseUrl });

  if (!model.enabled) {
    throw new Error('模型已禁用');
  }
  if (!channel.enabled) {
    throw new Error('渠道已禁用');
  }
  if (!effectiveBaseUrl) {
    throw new Error('未配置 Base URL');
  }
  if (!effectiveApiKey) {
    throw new Error('未配置 API Key');
  }

  // 计算分辨率
  let size: string | undefined;
  if (request.aspectRatio && model.resolutions) {
    if (request.imageSize && typeof model.resolutions[request.imageSize] === 'object') {
      size = (model.resolutions[request.imageSize] as Record<string, string>)[request.aspectRatio];
    } else if (typeof model.resolutions[request.aspectRatio] === 'string') {
      size = model.resolutions[request.aspectRatio] as string;
    }
  }

  let result: GenerateResult;

  switch (channel.type) {
    case 'openai-compatible':
      if (model.apiEndpoint === 'chat') {
        result = await generateWithOpenAIChat(
          request,
          effectiveBaseUrl,
          effectiveApiKey,
          model.apiModel,
          channel.id
        );
      } else {
        result = await generateWithOpenAI(
          request,
          effectiveBaseUrl,
          effectiveApiKey,
          model.apiModel,
          channel.id
        );
      }
      break;

    case 'gemini':
      result = await generateWithGemini(
        request,
        effectiveBaseUrl,
        effectiveApiKey,
        model.apiModel,
        channel.id
      );
      break;

    case 'modelscope':
      result = await generateWithModelScope(
        request,
        effectiveBaseUrl,
        effectiveApiKey,
        model.apiModel,
        channel.id,
        size
      );
      break;

    case 'gitee':
      result = await generateWithGitee(
        request,
        effectiveBaseUrl,
        effectiveApiKey,
        model.apiModel,
        channel.id,
        size
      );
      break;

    case 'sora':
      result = await generateWithSora(
        request,
        effectiveBaseUrl,
        effectiveApiKey,
        model.apiModel,
        channel.id
      );
      break;

    default:
      throw new Error(`不支持的渠道类型: ${channel.type}`);
  }

  // 设置实际成本
  result.cost = model.costPerGeneration;

  return result;
}
