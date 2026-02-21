/* eslint-disable no-console */
import { NextResponse } from 'next/server';
import { authHandler } from '@/lib/api-handler';
import { generateImage } from '@/lib/sora-api';
import { saveGeneration, updateUserBalance, getUserById, updateGeneration, getSystemConfig, refundGenerationBalance, checkUserConcurrencyLimit, getUserQueuePosition } from '@/lib/db';
import { triggerNextQueuedTask } from '@/lib/task-scheduler';
import { fetchExternalBuffer } from '@/lib/safe-fetch';
import type { Generation } from '@/types';

export const maxDuration = 120;
export const dynamic = 'force-dynamic';

const MAX_REFERENCE_IMAGE_BYTES = 10 * 1024 * 1024;

interface SoraImageRequest {
  prompt: string;
  model?: string;
  size?: string;
  input_image?: string;
  referenceImageUrl?: string;
}

async function fetchImageAsBase64(
  imageUrl: string,
  origin: string
): Promise<{ mimeType: string; data: string }> {
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
  body: SoraImageRequest,
  prechargedCost: number
): Promise<void> {
  try {
    console.log(`[Task ${generationId}] 开始处理 Sora 图像生成任务`);

    await updateGeneration(generationId, { status: 'processing' });

    // 调用非流式 API
    const result = await generateImage({
      prompt: body.prompt,
      model: body.model || 'sora-image',
      size: body.size,
      input_image: body.input_image,
      response_format: 'url',
    });

    if (!result.data || result.data.length === 0 || !result.data[0].url) {
      throw new Error('图片生成失败：未返回有效的图片 URL');
    }

    const first = result.data[0];
    const config = await getSystemConfig();
    const cost = config.pricing.soraImage || 1;

    console.log(`[Task ${generationId}] 生成成功:`, JSON.stringify({
      url: first.url,
      revised_prompt: first.revised_prompt,
      model: body.model,
      size: body.size,
    }));

    await updateGeneration(generationId, {
      status: 'completed',
      resultUrl: first.url,
      params: {
        model: body.model,
        size: body.size,
        revised_prompt: first.revised_prompt,
      },
    });

    console.log(`[Task ${generationId}] 任务完成`);

    // Trigger next queued task
    triggerNextQueuedTask(userId).catch(() => {});
  } catch (error) {
    console.error(`[Task ${generationId}] 任务失败:`, error);

    await updateGeneration(generationId, {
      status: 'failed',
      errorMessage: error instanceof Error ? error.message : '生成失败',
    });

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
    const body: SoraImageRequest = await req.json();
    const origin = new URL(req.url).origin;
    const normalizedBody: SoraImageRequest = { ...body };

    if (body.referenceImageUrl && !body.input_image) {
      const file = await fetchImageAsBase64(body.referenceImageUrl, origin);
      normalizedBody.input_image = file.data;
    }

    if (!normalizedBody.prompt) {
      return NextResponse.json(
        { success: false, error: '请输入提示词' },
        { status: 400 }
      );
    }

    const user = await getUserById(session.user.id);
    if (!user) {
      return NextResponse.json({ success: false, error: '用户不存在' }, { status: 401 });
    }

    const config = await getSystemConfig();
    const estimatedCost = config.pricing.soraImage || 1;

    if (user.balance < estimatedCost) {
      return NextResponse.json(
        { success: false, error: `余额不足，需要至少 ${estimatedCost} 积分` },
        { status: 402 }
      );
    }

    const concurrencyCheck = await checkUserConcurrencyLimit(session.user.id);
    if (!concurrencyCheck.allowed) {
      return NextResponse.json(
        { success: false, error: concurrencyCheck.message },
        { status: 429 }
      );
    }
    const shouldQueue = concurrencyCheck.shouldQueue;

    try {
      await updateUserBalance(user.id, -estimatedCost, 'strict');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Insufficient balance';
      if (message.includes('Insufficient balance')) {
        return NextResponse.json(
          { success: false, error: `余额不足，需要至少 ${estimatedCost} 积分` },
          { status: 402 }
        );
      }
      throw err;
    }

    let generation: Generation;
    try {
      generation = await saveGeneration({
        userId: user.id,
        type: 'sora-image',
        prompt: normalizedBody.prompt,
        params: {
          model: normalizedBody.model,
          size: normalizedBody.size,
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

    // 如果不需要排队，在后台异步处理
    if (!shouldQueue) {
      processGenerationTask(generation.id, user.id, normalizedBody, estimatedCost).catch((err) => {
        console.error('[API] Sora Image 后台任务启动失败:', err);
      });
    }

    const isAdmin = session.user.role === 'admin';

    // 获取队列位置（如果排队中）
    let queuePosition: number | undefined;
    if (shouldQueue) {
      queuePosition = await getUserQueuePosition(user.id, generation.id);
    }

    return NextResponse.json({
      success: true,
      ...(isAdmin && {
        _debug: {
          apiUrl: null,
          model: normalizedBody.model || 'sora-image',
          channelType: 'sora',
          channelId: null,
        },
      }),
      data: {
        id: generation.id,
        status: shouldQueue ? 'queued' : 'pending',
        message: shouldQueue ? '任务已加入队列，等待处理中' : '任务已创建，正在后台处理中',
        ...(queuePosition !== undefined && { queuePosition }),
      },
    });
}, {
  rateLimit: { scope: 'GENERATE', route: '/api/generate/sora-image' },
  fallbackMessage: '生成失败',
  context: '[API] Sora Image generation',
});
