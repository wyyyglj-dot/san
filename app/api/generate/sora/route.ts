/* eslint-disable no-console */
import { NextResponse } from 'next/server';
import { authHandler } from '@/lib/api-handler';
import { generateVideo } from '@/lib/video-generator';
import type { VideoGenerateRequest, VideoModelContext } from '@/lib/video-generator';
import { saveGeneration, updateUserBalance, getUserById, updateGeneration, getSystemConfig, refundGenerationBalance, getVideoModelWithChannel, checkUserConcurrencyLimit, getVideoModels, getUserQueuePosition, getEffectiveCost } from '@/lib/db';
import { triggerNextQueuedTask } from '@/lib/task-scheduler';
import type { Generation, VideoModel } from '@/types';
import { fetchExternalBuffer } from '@/lib/safe-fetch';
import { downloadVideoToLocal } from '@/lib/media-storage';
import { getDefaultRetryConfig } from '@/lib/retry-config-validator';
import { vLog } from '@/lib/log-verbose';

// 配置路由段选项
export const maxDuration = 60;
export const dynamic = 'force-dynamic';

const MAX_REFERENCE_IMAGE_BYTES = 10 * 1024 * 1024;

// 请求体类型
type VideoGeneratePayload = {
  modelId?: string;
  channelId?: string;  // 新增：渠道ID，后端自动选择模型
  model?: string;
  prompt?: string;
  aspectRatio?: string;
  duration?: string;
  files?: Array<{ mimeType: string; data: string }>;
  referenceImageUrl?: string;
  style_id?: string;
  remix_target_id?: string;
  functionMode?: 'first_last_frames' | 'omni_reference';
};

function isRateLimitError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return (
    message.includes('429') ||
    message.includes('rate limit') ||
    message.includes('rate limited') ||
    message.includes('too many requests')
  );
}

function getRateLimitDelayMs(attempt: number, baseDelayMs: number, maxDelayMs: number, jitterRatio: number): number {
  const delay = Math.min(baseDelayMs * 2 ** (attempt - 1), maxDelayMs);
  const ratio = Math.min(Math.max(jitterRatio, 0), 0.5);
  const jitter = Math.floor(delay * ratio * Math.random());
  return delay - jitter;
}

// 标准化时长格式
function normalizeDurationValue(duration?: string): string | undefined {
  if (!duration) return undefined;
  if (/^\d+$/.test(duration)) return `${duration}s`;
  return duration;
}

// 计算费用
function resolveVideoCost(
  model: VideoModel,
  duration: string | undefined,
  config: { pricing: { soraVideo10s: number; soraVideo15s: number; soraVideo25s: number } }
): number {
  const normalizedDuration = normalizeDurationValue(duration);
  if (normalizedDuration) {
    const matched = model.durations.find((item) => item.value === normalizedDuration);
    if (matched && typeof matched.cost === 'number' && matched.cost > 0) {
      return matched.cost;
    }
  }
  if (normalizedDuration?.includes('25')) return config.pricing.soraVideo25s;
  if (normalizedDuration?.includes('15')) return config.pricing.soraVideo15s;
  return config.pricing.soraVideo10s;
}

// 构建生成请求
function buildGeneratorRequest(body: VideoGeneratePayload): VideoGenerateRequest {
  return {
    modelId: body.modelId || '',
    prompt: body.prompt || '',
    aspectRatio: body.aspectRatio,
    duration: body.duration,
    files: body.files,
    styleId: body.style_id,
    remixTargetId: body.remix_target_id,
    functionMode: body.functionMode,
  };
}

async function generateWithRateLimitRetry(
  body: VideoGenerateRequest,
  onProgress: (progress: number, status: string) => void,
  taskId: string,
  modelConfig: VideoModelContext,
  onVideoIdReady?: (videoId: string, channelId?: string) => void
) {
  const config = await getSystemConfig();
  const retryConfig = config.retryConfig?.rateLimit ?? getDefaultRetryConfig().rateLimit;
  const videoOpts = onVideoIdReady ? { onVideoIdReady } : undefined;

  // 如果重试被禁用，直接调用一次
  if (!retryConfig.enabled) {
    return generateVideo(body, onProgress, modelConfig, videoOpts);
  }

  const maxAttempts = Math.max(1, retryConfig.maxAttempts);
  const baseDelayMs = Math.max(0, retryConfig.baseDelayMs);
  const maxDelayMs = Math.max(baseDelayMs, retryConfig.maxDelayMs);
  const jitterRatio = retryConfig.jitterRatio ?? 0.25;
  const maxElapsedMs = retryConfig.maxElapsedMs;
  const startTime = Date.now();
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const retryCount = attempt - 1;
      if (retryCount > 0) {
        console.warn(`[Task ${taskId}] Retry attempt ${retryCount} after rate limit`);
      }
      return await generateVideo(body, onProgress, modelConfig, videoOpts);
    } catch (error) {
      lastError = error;
      if (!isRateLimitError(error) || attempt === maxAttempts) {
        throw error;
      }
      const delayMs = getRateLimitDelayMs(attempt, baseDelayMs, maxDelayMs, jitterRatio);
      if (maxElapsedMs !== undefined && Date.now() - startTime + delayMs > maxElapsedMs) {
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  throw lastError ?? new Error('Rate limit retry failed');
}

async function fetchImageAsBase64(imageUrl: string, origin: string): Promise<{ mimeType: string; data: string }> {
  const { buffer, contentType } = await fetchExternalBuffer(imageUrl, {
    origin,
    allowRelative: true,
    maxBytes: MAX_REFERENCE_IMAGE_BYTES,
    timeoutMs: 10000,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    },
  });
  if (!contentType.startsWith('image/')) {
    throw new Error('Unsupported reference image content type');
  }
  const data = buffer.toString('base64');
  return { mimeType: contentType, data };
}

// 后台处理任务
async function processGenerationTask(
  generationId: string,
  userId: string,
  body: VideoGeneratePayload,
  prechargedCost: number,
  modelConfig: VideoModelContext
): Promise<void> {
  try {
    console.log(`[Task ${generationId}] 开始处理生成任务:`, {
      userId,
      prompt: vLog(body.prompt, 100),
      modelId: body.modelId,
      channelId: body.channelId,
      aspectRatio: body.aspectRatio,
      duration: body.duration,
      style_id: body.style_id,
      remix_target_id: body.remix_target_id,
      hasFiles: !!(body.files && body.files.length > 0),
      filesCount: body.files?.length || 0,
      prechargedCost,
    });
    
    // 更新状态为 processing
    await updateGeneration(generationId, { status: 'processing' }).catch(err => {
      console.error(`[Task ${generationId}] 更新状态失败:`, err);
    });

    // 进度更新回调（节流：每5%更新一次）
    let lastProgress = 0;
    let currentVideoId: string | undefined;
    let currentVideoChannelId: string | undefined;
    let taskCompleted = false; // 防止完成后 onProgress 覆盖 params
    const onProgress = async (progress: number) => {
      if (taskCompleted) return;
      if (progress - lastProgress >= 5 || progress >= 100) {
        lastProgress = progress;
        await updateGeneration(generationId, {
          params: { modelId: body.modelId, aspectRatio: body.aspectRatio, duration: body.duration, progress, videoId: currentVideoId, videoChannelId: currentVideoChannelId }
        }).catch(err => {
          console.error(`[Task ${generationId}] 更新进度失败:`, err);
        });
      }
    };

    // videoId 就绪回调：轮询前持久化 videoId
    const onVideoIdReady = async (videoId: string, channelId?: string) => {
      currentVideoId = videoId;
      currentVideoChannelId = channelId;
      await updateGeneration(generationId, {
        params: { modelId: body.modelId, aspectRatio: body.aspectRatio, duration: body.duration, progress: lastProgress, videoId, videoChannelId: channelId },
      }).catch(err => {
        console.error(`[Task ${generationId}] 持久化 videoId 失败:`, err);
      });
    };

    // 调用视频生成统一入口
    const result = await generateWithRateLimitRetry(buildGeneratorRequest(body), onProgress, generationId, modelConfig, onVideoIdReady);

    console.log(`[Task ${generationId}] 生成成功:`, JSON.stringify({
      url: result.url,
      videoId: result.videoId,
      videoChannelId: result.videoChannelId,
      permalink: result.permalink,
      revised_prompt: result.revised_prompt,
    }));

    // 尝试下载视频到本地存储（防止外部 URL 过期）
    let savedUrl = result.url;
    if (result.url && (result.url.startsWith('http://') || result.url.startsWith('https://'))) {
      const localPath = await downloadVideoToLocal(generationId, result.url);
      if (localPath) {
        savedUrl = localPath;
        console.log(`[Task ${generationId}] 视频已保存到本地: ${localPath}`);
      } else {
        console.warn(`[Task ${generationId}] 视频本地保存失败，保留外部 URL`);
      }
    }

    // 更新生成记录为完成状态
    taskCompleted = true;
    await updateGeneration(generationId, {
      status: 'completed',
      resultUrl: savedUrl,
      params: {
        modelId: body.modelId,
        aspectRatio: body.aspectRatio,
        duration: body.duration,
        progress: 100,
        videoId: result.videoId,
        videoChannelId: result.videoChannelId,
        videoChannelType: result.videoChannelType,
        permalink: result.permalink,
        revised_prompt: result.revised_prompt,
        originalVideoUrl: result.url || '',
      },
    }).catch(err => {
      console.error(`[Task ${generationId}] 更新完成状态失败:`, err);
    });

    console.log(`[Task ${generationId}] 任务完成`);

    // Trigger next queued task
    triggerNextQueuedTask(userId).catch(() => {});
  } catch (error) {
    console.error(`[Task ${generationId}] 任务失败:`, error);

    // 确保错误消息格式正确
    let errorMessage = '生成失败';
    let debugInfo = '';
    if (error instanceof Error) {
      errorMessage = error.message;
      // 处理 cause 属性中的额外信息
      if ('cause' in error && error.cause) {
        console.error(`[Task ${generationId}] 错误原因:`, error.cause);
      }
      // 提取 debugContext 信息
      if ('debugContext' in error && (error as any).debugContext) {
        const ctx = (error as any).debugContext;
        debugInfo = `[调试信息] API: ${ctx.apiUrl || 'N/A'}, 模型: ${ctx.model || 'N/A'}, 渠道: ${ctx.channelId || 'N/A'}`;
        console.error(`[Task ${generationId}] ${debugInfo}`);
      }
    }
    
    // 更新为失败状态（用 try-catch 确保不会抛出）
    try {
      await updateGeneration(generationId, {
        status: 'failed',
        errorMessage,
      });
    } catch (updateErr) {
      console.error(`[Task ${generationId}] 更新失败状态时出错:`, updateErr);
    }

    try {
      await refundGenerationBalance(generationId, userId, prechargedCost);
    } catch (refundErr) {
      console.error(`[Task ${generationId}] Refund failed:`, refundErr);
    }

    // Trigger next queued task
    triggerNextQueuedTask(userId).catch(() => {});
  }
}

export const POST = authHandler(async (req, _ctx, session) => {
  try {
    const body = await req.json() as VideoGeneratePayload;
    const hasPrompt = Boolean(body.prompt && body.prompt.trim());
    const hasFiles = Boolean(body.files && body.files.length > 0);
    const hasReferenceUrl = Boolean(body.referenceImageUrl);

    if (!hasPrompt && !hasFiles && !hasReferenceUrl) {
      return NextResponse.json(
        { error: '请输入提示词或上传参考文件' },
        { status: 400 }
      );
    }

    const origin = new URL(req.url).origin;
    const normalizedBody: VideoGeneratePayload = {
      ...body,
      files: body.files ? [...body.files] : [],
    };

    if (body.referenceImageUrl) {
      const file = await fetchImageAsBase64(body.referenceImageUrl, origin);
      normalizedBody.files?.push(file);
    }

    const hasImages = Boolean(normalizedBody.files && normalizedBody.files.length > 0);
    const imageCount = normalizedBody.files?.filter((f: { mimeType: string }) => f.mimeType?.startsWith('image/')).length || 0;
    const videoCount = normalizedBody.files?.filter((f: { mimeType: string }) => f.mimeType?.startsWith('video/')).length || 0;
    const isOmniMode = normalizedBody.functionMode === 'omni_reference' || videoCount > 0 || imageCount > 2;

    // 如果传了 channelId 但没有 modelId，根据是否有图片自动选择模型
    if (normalizedBody.channelId && !normalizedBody.modelId) {
      const allModels = await getVideoModels(true); // 只获取启用的模型
      const channelModels = allModels.filter(m => m.channelId === normalizedBody.channelId);

      if (channelModels.length === 0) {
        return NextResponse.json(
          { error: '该渠道下没有可用的视频模型' },
          { status: 400 }
        );
      }

      let selectedModel;
      if (isOmniMode) {
        // omni_reference 模式：优先选 R2V 模型（支持多素材）
        selectedModel = channelModels.find(m => m.features.referenceToVideo);
        if (!selectedModel) {
          selectedModel = channelModels.find(m => m.features.imageToVideo);
        }
        if (!selectedModel) {
          // fallback 到任意模型
          selectedModel = channelModels[0];
        }
      } else if (imageCount >= 2) {
        // 2+ 张图：优先选 R2V 模型
        selectedModel = channelModels.find(m => m.features.referenceToVideo);
        if (!selectedModel) {
          // fallback 到 I2V
          selectedModel = channelModels.find(m => m.features.imageToVideo);
        }
        if (!selectedModel) {
          return NextResponse.json(
            { error: '该渠道不支持参考图生视频' },
            { status: 400 }
          );
        }
      } else if (hasImages) {
        // 有图片：优先选择支持 I2V 且非 R2V 的模型
        selectedModel = channelModels.find(m => m.features.imageToVideo && !m.features.referenceToVideo);
        if (!selectedModel) {
          selectedModel = channelModels.find(m => m.features.imageToVideo);
        }
        if (!selectedModel) {
          return NextResponse.json(
            { error: '该渠道不支持图生视频，请移除图片后重试' },
            { status: 400 }
          );
        }
      } else {
        // 无图片：优先选择支持 T2V 的模型
        selectedModel = channelModels.find(m => m.features.textToVideo);
        if (!selectedModel) {
          return NextResponse.json(
            { error: '该渠道不支持文生视频，请上传参考图片后重试' },
            { status: 400 }
          );
        }
      }

      normalizedBody.modelId = selectedModel.id;
    }

    // 验证 modelId 必填
    if (!normalizedBody.modelId) {
      return NextResponse.json(
        { error: '请选择视频渠道' },
        { status: 400 }
      );
    }

    // 获取模型配置
    const modelConfig = await getVideoModelWithChannel(normalizedBody.modelId);
    if (!modelConfig) {
      return NextResponse.json(
        { error: '视频模型不存在' },
        { status: 400 }
      );
    }

    const { model, channel, effectiveBaseUrl } = modelConfig;

    // 校验模型能力 vs 图片数量
    if (model.features.referenceToVideo && !model.features.imageToVideo && imageCount < 2) {
      return NextResponse.json(
        { error: '该模型需要上传 2 张参考图片（起始帧 + 结束帧）' },
        { status: 400 }
      );
    }

    // 验证模型和渠道启用状态
    if (!model.enabled) {
      return NextResponse.json(
        { error: '该视频模型已禁用' },
        { status: 400 }
      );
    }
    if (!channel.enabled) {
      return NextResponse.json(
        { error: '该视频渠道已禁用' },
        { status: 400 }
      );
    }

    // 设置默认值
    if (!normalizedBody.aspectRatio) {
      normalizedBody.aspectRatio = model.defaultAspectRatio;
    }
    if (!normalizedBody.duration) {
      normalizedBody.duration = model.defaultDuration;
    }

    // 获取最新用户信息
    const user = await getUserById(session.user.id);
    if (!user) {
      return NextResponse.json({ error: '用户不存在' }, { status: 401 });
    }

    // 计算费用（使用用户组动态定价）
    const config = await getSystemConfig();
    const baseCost = resolveVideoCost(model, normalizedBody.duration, config);
    const { cost: estimatedCost } = await getEffectiveCost(
      session.user.id, normalizedBody.modelId!, 'video', baseCost
    );

    // 检查余额
    if (user.balance < estimatedCost) {
      return NextResponse.json(
        { error: `余额不足，需要至少 ${estimatedCost} 积分` },
        { status: 402 }
      );
    }

    // 检查并发限制（不再拒绝，改为排队）
    const { shouldQueue } = await checkUserConcurrencyLimit(session.user.id);

    try {
      await updateUserBalance(user.id, -estimatedCost, 'strict');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Insufficient balance';
      if (message.includes('Insufficient balance')) {
        return NextResponse.json(
          { error: `余额不足，需要至少 ${estimatedCost} 积分` },
          { status: 402 }
        );
      }
      throw err;
    }

    // 生成类型固定为视频
    const type = 'sora-video';

    // 立即创建生成记录（状态为 pending）
    let generation: Generation;
    try {
      generation = await saveGeneration({
        userId: user.id,
        type,
        prompt: normalizedBody.prompt || '',
        params: {
          modelId: normalizedBody.modelId,
          aspectRatio: normalizedBody.aspectRatio,
          duration: normalizedBody.duration,
        },
        resultUrl: '',
        cost: estimatedCost,
        status: shouldQueue ? 'queued' : 'pending',
        balancePrecharged: true,
        balanceRefunded: false,
      });
    } catch (saveErr) {
      await updateUserBalance(user.id, estimatedCost, 'strict').catch(refundErr => {
        console.error('[API] Precharge rollback failed:', refundErr);
      });
      throw saveErr;
    }

    // 如果不需要排队，在后台异步处理（不等待完成）
    if (!shouldQueue) {
      processGenerationTask(generation.id, user.id, normalizedBody, estimatedCost, modelConfig).catch((err) => {
        console.error('[API] 后台任务启动失败:', err);
      });
    }

    // 仅管理员可见调试信息
    const isAdmin = session.user.role === 'admin';

    // 获取队列位置（如果排队中）
    let queuePosition: number | undefined;
    if (shouldQueue) {
      queuePosition = await getUserQueuePosition(user.id, generation.id);
    }

    // 立即返回任务 ID
    return NextResponse.json({
      success: true,
      ...(isAdmin && {
        _debug: {
          apiUrl: effectiveBaseUrl,
          model: model.apiModel,
          channelType: channel.type,
          channelId: channel.id,
        },
      }),
      data: {
        id: generation.id,
        status: shouldQueue ? 'queued' : 'pending',
        message: shouldQueue ? '任务已加入队列，等待处理中' : '任务已创建，正在后台处理中',
        ...(queuePosition !== undefined && { queuePosition }),
      },
    });
  } catch (error) {
    console.error('[API] Sora generation error:', error);
    throw error;
  }
}, {
  rateLimit: { scope: 'GENERATE', route: '/api/generate/sora' },
  fallbackMessage: '视频生成失败',
  context: '[API] Sora generation',
});
