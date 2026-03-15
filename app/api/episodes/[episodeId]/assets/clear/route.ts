import { NextResponse } from 'next/server';
import { authHandler } from '@/lib/api-handler';
import {
  checkProjectAccess,
  deleteAssetOccurrencesByEpisodeAndType,
  getComicEpisodeById,
  type ProjectAssetType,
} from '@/lib/db-comic';

export const dynamic = 'force-dynamic';

const VALID_TYPES = new Set<ProjectAssetType>(['character', 'scene', 'prop']);

function parseTypes(value: unknown): ProjectAssetType[] | undefined | null {
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || value.length === 0) return value === null ? null : undefined;

  const parsed: ProjectAssetType[] = [];
  for (const item of value) {
    if (typeof item !== 'string' || !VALID_TYPES.has(item as ProjectAssetType)) return null;
    parsed.push(item as ProjectAssetType);
  }
  return Array.from(new Set(parsed));
}

export const POST = authHandler(async (req, ctx, session) => {
  const { episodeId } = ctx.params;
  const episode = await getComicEpisodeById(episodeId);
  if (!episode || episode.deletedAt) {
    return NextResponse.json({ success: false, error: '剧集不存在' }, { status: 404 });
  }

  const access = await checkProjectAccess(episode.projectId, session.user.id);
  if (!access) {
    return NextResponse.json({ success: false, error: '无权限' }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const types = parseTypes(body.types);
  if (types === null) {
    return NextResponse.json({ success: false, error: '无效的资产类型' }, { status: 400 });
  }

  const cleared = await deleteAssetOccurrencesByEpisodeAndType(episodeId, types);

  return NextResponse.json({ success: true, data: { cleared } });
}, {
  fallbackMessage: '清除资产失败',
  context: '[API] Episode assets clear',
});
