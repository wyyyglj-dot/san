import { NextResponse } from 'next/server';
import { authHandler } from '@/lib/api-handler';
import {
  checkProjectAccess,
  getAssetGenerationHistoryById,
  getProjectAssetById,
  updateProjectAsset,
} from '@/lib/db-comic';

export const dynamic = 'force-dynamic';

export const PATCH = authHandler(async (req, ctx, session) => {
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
  const historyId = typeof body.historyId === 'string' ? body.historyId.trim() : '';
  const directImageUrl = typeof body.imageUrl === 'string' ? body.imageUrl.trim() : '';

  let imageUrl = directImageUrl;
  let generationId: string | null = asset.generationId;

  if (historyId) {
    const history = await getAssetGenerationHistoryById(historyId);
    if (!history || history.assetId !== asset.id) {
      return NextResponse.json({ success: false, error: '历史记录不存在' }, { status: 404 });
    }
    if (!history.imageUrl) {
      return NextResponse.json({ success: false, error: '该记录无图片' }, { status: 400 });
    }
    imageUrl = history.imageUrl;
    generationId = history.generationId ?? generationId;
  }

  if (!imageUrl) {
    return NextResponse.json(
      { success: false, error: '需要提供 historyId 或 imageUrl' },
      { status: 400 },
    );
  }

  // URL 安全校验
  if (!imageUrl.startsWith('/')) {
    try {
      const parsed = new URL(imageUrl);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        return NextResponse.json({ success: false, error: '无效的图片 URL' }, { status: 400 });
      }
    } catch {
      return NextResponse.json({ success: false, error: '无效的图片 URL' }, { status: 400 });
    }
  }

  const updated = await updateProjectAsset(asset.id, { primaryImageUrl: imageUrl, generationId });
  if (!updated) {
    return NextResponse.json({ success: false, error: '更新失败' }, { status: 500 });
  }

  return NextResponse.json({ success: true, data: updated });
});
