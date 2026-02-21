/* eslint-disable no-console */
import type { VideoGenerationResult } from './sora-api';
import { uploadToPublicUrl, detectMimeType } from './upload-service';
import { parseJsonText } from './http-json';
import { vLog } from './log-verbose';

// ========================================
// 即梦 (Jimeng) API — jimeng-api 开源项目
// 同步 API：提交后直接返回结果（内部自行轮询）
// ========================================

export interface JimengVideoRequest {
  model: string;
  prompt: string;
  ratio?: string;
  resolution?: string;
  duration?: number;
  file_paths?: string[];
  functionMode?: string;
  // omni_reference 命名字段
  [key: string]: string | number | string[] | undefined;
}

export interface JimengVideoResponse {
  created: number;
  data: Array<{ url: string }>;
}

// ========================================
// 辅助函数
// ========================================

function mapAspectRatio(orientation?: string): string {
  return orientation === 'portrait' ? '9:16' : '16:9';
}

function detectImageMimeType(base64Data: string): string {
  const mimeType = detectMimeType(base64Data);
  return mimeType.startsWith('image/') ? mimeType : 'image/jpeg';
}

async function uploadBase64Image(base64Data: string): Promise<string> {
  const mimeType = detectImageMimeType(base64Data);
  const ext = mimeType.split('/')[1] || 'jpg';
  const filename = `jimeng-input-${Date.now()}.${ext}`;
  console.log('[jimeng] 上传图片:', { mimeType, filename });

  const result = await uploadToPublicUrl(base64Data, { filename, mimeType });
  console.log(`[jimeng] 图片已上传到 ${result.service}:`, vLog(result.url, 120));
  return result.url;
}

async function uploadBase64Video(base64Data: string): Promise<string> {
  const mimeType = detectMimeType(base64Data);
  const videoMime = mimeType.startsWith('video/') ? mimeType : 'video/mp4';
  const ext = videoMime.split('/')[1] || 'mp4';
  const filename = `jimeng-video-${Date.now()}.${ext}`;
  console.log('[jimeng] 上传视频:', { mimeType: videoMime, filename });

  const result = await uploadToPublicUrl(base64Data, { filename, mimeType: videoMime });
  console.log(`[jimeng] 视频已上传到 ${result.service}:`, vLog(result.url, 120));
  return result.url;
}

// ========================================
// 统一生成入口
// ========================================

const JIMENG_TIMEOUT_MS = 20 * 60 * 1000; // 20 分钟（jimeng-api 内部轮询，视频生成耗时较长）

export async function generateWithJimeng(
  request: {
    prompt: string;
    model?: string;
    orientation?: string;
    seconds?: string;
    input_image?: string;
    input_images?: string[];
    input_videos?: string[];
    input_videos_mimes?: string[];
    functionMode?: string;
  },
  onProgress?: (progress: number, status: string) => void,
  options?: {
    baseUrl?: string;
    apiKey?: string;
    channelId?: string;
    hdEnabled?: boolean;
  }
): Promise<VideoGenerationResult> {
  if (!options?.baseUrl || !options?.apiKey) {
    throw new Error('即梦 API 配置缺失');
  }

  onProgress?.(5, '准备请求');

  const body: JimengVideoRequest = {
    model: request.model || 'jimeng-video-3.5-pro',
    prompt: request.prompt,
    ratio: mapAspectRatio(request.orientation),
    resolution: options.hdEnabled ? '1080p' : '720p',
    duration: parseInt(request.seconds || '5') || 5,
  };

  // 自动检测 functionMode
  const hasVideos = request.input_videos && request.input_videos.length > 0;
  const imageCount = (request.input_images?.length || 0) + (request.input_image ? 1 : 0);
  const autoMode = hasVideos || imageCount > 2 ? 'omni_reference' : undefined;
  const functionMode = request.functionMode || autoMode;
  if (functionMode) {
    body.functionMode = functionMode;
  }

  if (functionMode === 'omni_reference') {
    // omni_reference 模式：并行上传所有图片和视频为命名字段
    onProgress?.(10, '上传素材文件');

    const allImages: string[] = [];
    if (request.input_image) allImages.push(request.input_image);
    if (request.input_images) allImages.push(...request.input_images);

    const uploadTasks: Promise<void>[] = [];

    // 上传图片（最多 9 张）
    const imagesToUpload = allImages.slice(0, 9);
    for (let i = 0; i < imagesToUpload.length; i++) {
      const idx = i;
      uploadTasks.push(
        uploadBase64Image(imagesToUpload[idx]).then(url => {
          body[`image_file_${idx + 1}`] = url;
        }).catch(error => {
          console.error(`[jimeng] omni 图片 ${idx + 1} 上传失败:`, error);
          throw new Error(`素材图片 ${idx + 1} 上传失败，请检查图床配置`);
        })
      );
    }

    // 上传视频（最多 3 个）
    if (request.input_videos) {
      const videosToUpload = request.input_videos.slice(0, 3);
      for (let i = 0; i < videosToUpload.length; i++) {
        const idx = i;
        uploadTasks.push(
          uploadBase64Video(videosToUpload[idx]).then(url => {
            body[`video_file_${idx + 1}`] = url;
          }).catch(error => {
            console.error(`[jimeng] omni 视频 ${idx + 1} 上传失败:`, error);
            throw new Error(`素材视频 ${idx + 1} 上传失败，请检查图床配置`);
          })
        );
      }
    }

    await Promise.all(uploadTasks);
  } else {
    // 原有 first_last_frames / I2V 逻辑
    const imageUrls: string[] = [];

    if (request.input_images && request.input_images.length >= 2) {
      onProgress?.(10, '上传首尾帧图片');
      try {
        const [firstUrl, lastUrl] = await Promise.all([
          uploadBase64Image(request.input_images[0]),
          uploadBase64Image(request.input_images[1]),
        ]);
        imageUrls.push(firstUrl, lastUrl);
      } catch (error) {
        console.error('[jimeng] 图片上传失败:', error);
        throw new Error('参考图片上传失败，请检查图床配置');
      }
    } else if (request.input_image) {
      onProgress?.(10, '上传参考图片');
      try {
        const url = await uploadBase64Image(request.input_image);
        imageUrls.push(url);
      } catch (error) {
        console.error('[jimeng] 参考图片上传失败:', error);
        throw new Error('参考图片上传失败，请检查图床配置');
      }
    }

    if (imageUrls.length > 0) {
      body.file_paths = imageUrls;
    }
  }

  const baseUrl = options.baseUrl.replace(/\/+$/, '');
  const apiUrl = `${baseUrl}/v1/videos/generations`;

  console.log('[jimeng] 请求 URL:', apiUrl);
  console.log('[jimeng] 请求体:', vLog(JSON.stringify(body), 500));

  onProgress?.(20, '提交生成任务');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), JIMENG_TIMEOUT_MS);

  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${options.apiKey}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    const responseText = await response.text();
    console.log('[jimeng] 响应状态:', response.status);
    console.log('[jimeng] 响应内容:', vLog(responseText, 2000));

    if (!response.ok) {
      throw new Error(`即梦 API 请求失败 (HTTP ${response.status}): ${vLog(responseText, 500)}`);
    }

    const data = parseJsonText<JimengVideoResponse & { code?: number; message?: string }>(responseText, 'jimeng');

    if (data.code && data.code !== 0) {
      throw new Error(`即梦 API 错误: ${data.message || '未知错误'} (code: ${data.code})`);
    }

    if (!data.data?.length || !data.data[0]?.url) {
      throw new Error(`即梦 API 响应缺少视频 URL: ${vLog(responseText, 500)}`);
    }

    return {
      id: `jimeng-${Date.now()}`,
      object: 'video',
      created: data.created || Date.now(),
      model: body.model,
      data: data.data,
      channelId: options.channelId,
    };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('即梦视频生成超时（超过 20 分钟）');
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
