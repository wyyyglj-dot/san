/* eslint-disable no-console */
import { NextResponse } from 'next/server';
import { authHandler } from '@/lib/api-handler';
import {
  getGeneration,
  updateGeneration,
  updateUserBalance,
  refundGenerationBalance,
  updateGenerationStatusIfMatches,
} from '@/lib/db';
import {
  getVideoStatus,
  pollVideoCompletion,
  parseVideoUrl,
} from '@/lib/sora-api';
import type { VideoTaskResponse } from '@/lib/sora-api';
import { downloadVideoToLocal } from '@/lib/media-storage';
import { isRetryableVideoError } from '@/lib/retry-utils';
import type { GenerationParams } from '@/types';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

type RetryRequestBody = {
  generationId?: string;
};

function isCompletedStatus(status?: string): boolean {
  return status === 'completed' || status === 'succeeded';
}

function isInProgressStatus(status?: string): boolean {
  return (
    status === 'queued' ||
    status === 'pending' ||
    status === 'in_progress' ||
    status === 'processing'
  );
}

async function finalizeSuccess(
  generationId: string,
  params: GenerationParams,
  status: VideoTaskResponse
): Promise<void> {
  if (!status.url) {
    throw new Error('视频生成完成但未返回 URL');
  }

  const normalizedUrl = parseVideoUrl(status.url);
  let savedUrl = normalizedUrl;

  if (normalizedUrl.startsWith('http://') || normalizedUrl.startsWith('https://')) {
    const localPath = await downloadVideoToLocal(generationId, normalizedUrl);
    if (localPath) {
      savedUrl = localPath;
      console.log(`[Retry ${generationId}] 视频已保存到本地: ${localPath}`);
    }
  }

  const updatedParams: GenerationParams = {
    ...params,
    progress: 100,
    permalink: typeof status.permalink === 'string' ? status.permalink : params.permalink,
    revised_prompt: typeof status.revised_prompt === 'string' ? status.revised_prompt : params.revised_prompt,
    originalVideoUrl: normalizedUrl || params.originalVideoUrl || '',
  };

  await updateGeneration(generationId, {
    status: 'completed',
    resultUrl: savedUrl,
    params: updatedParams,
    errorMessage: '',
  });
}

async function resumeVideoTask(
  generationId: string,
  userId: string,
  cost: number,
  params: GenerationParams,
  videoId: string,
  channelId?: string
): Promise<void> {
  const currentParams: GenerationParams = { ...params, videoId, videoChannelId: channelId };
  let lastProgress = typeof currentParams.progress === 'number' ? currentParams.progress : 0;

  const onProgress = async (progress: number) => {
    if (progress - lastProgress >= 5 || progress >= 100) {
      lastProgress = progress;
      currentParams.progress = progress;
      await updateGeneration(generationId, { params: currentParams }).catch(err => {
        console.error(`[Retry ${generationId}] 更新进度失败:`, err);
      });
    }
  };

  try {
    const status = await getVideoStatus(videoId, channelId);

    if (isCompletedStatus(status.status)) {
      const finalStatus = status.url ? status : await pollVideoCompletion(videoId, onProgress, channelId);
      await finalizeSuccess(generationId, currentParams, finalStatus);
      return;
    }

    if (status.status === 'failed') {
      const errorMessage = status.error?.message || '视频生成失败';
      await updateGeneration(generationId, { status: 'failed', errorMessage, params: currentParams });
      await refundGenerationBalance(generationId, userId, cost).catch(err => {
        console.error(`[Retry ${generationId}] 退款失败:`, err);
      });
      return;
    }

    if (isInProgressStatus(status.status)) {
      const finalStatus = await pollVideoCompletion(videoId, onProgress, channelId);
      await finalizeSuccess(generationId, currentParams, finalStatus);
      return;
    }

    throw new Error(`未知视频状态: ${status.status || 'unknown'}`);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '重试失败';
    await updateGeneration(generationId, { status: 'failed', errorMessage, params: currentParams }).catch(err => {
      console.error(`[Retry ${generationId}] 更新失败状态出错:`, err);
    });
    await refundGenerationBalance(generationId, userId, cost).catch(err => {
      console.error(`[Retry ${generationId}] 退款失败:`, err);
    });
  }
}

export const POST = authHandler(async (req, _ctx, session) => {
  try {
    const body = (await req.json()) as RetryRequestBody;
    const generationId = typeof body.generationId === 'string' ? body.generationId : '';
    if (!generationId) {
      return NextResponse.json({ error: 'generationId is required' }, { status: 400 });
    }

    const generation = await getGeneration(generationId);
    if (!generation) {
      return NextResponse.json({ error: '生成记录不存在' }, { status: 404 });
    }

    if (generation.userId !== session.user.id) {
      return NextResponse.json({ error: '无权操作' }, { status: 403 });
    }

    if (generation.status !== 'failed') {
      return NextResponse.json({ error: '仅失败任务可重试' }, { status: 400 });
    }

    if (!isRetryableVideoError(generation.errorMessage)) {
      return NextResponse.json({ error: '该错误类型不支持重试' }, { status: 400 });
    }

    const params = (generation.params || {}) as GenerationParams;
    const videoId = typeof params.videoId === 'string' ? params.videoId : '';
    const channelId = typeof params.videoChannelId === 'string' ? params.videoChannelId : undefined;

    if (!videoId) {
      return NextResponse.json({ error: '该任务无法恢复，请重新生成' }, { status: 400 });
    }

    // CAS 防并发
    const updated = await updateGenerationStatusIfMatches(generation.id, 'failed', 'processing');
    if (!updated) {
      return NextResponse.json({ error: '任务正在重试中' }, { status: 409 });
    }

    // 清除旧错误信息
    await updateGeneration(generation.id, { errorMessage: '' }).catch(() => {});

    // 已退款则重新扣费
    if (generation.balanceRefunded) {
      try {
        await updateUserBalance(generation.userId, -generation.cost, 'strict');
        await updateGeneration(generation.id, { balanceRefunded: false });
      } catch (error) {
        await updateGeneration(generation.id, { status: 'failed' }).catch(() => {});
        const msg = error instanceof Error ? error.message : '';
        const isInsufficient = msg.toLowerCase().includes('insufficient');
        return NextResponse.json(
          { error: isInsufficient ? '积分不足' : '扣费失败' },
          { status: isInsufficient ? 402 : 500 }
        );
      }
    }

    // 异步恢复轮询
    void resumeVideoTask(generation.id, generation.userId, generation.cost, params, videoId, channelId);

    return NextResponse.json({
      success: true,
      data: { id: generation.id, status: 'processing' },
    });
  } catch (error) {
    console.error('[API] Video retry error:', error);
    throw error;
  }
}, {
  fallbackMessage: '重试失败',
  context: '[API] Video retry',
});
