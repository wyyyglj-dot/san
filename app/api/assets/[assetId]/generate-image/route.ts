import { NextResponse } from 'next/server';
import { authHandler } from '@/lib/api-handler';
import {
  checkProjectAccess,
  createAssetGenerationHistory,
  getProjectAssetById,
  getProjectPreferences,
  updateAssetGenerationHistory,
  updateProjectAsset,
  type ProjectAssetType,
} from '@/lib/db-comic';
import {
  checkUserConcurrencyLimit,
  getImageModelWithChannel,
  getUserById,
  refundGenerationBalance,
  saveGeneration,
  updateGeneration,
  updateUserBalance,
} from '@/lib/db';
import { generateImage, type ImageGenerateRequest } from '@/lib/image-generator';
import { saveMediaAsync } from '@/lib/media-storage';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const DEFAULT_RATIOS: Record<ProjectAssetType, string> = {
  character: '9:16',
  scene: '16:9',
  prop: '1:1',
};

function buildAssetPrompt(asset: {
  type: string;
  name: string;
  description: string | null;
  attributes: Record<string, unknown> | null;
}): string {
  const lines = [`Asset type: ${asset.type}`, `Name: ${asset.name}`];
  if (asset.description) lines.push(`Description: ${asset.description}`);
  if (asset.attributes && Object.keys(asset.attributes).length > 0) {
    lines.push(`Attributes: ${JSON.stringify(asset.attributes)}`);
  }
  return lines.join('\n');
}

function getPreferredRatio(
  assetType: ProjectAssetType,
  prefs: Awaited<ReturnType<typeof getProjectPreferences>>
): string | undefined {
  if (!prefs) return undefined;
  if (assetType === 'character') return prefs.defaultCharacterRatio;
  if (assetType === 'scene') return prefs.defaultSceneRatio;
  return prefs.defaultPropRatio;
}

async function processAssetImage(
  generationId: string,
  historyId: string,
  userId: string,
  assetId: string,
  req: ImageGenerateRequest,
  cost: number,
  setAsPrimary: boolean
): Promise<void> {
  try {
    await updateGeneration(generationId, { status: 'processing' });
    await updateAssetGenerationHistory(historyId, { status: 'processing' }).catch(() => {});

    const result = await generateImage(req);
    const savedUrl = await saveMediaAsync(generationId, result.url);

    await updateGeneration(generationId, { status: 'completed', resultUrl: savedUrl });
    await updateAssetGenerationHistory(historyId, { status: 'completed', imageUrl: savedUrl }).catch(() => {});

    if (setAsPrimary) {
      await updateProjectAsset(assetId, { primaryImageUrl: savedUrl, generationId });
    }
  } catch (error) {
    console.error('[Asset Image] Generation failed:', error);
    await updateGeneration(generationId, {
      status: 'failed',
      errorMessage: error instanceof Error ? error.message : 'Image generation failed',
    });
    await updateAssetGenerationHistory(historyId, { status: 'failed' }).catch(() => {});
    try {
      await refundGenerationBalance(generationId, userId, cost);
    } catch (refundError) {
      console.error('[Asset Image] Refund failed:', refundError);
    }
  }
}

export const POST = authHandler(async (req, ctx, session) => {
  const { assetId } = ctx.params;
  const asset = await getProjectAssetById(assetId);
  if (!asset || asset.deletedAt) {
    return NextResponse.json({ success: false, error: '资产不存在' }, { status: 404 });
  }

  const access = await checkProjectAccess(asset.projectId, session.user.id);
  if (!access) {
    return NextResponse.json({ success: false, error: '无权限' }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const prompt = (typeof body.prompt === 'string' && body.prompt.trim())
    ? body.prompt.trim()
    : buildAssetPrompt(asset);
  const requestedChannelId = typeof body.channelId === 'string' ? body.channelId.trim() || undefined : undefined;
  const requestedAspectRatio = typeof body.aspectRatio === 'string' ? body.aspectRatio.trim() || undefined : undefined;
  const requestedImageSize = typeof body.imageSize === 'string' ? body.imageSize.trim() || undefined : undefined;

  let count = 1;
  if (body.count !== undefined) {
    const parsed = Number(body.count);
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > 4) {
      return NextResponse.json({ success: false, error: 'count 必须为 1-4 的整数' }, { status: 400 });
    }
    count = parsed;
  }

  const preferences = await getProjectPreferences(asset.projectId);

  let modelId: string | null = null;
  if (requestedChannelId) {
    const { selectImageModel } = await import('@/lib/image-model-selector');
    const selection = await selectImageModel({
      channelId: requestedChannelId,
      aspectRatio: requestedAspectRatio,
      imageSize: requestedImageSize,
      hasReferenceImage: false,
      imageCount: count,
    });
    if (!selection) {
      return NextResponse.json({ success: false, error: '所选渠道无可用模型' }, { status: 400 });
    }
    modelId = selection.model.id;
  } else {
    modelId = preferences?.defaultImageModelId ?? null;
  }

  if (!modelId) {
    return NextResponse.json({ success: false, error: '未配置图像模型' }, { status: 400 });
  }

  const modelConfig = await getImageModelWithChannel(modelId);
  if (!modelConfig) {
    return NextResponse.json({ success: false, error: '图像模型不存在' }, { status: 404 });
  }

  const { model, channel } = modelConfig;
  if (!model.enabled || !channel.enabled) {
    return NextResponse.json({ success: false, error: '图像模型或渠道已禁用' }, { status: 400 });
  }

  const preferredRatio = getPreferredRatio(asset.type, preferences);
  const aspectRatio = requestedAspectRatio || preferredRatio || model.defaultAspectRatio || DEFAULT_RATIOS[asset.type];
  const imageSize = requestedImageSize || model.defaultImageSize || undefined;

  const user = await getUserById(session.user.id);
  if (!user) {
    return NextResponse.json({ success: false, error: '用户不存在' }, { status: 401 });
  }

  const totalCost = model.costPerGeneration * count;
  if (user.balance < totalCost) {
    return NextResponse.json({ success: false, error: '余额不足' }, { status: 402 });
  }

  const concurrencyCheck = await checkUserConcurrencyLimit(session.user.id);
  if (!concurrencyCheck.allowed) {
    return NextResponse.json({ success: false, error: concurrencyCheck.message }, { status: 429 });
  }

  const generateRequest: ImageGenerateRequest = { modelId, prompt, aspectRatio, imageSize };
  const tasks: Array<{ generationId: string; historyId: string }> = [];

  for (let i = 0; i < count; i++) {
    try {
      await updateUserBalance(user.id, -model.costPerGeneration, 'strict');
    } catch (err) {
      if (err instanceof Error && err.message.includes('Insufficient balance')) {
        if (tasks.length === 0) {
          return NextResponse.json({ success: false, error: '余额不足' }, { status: 402 });
        }
        break;
      }
      throw err;
    }

    let generation;
    try {
      generation = await saveGeneration({
        userId: user.id,
        type: 'gemini-image',
        prompt,
        params: { model: model.apiModel, aspectRatio, imageSize },
        resultUrl: '',
        cost: model.costPerGeneration,
        status: 'pending',
        balancePrecharged: true,
        balanceRefunded: false,
      });
    } catch (saveErr) {
      await updateUserBalance(user.id, model.costPerGeneration, 'strict').catch(() => {});
      if (tasks.length === 0) throw saveErr;
      break;
    }

    try {
      const history = await createAssetGenerationHistory({
        assetId: asset.id,
        generationId: generation.id,
        prompt,
        channelId: channel.id,
        modelId,
        aspectRatio,
        imageSize,
        imageCount: 1,
        status: 'pending',
      });
      tasks.push({ generationId: generation.id, historyId: history.id });
    } catch (historyErr) {
      await updateGeneration(generation.id, { status: 'failed', errorMessage: 'History creation failed' }).catch(() => {});
      await refundGenerationBalance(generation.id, user.id, model.costPerGeneration).catch(() => {});
      if (tasks.length === 0) throw historyErr;
      break;
    }
  }

  if (tasks.length === 0) {
    return NextResponse.json({ success: false, error: '创建生成任务失败' }, { status: 500 });
  }

  await updateProjectAsset(asset.id, { generationId: tasks[0].generationId }).catch(() => {});

  tasks.forEach((task, index) => {
    processAssetImage(
      task.generationId,
      task.historyId,
      user.id,
      asset.id,
      generateRequest,
      model.costPerGeneration,
      index === 0,
    ).catch(err => console.error('[Asset Image] Background task failed:', err));
  });

  return NextResponse.json({
    success: true,
    data: {
      tasks: tasks.map(t => ({ historyId: t.historyId, generationId: t.generationId, status: 'pending' })),
      requestedCount: count,
      acceptedCount: tasks.length,
    },
  });
}, { rateLimit: { scope: 'GENERATE', route: 'generate-asset-image' } });
