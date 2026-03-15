import { NextResponse } from 'next/server';
import { authHandler } from '@/lib/api-handler';
import {
  checkProjectAccess,
  getAssetGenerationHistory,
  getAssetGenerationHistoryCount,
  getProjectAssetById,
  deleteAssetGenerationHistoryByIds,
  deleteAllAssetGenerationHistory,
} from '@/lib/db-comic';

export const dynamic = 'force-dynamic';

export const GET = authHandler(async (req, ctx, session) => {
  const { assetId } = ctx.params;
  const asset = await getProjectAssetById(assetId);
  if (!asset || asset.deletedAt) {
    return NextResponse.json({ success: false, error: '资产不存在' }, { status: 404 });
  }

  const access = await checkProjectAccess(asset.projectId, session.user.id);
  if (!access) {
    return NextResponse.json({ success: false, error: '无权限' }, { status: 403 });
  }

  const url = new URL(req.url, 'http://localhost');
  const limit = Math.min(
    Math.max(parseInt(url.searchParams.get('limit') || '20', 10) || 20, 1),
    100,
  );
  const offset = Math.max(
    parseInt(url.searchParams.get('offset') || '0', 10) || 0,
    0,
  );

  const [history, total] = await Promise.all([
    getAssetGenerationHistory(assetId, { limit, offset }),
    getAssetGenerationHistoryCount(assetId),
  ]);

  return NextResponse.json({
    success: true,
    data: history,
    pagination: { limit, offset, total, hasMore: offset + history.length < total },
  });
});

export const DELETE = authHandler(async (req, ctx, session) => {
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

  let deleted = 0;

  if (body.all === true) {
    deleted = await deleteAllAssetGenerationHistory(assetId);
  } else if (Array.isArray(body.ids) && body.ids.length > 0) {
    const ids = body.ids
      .filter((id: unknown) => typeof id === 'string' && id.trim())
      .slice(0, 100);
    if (ids.length === 0) {
      return NextResponse.json({ success: false, error: '无效的 ID 列表' }, { status: 400 });
    }
    deleted = await deleteAssetGenerationHistoryByIds(assetId, ids);
  } else {
    return NextResponse.json(
      { success: false, error: '请提供 ids 数组或 all: true' },
      { status: 400 },
    );
  }

  return NextResponse.json({ success: true, deleted });
});
