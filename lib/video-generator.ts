/* eslint-disable no-console */
import { getVideoModelWithChannel } from './db';
import type { GenerateResult, VideoChannel, VideoModel } from '@/types';
import {
  generateVideo as generateSoraVideo,
  generateVideoWithChatCompletions,
  type VideoGenerationRequest,
  type VideoGenerationResult,
} from './sora-api';
import { generateWithKie } from './kie-api';
import { generateWithSuchuang } from './suchuang-api';
import { generateWithJimeng } from './jimeng-api';
import { refreshVerboseFlag, vLog } from './log-verbose';

// ========================================
// 统一视频生成入口
// ========================================

export interface VideoGenerateRequest {
  modelId: string;
  prompt: string;
  aspectRatio?: string;
  duration?: string;
  styleId?: string;
  remixTargetId?: string;
  files?: Array<{ mimeType: string; data: string }>;
  functionMode?: 'first_last_frames' | 'omni_reference';
}

export interface VideoModelContext {
  model: VideoModel;
  channel: VideoChannel;
  effectiveBaseUrl: string;
  effectiveApiKey: string;
}

// 标准化方向参数
function normalizeOrientation(value?: string): 'landscape' | 'portrait' {
  return value === 'portrait' ? 'portrait' : 'landscape';
}

// 标准化时长参数
function normalizeSeconds(value?: string): '10' | '15' | '25' {
  if (value && value.includes('25')) return '25';
  if (value && value.includes('15')) return '15';
  return '10';
}

// 根据方向计算分辨率
function resolveSize(orientation: 'landscape' | 'portrait', hdEnabled?: boolean): string {
  if (hdEnabled) {
    return orientation === 'portrait' ? '1080x1920' : '1920x1080';
  }
  return orientation === 'portrait' ? '720x1280' : '1280x720';
}

// 提取输入图片（支持多图，保留 MIME 类型）
interface InputImage {
  data: string;
  mimeType: string;
}

function pickInputImages(files?: Array<{ mimeType: string; data: string }>): InputImage[] {
  if (!files?.length) return [];
  return files
    .filter((file) => file.mimeType?.startsWith('image/'))
    .map((file) => {
      const match = file.data.match(/^data:([^;]+);base64,(.+)$/);
      if (match) return { data: match[2], mimeType: match[1] };
      return { data: file.data, mimeType: file.mimeType || 'image/jpeg' };
    })
    .filter((img): img is InputImage => typeof img.data === 'string' && img.data.length > 0);
}

// 提取输入视频（支持多视频，保留 MIME 类型）
interface InputVideo {
  data: string;
  mimeType: string;
}

function pickInputVideos(files?: Array<{ mimeType: string; data: string }>): InputVideo[] {
  if (!files?.length) return [];
  return files
    .filter((file) => file.mimeType?.startsWith('video/'))
    .map((file) => {
      const match = file.data.match(/^data:([^;]+);base64,(.+)$/);
      if (match) return { data: match[2], mimeType: match[1] };
      return { data: file.data, mimeType: file.mimeType || 'video/mp4' };
    })
    .filter((v): v is InputVideo => typeof v.data === 'string' && v.data.length > 0);
}

// 统一视频生成入口
export async function generateVideo(
  request: VideoGenerateRequest,
  onProgress?: (progress: number, status: string) => void,
  context?: VideoModelContext,
  options?: { onVideoIdReady?: (videoId: string, channelId?: string) => void }
): Promise<GenerateResult> {
  void refreshVerboseFlag();
  const modelConfig = context ?? await getVideoModelWithChannel(request.modelId);
  if (!modelConfig) {
    throw new Error('Video model not found');
  }

  const { model, channel, effectiveBaseUrl, effectiveApiKey } = modelConfig;

  if (!model.enabled) throw new Error('Video model is disabled');
  if (!channel.enabled) throw new Error('Video channel is disabled');
  if (!effectiveBaseUrl) throw new Error('Base URL is missing');
  if (!effectiveApiKey) throw new Error('API key is missing');

  const orientation = normalizeOrientation(request.aspectRatio ?? model.defaultAspectRatio);
  const seconds = normalizeSeconds(request.duration ?? model.defaultDuration);
  const hdEnabled = Boolean(model.hdEnabled);
  const size = resolveSize(orientation, hdEnabled);

  const videoRequest: VideoGenerationRequest = {
    prompt: request.prompt,
    model: model.apiModel,
    orientation,
    seconds,
    size,
  };

  if (request.styleId) videoRequest.style_id = request.styleId;
  if (request.remixTargetId) videoRequest.remix_target_id = request.remixTargetId;

  const inputImages = pickInputImages(request.files);
  if (inputImages.length === 1) {
    videoRequest.input_image = inputImages[0].data;
    videoRequest.input_image_mime = inputImages[0].mimeType;
  } else if (inputImages.length >= 2) {
    const sliced = inputImages.slice(0, 2);
    videoRequest.input_images = sliced.map(img => img.data);
    videoRequest.input_images_mimes = sliced.map(img => img.mimeType);
    videoRequest.input_image = sliced[0].data;
    videoRequest.input_image_mime = sliced[0].mimeType;
  }

  // 提取视频文件（用于 omni_reference 模式）
  const inputVideos = pickInputVideos(request.files);
  if (inputVideos.length > 0) {
    videoRequest.input_videos = inputVideos.map(v => v.data);
    videoRequest.input_videos_mimes = inputVideos.map(v => v.mimeType);
  }

  // 传递 functionMode（omni_reference 等）
  if (request.functionMode) {
    videoRequest.functionMode = request.functionMode;
  }

  let result: VideoGenerationResult;

  console.log('[VideoGenerator] 视频生成请求:', {
    channelType: channel.type,
    modelId: model.id,
    apiModel: model.apiModel,
    channelId: channel.id,
    prompt: vLog(request.prompt, 100),
    orientation,
    seconds,
    size,
    styleId: request.styleId,
    remixTargetId: request.remixTargetId,
    hasInputImage: !!videoRequest.input_image,
    hasInputImages: !!videoRequest.input_images?.length,
    inputImageCount: inputImages.length,
    inputVideoCount: inputVideos.length,
    functionMode: request.functionMode,
    effectiveBaseUrl,
  });

  switch (channel.type) {
    case 'sora':
      result = await generateSoraVideo(videoRequest, onProgress, {
        channelId: channel.id,
        onVideoIdReady: options?.onVideoIdReady,
      });
      break;
    case 'openai-compatible':
      result = await generateVideoWithChatCompletions(videoRequest, onProgress, {
        baseUrl: effectiveBaseUrl,
        apiKey: effectiveApiKey,
        model: model.apiModel,
        channelId: channel.id,
      });
      break;
    case 'kie-ai':
      result = await generateWithKie(videoRequest, onProgress, {
        baseUrl: effectiveBaseUrl,
        apiKey: effectiveApiKey,
        channelId: channel.id,
        hdEnabled,
      });
      break;
    case 'suchuang':
      result = await generateWithSuchuang(
        {
          ...videoRequest,
          remixTargetId: request.remixTargetId,
        },
        onProgress,
        {
          baseUrl: effectiveBaseUrl,
          apiKey: effectiveApiKey,
          channelId: channel.id,
          useNewApi: model.apiModel?.includes('new'),
        }
      );
      break;
    case 'jimeng':
      result = await generateWithJimeng(videoRequest, onProgress, {
        baseUrl: effectiveBaseUrl,
        apiKey: effectiveApiKey,
        channelId: channel.id,
        hdEnabled,
      });
      break;
    default:
      throw new Error(`Unsupported video channel type: ${channel.type}`);
  }

  const first = result.data?.[0];
  if (!first?.url) {
    throw new Error('Video generation completed without a valid URL');
  }

  return {
    type: 'sora-video',
    url: first.url,
    cost: 0,
    videoId: result.id,
    videoChannelId: result.channelId || channel.id,
    videoChannelType: channel.type,
    permalink: typeof first.permalink === 'string' ? first.permalink : undefined,
    revised_prompt: typeof first.revised_prompt === 'string' ? first.revised_prompt : undefined,
  };
}
