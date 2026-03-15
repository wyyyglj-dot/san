import { NextResponse } from 'next/server';
import { authHandler } from '@/lib/api-handler';
import {
  checkProjectAccess,
  createAssetOccurrence,
  getAssetOccurrences,
  getComicEpisodeById,
  getEpisodeAssets,
  getProjectAssetById,
} from '@/lib/db-comic';

export const dynamic = 'force-dynamic';

export const GET = authHandler(async (req, ctx, session) => {
  const { episodeId } = ctx.params;
  const episode = await getComicEpisodeById(episodeId);
  if (!episode || episode.deletedAt) {
    return NextResponse.json({ success: false, error: '剧集不存在' }, { status: 404 });
  }

  const access = await checkProjectAccess(episode.projectId, session.user.id);
  if (!access) {
    return NextResponse.json({ success: false, error: '无权限' }, { status: 403 });
  }

  const assets = await getEpisodeAssets(episodeId);
  return NextResponse.json({ success: true, data: assets });
});

export const POST = authHandler(async (req, ctx, session) => {
  const { episodeId } = ctx.params;
  const episode = await getComicEpisodeById(episodeId);
  if (!episode || episode.deletedAt) {
    return NextResponse.json(
      { success: false, error: '剧集不存在' },
      { status: 404 },
    );
  }

  const access = await checkProjectAccess(episode.projectId, session.user.id);
  if (!access) {
    return NextResponse.json(
      { success: false, error: '无权限' },
      { status: 403 },
    );
  }

  const body = await req.json().catch(() => ({}));
  const assetId =
    typeof body.assetId === 'string' ? body.assetId.trim() : '';
  if (!assetId) {
    return NextResponse.json(
      { success: false, error: '缺少资产ID' },
      { status: 400 },
    );
  }

  const asset = await getProjectAssetById(assetId);
  if (!asset || asset.deletedAt) {
    return NextResponse.json(
      { success: false, error: '资产不存在' },
      { status: 404 },
    );
  }
  if (asset.projectId !== episode.projectId) {
    return NextResponse.json(
      { success: false, error: '跨项目关联不允许' },
      { status: 400 },
    );
  }

  const existing = await getAssetOccurrences(assetId, {
    episodeId,
    limit: 1,
  });
  const attached = existing.length === 0;
  if (attached) {
    await createAssetOccurrence({ assetId, episodeId });
  }

  return NextResponse.json({ success: true, data: asset, attached });
});
