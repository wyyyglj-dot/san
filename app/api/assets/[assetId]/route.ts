import { NextResponse } from 'next/server';
import { authHandler } from '@/lib/api-handler';
import {
  checkProjectAccess,
  getComicProjectById,
  getProjectAssetById,
  getAssetOccurrencesWithEpisode,
  softDeleteProjectAsset,
  updateProjectAsset,
  type ProjectAssetType,
} from '@/lib/db-comic';

export const dynamic = 'force-dynamic';

function parseAssetType(value: string | null): ProjectAssetType | null {
  if (value === 'character' || value === 'scene' || value === 'prop') return value;
  return null;
}

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

  // 使用较高 limit 确保剧集关联数据完整（前端按 episodeId 去重后数量远小于此）
  const occurrences = await getAssetOccurrencesWithEpisode(assetId, { limit: 500 });
  return NextResponse.json({ success: true, data: asset, occurrences });
});

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
  const updates: Parameters<typeof updateProjectAsset>[1] = {};

  if (body.name !== undefined) {
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    if (!name) return NextResponse.json({ success: false, error: '资产名称不能为空' }, { status: 400 });
    if (name.length > 200) return NextResponse.json({ success: false, error: '资产名称过长' }, { status: 400 });
    updates.name = name;
  }
  if (body.description !== undefined) {
    updates.description = body.description === null ? null : (typeof body.description === 'string' ? body.description.trim() || null : null);
  }
  if (body.attributes !== undefined) {
    updates.attributes = body.attributes && typeof body.attributes === 'object' ? body.attributes : null;
  }
  if (body.primaryImageUrl !== undefined) {
    updates.primaryImageUrl = body.primaryImageUrl === null ? null : (typeof body.primaryImageUrl === 'string' ? body.primaryImageUrl : null);
  }
  if (body.sortOrder !== undefined && typeof body.sortOrder === 'number') {
    updates.sortOrder = body.sortOrder;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ success: false, error: '没有提供更新内容' }, { status: 400 });
  }

  const updated = await updateProjectAsset(assetId, updates);
  return NextResponse.json({ success: true, data: updated });
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

  await softDeleteProjectAsset(assetId);
  return NextResponse.json({ success: true });
});
