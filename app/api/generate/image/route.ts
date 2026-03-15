/* eslint-disable no-console */
import { NextResponse } from 'next/server';
import { authHandler } from '@/lib/api-handler';
import { generateImage, type ImageGenerateRequest } from '@/lib/image-generator';
import { selectImageModel } from '@/lib/image-model-selector';
import {
  saveGeneration,
  updateUserBalance,
  getUserById,
  updateGeneration,
  getImageModelWithChannel,
  refundGenerationBalance,
  checkUserConcurrencyLimit,
  getUserQueuePosition,
  getEffectiveCost,
} from '@/lib/db';
import { triggerNextQueuedTask } from '@/lib/task-scheduler';
import { saveMediaAsync } from '@/lib/media-storage';
import { fetchExternalBuffer } from '@/lib/safe-fetch';
import type { ChannelType, Generation, GenerationType } from '@/types';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

const MAX_REFERENCE_IMAGE_BYTES = 10 * 1024 * 1024;
const IMAGE_TYPE_BY_CHANNEL: Record<ChannelType, GenerationType> = {
  'openai-compatible': 'gemini-image',
  gemini: 'gemini-image',
  modelscope: 'zimage-image',
  gitee: 'gitee-image',
  sora: 'sora-image',
  'kie-ai': 'sora-image',
  suchuang: 'sora-image',
  jimeng: 'sora-image',
  'grok-video': 'sora-image',
};

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
  return { mimeType: contentType, data: `data:${contentType};base64,${data}` };
}

// 后台处理任务
async function processGenerationTask(
  generationId: string,
  userId: string,
  request: ImageGenerateRequest,
  prechargedCost: number
) {
  try {
    console.log(`[Task ${generationId}] 开始处理图像生成任务`);

    await updateGeneration(generationId, { status: 'processing' });

    const result = await generateImage(request);

    // 保存到图床或本地
    const savedUrl = await saveMediaAsync(generationId, result.url);

    console.log(`[Task ${generationId}] 生成成功:`, JSON.stringify({
      url: savedUrl,
      originalUrl: result.url,
      model: request.modelId,
    }));

    await updateGeneration(generationId, {
      status: 'completed',
      resultUrl: savedUrl,
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
    const body = await req.json();
    const {
      modelId: requestedModelId,
      channelId,
      prompt,
      aspectRatio,
      imageSize,
      images,
      referenceImages,
      referenceImageUrl,
    } = body;

    // 处理参考图（在模型选择之前，因为需要知道是否有参考图）
    const origin = new URL(req.url).origin;
    const imageList: Array<{ mimeType: string; data: string }> = [];

    if (images && Array.isArray(images)) {
      imageList.push(...images);
    }

    if (referenceImages && Array.isArray(referenceImages)) {
      for (const img of referenceImages) {
        if (typeof img === 'string') {
          if (img.startsWith('data:')) {
            const match = img.match(/^data:([^;]+);base64,(.+)$/);
            if (match) {
              imageList.push({ mimeType: match[1], data: img });
            }
          } else {
            const ref = await fetchImageAsBase64(img, origin);
            imageList.push(ref);
          }
        }
      }
    }

    if (referenceImageUrl && typeof referenceImageUrl === 'string') {
      const ref = await fetchImageAsBase64(referenceImageUrl, origin);
      imageList.push(ref);
    }

    // 模型选择：channelId 自动选择 or modelId 直接指定
    let modelId = requestedModelId;
    if (!modelId && channelId) {
      const selection = await selectImageModel({
        channelId,
        imageSize,
        aspectRatio,
        hasReferenceImage: imageList.length > 0,
        imageCount: imageList.length,
      });
      if (!selection) {
        return NextResponse.json(
          { error: '该渠道下没有匹配的图片模型' },
          { status: 400 }
        );
      }
      modelId = selection.model.id;
    }

    if (!modelId) {
      return NextResponse.json({ error: '缺少模型 ID 或渠道 ID' }, { status: 400 });
    }

    // 获取模型配置
    const modelConfig = await getImageModelWithChannel(modelId);
    if (!modelConfig) {
      return NextResponse.json({ error: '模型不存在' }, { status: 404 });
    }
    const { model, channel, effectiveBaseUrl } = modelConfig;

    // 校验 channelId 与 model 的一致性
    if (channelId && channel.id !== channelId) {
      return NextResponse.json({ error: '渠道与模型不匹配' }, { status: 400 });
    }
    if (!model.enabled) {
      return NextResponse.json({ error: '模型已禁用' }, { status: 400 });
    }

    // 检查用户
    const user = await getUserById(session.user.id);
    if (!user) {
      return NextResponse.json({ error: '用户不存在' }, { status: 401 });
    }
    if (user.disabled) {
      return NextResponse.json({ error: '账号已被禁用' }, { status: 403 });
    }

    // 检查余额（使用用户组动态定价）
    const { cost: effectiveCost } = await getEffectiveCost(
      session.user.id, modelId, 'image', model.costPerGeneration
    );
    if (user.balance < effectiveCost) {
      return NextResponse.json(
        { error: `余额不足，需要至少 ${effectiveCost} 积分` },
        { status: 402 }
      );
    }

    // 检查并发限制（不再拒绝，改为排队）
    const { shouldQueue } = await checkUserConcurrencyLimit(session.user.id);

    try {
      await updateUserBalance(user.id, -effectiveCost, 'strict');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Insufficient balance';
      if (message.includes('Insufficient balance')) {
        return NextResponse.json(
          { error: `余额不足，需要至少 ${effectiveCost} 积分` },
          { status: 402 }
        );
      }
      throw err;
    }

    // 验证必须参考图
    if (model.requiresReferenceImage && imageList.length === 0) {
      return NextResponse.json({ error: '该模型需要上传参考图' }, { status: 400 });
    }

    // 验证提示词
    if (!model.allowEmptyPrompt && !prompt && imageList.length === 0) {
      return NextResponse.json({ error: '请输入提示词或上传参考图' }, { status: 400 });
    }

    // 构建请求
    const generateRequest: ImageGenerateRequest = {
      modelId,
      prompt: prompt || '',
      aspectRatio,
      imageSize,
      images: imageList.length > 0 ? imageList : undefined,
    };

    // 保存生成记录
    let generation: Generation;
    try {
      generation = await saveGeneration({
        userId: user.id,
        type: IMAGE_TYPE_BY_CHANNEL[channel.type] || 'gemini-image',
        prompt: prompt || '',
        params: {
          model: model.apiModel,
          aspectRatio,
          imageSize,
          imageCount: imageList.length,
        },
        resultUrl: '',
        cost: effectiveCost,
        status: shouldQueue ? 'queued' : 'pending',
        balancePrecharged: true,
        balanceRefunded: false,
      });
    } catch (saveErr) {
      await updateUserBalance(user.id, effectiveCost, 'strict').catch(refundErr => {
        console.error('[API] Precharge rollback failed:', refundErr);
      });
      throw saveErr;
    }

    console.log('[API] 图像生成任务已创建:', {
      id: generation.id,
      modelId,
      model: model.apiModel,
    });

    // 如果不需要排队，在后台异步处理
    if (!shouldQueue) {
      processGenerationTask(generation.id, user.id, generateRequest, effectiveCost).catch((err) => {
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
}, {
  rateLimit: { scope: 'GENERATE', route: '/api/generate/image' },
  fallbackMessage: '图像生成失败',
  context: '[API] Image generation',
});
