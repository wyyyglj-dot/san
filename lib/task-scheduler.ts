/* eslint-disable no-console */
import {
  checkUserConcurrencyLimit,
  getOldestQueuedGeneration,
  updateGeneration,
  getImageModelWithChannel,
  getVideoModelWithChannel,
  refundGenerationBalance,
} from './db';
import { generateImage, type ImageGenerateRequest } from './image-generator';
import { generateVideo } from './video-generator';
import type { VideoGenerateRequest, VideoModelContext } from './video-generator';
import { saveMediaAsync, downloadVideoToLocal } from './media-storage';
import { vLog } from './log-verbose';
import type { Generation } from '@/types';

// Process a queued image generation task
async function processQueuedImageTask(gen: Generation): Promise<void> {
  const generationId = gen.id;
  const userId = gen.userId;
  const params = gen.params as Record<string, unknown>;

  try {
    console.log(`[Scheduler][Task ${generationId}] Starting queued image task`);
    await updateGeneration(generationId, { status: 'processing' });

    const modelId = params.modelId as string || '';
    const request: ImageGenerateRequest = {
      modelId,
      prompt: gen.prompt || '',
      aspectRatio: params.aspectRatio as string,
      imageSize: params.imageSize as string,
    };

    const { generateImage: genImg } = await import('./image-generator');
    const result = await genImg(request);
    const savedUrl = await saveMediaAsync(generationId, result.url);

    await updateGeneration(generationId, {
      status: 'completed',
      resultUrl: savedUrl,
    });

    console.log(`[Scheduler][Task ${generationId}] Image task completed`);
  } catch (error) {
    console.error(`[Scheduler][Task ${generationId}] Image task failed:`, error);
    await updateGeneration(generationId, {
      status: 'failed',
      errorMessage: error instanceof Error ? error.message : '生成失败',
    }).catch(() => {});

    try {
      await refundGenerationBalance(generationId, userId, gen.cost);
    } catch (refundErr) {
      console.error(`[Scheduler][Task ${generationId}] Refund failed:`, refundErr);
    }
  } finally {
    // Trigger next queued task after this one completes
    triggerNextQueuedTask(userId).catch(() => {});
  }
}

// Process a queued video generation task
async function processQueuedVideoTask(gen: Generation): Promise<void> {
  const generationId = gen.id;
  const userId = gen.userId;
  const params = gen.params as Record<string, unknown>;

  try {
    console.log(`[Scheduler][Task ${generationId}] Starting queued video task`);
    await updateGeneration(generationId, { status: 'processing' });

    const modelId = params.modelId as string || '';
    const modelConfig = await getVideoModelWithChannel(modelId);
    if (!modelConfig) {
      throw new Error('视频模型不存在或已禁用');
    }

    const { model, channel } = modelConfig;
    const effectiveBaseUrl = model.baseUrl || channel.baseUrl;

    const videoRequest: VideoGenerateRequest = {
      modelId,
      prompt: gen.prompt || '',
      aspectRatio: params.aspectRatio as string,
      duration: params.duration as string,
    };

    const onProgress = async (progress: number) => {
      await updateGeneration(generationId, {
        params: { ...params, progress },
      }).catch(() => {});
    };

    const videoContext: VideoModelContext = {
      model,
      channel,
      effectiveBaseUrl,
      effectiveApiKey: model.apiKey || channel.apiKey,
    };

    const result = await generateVideo(videoRequest, onProgress, videoContext);

    let savedUrl = result.url;
    if (result.url && (result.url.startsWith('http://') || result.url.startsWith('https://'))) {
      const localPath = await downloadVideoToLocal(generationId, result.url);
      if (localPath) savedUrl = localPath;
    }

    await updateGeneration(generationId, {
      status: 'completed',
      resultUrl: savedUrl,
      params: {
        ...params,
        progress: 100,
        videoId: result.videoId,
        videoChannelId: result.videoChannelId,
        videoChannelType: result.videoChannelType,
        permalink: result.permalink,
        revised_prompt: result.revised_prompt,
        originalVideoUrl: result.url || '',
      },
    }).catch(err => {
      console.error(`[Scheduler][Task ${generationId}] Update completed status failed:`, err);
    });

    console.log(`[Scheduler][Task ${generationId}] Video task completed`);
  } catch (error) {
    console.error(`[Scheduler][Task ${generationId}] Video task failed:`, error);
    await updateGeneration(generationId, {
      status: 'failed',
      errorMessage: error instanceof Error ? error.message : '生成失败',
    }).catch(() => {});

    try {
      await refundGenerationBalance(generationId, userId, gen.cost);
    } catch (refundErr) {
      console.error(`[Scheduler][Task ${generationId}] Refund failed:`, refundErr);
    }
  } finally {
    // Trigger next queued task after this one completes
    triggerNextQueuedTask(userId).catch(() => {});
  }
}

/**
 * Trigger the next queued task for a user.
 * Called when a task completes, fails, or is cancelled.
 */
export async function triggerNextQueuedTask(userId: string): Promise<void> {
  try {
    const { shouldQueue } = await checkUserConcurrencyLimit(userId);
    if (shouldQueue) return; // Still at capacity

    const nextTask = await getOldestQueuedGeneration(userId);
    if (!nextTask) return;

    console.log(`[Scheduler] Dispatching queued task ${nextTask.id} (type: ${nextTask.type})`);

    // Update to pending first
    await updateGeneration(nextTask.id, { status: 'pending' });

    // Dispatch based on type (fire-and-forget)
    if (nextTask.type.includes('video')) {
      processQueuedVideoTask(nextTask).catch(err => {
        console.error(`[Scheduler] Video task dispatch failed:`, err);
      });
    } else {
      processQueuedImageTask(nextTask).catch(err => {
        console.error(`[Scheduler] Image task dispatch failed:`, err);
      });
    }
  } catch (error) {
    console.error(`[Scheduler] triggerNextQueuedTask failed for user ${userId}:`, error);
  }
}
