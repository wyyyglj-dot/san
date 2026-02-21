import { NextResponse } from 'next/server';
import { authHandler } from '@/lib/api-handler';
import {
  checkProjectAccess,
  createAssetOccurrence,
  deleteAssetOccurrencesByEpisodeAndType,
  getComicEpisodes,
  getComicProjectById,
  getProjectAssets,
  getProjectPreferences,
  upsertProjectAsset,
  type ProjectAsset,
  type ProjectAssetType,
} from '@/lib/db-comic';
import { analyzeEpisodeAssets, type AssetAnalysisItem } from '@/lib/asset-analyzer';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

async function processItems(
  projectId: string,
  episodeId: string,
  type: ProjectAssetType,
  items: AssetAnalysisItem[],
  cache: Map<string, ProjectAsset>
): Promise<number> {
  let count = 0;
  for (const item of items) {
    const key = `${type}:${item.name.toLowerCase()}`;
    let asset = cache.get(key);
    if (!asset) {
      asset = await upsertProjectAsset({
        projectId,
        type,
        name: item.name,
        description: item.description ?? undefined,
        attributes: item.attributes ?? undefined,
      });
      cache.set(key, asset);
    }
    await createAssetOccurrence({
      assetId: asset.id,
      episodeId,
      sourceText: item.sourceText ?? null,
      confidence: item.confidence,
    });
    count++;
  }
  return count;
}

export const POST = authHandler(async (req, ctx, session) => {
    const { id } = ctx.params;
    const project = await getComicProjectById(id);
    if (!project) {
      return NextResponse.json({ success: false, error: '项目不存在' }, { status: 404 });
    }

    const access = await checkProjectAccess(id, session.user.id);
    if (!access) {
      return NextResponse.json({ success: false, error: '无权限' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const episodeIds: string[] | undefined = Array.isArray(body.episodeIds) ? body.episodeIds : undefined;
    const types: ProjectAssetType[] | undefined = Array.isArray(body.types)
      ? body.types.filter((t: unknown): t is ProjectAssetType =>
          t === 'character' || t === 'scene' || t === 'prop')
      : undefined;

    const preferences = await getProjectPreferences(id);
    const textModelId = (typeof body.textModelId === 'string' && body.textModelId.trim())
      ? body.textModelId.trim()
      : preferences?.defaultTextModelId ?? null;

    if (!textModelId) {
      return NextResponse.json({ success: false, error: '未配置文本模型，请先在项目设置中配置' }, { status: 400 });
    }

    const allEpisodes = await getComicEpisodes(id, { includeContent: true, limit: 500 });
    const targetEpisodes = episodeIds
      ? allEpisodes.filter(ep => episodeIds.includes(ep.id))
      : allEpisodes;

    if (targetEpisodes.length === 0) {
      return NextResponse.json({ success: false, error: '没有可分析的剧集' }, { status: 400 });
    }

    const assetCache = new Map<string, ProjectAsset>();
    let totalOccurrences = 0;
    let analyzedCount = 0;

    for (const episode of targetEpisodes) {
      if (!episode.content?.trim()) continue;

      let analysis;
      try {
        analysis = await analyzeEpisodeAssets(episode.content, textModelId);
      } catch (err) {
        console.error(`[Asset Analyze] Failed to analyze episode ${episode.id}:`, err);
        continue;
      }

      await deleteAssetOccurrencesByEpisodeAndType(episode.id, types);

      const shouldProcess = (type: ProjectAssetType) => !types || types.length === 0 || types.includes(type);
      if (shouldProcess('character')) {
        totalOccurrences += await processItems(id, episode.id, 'character', analysis.characters, assetCache);
      }
      if (shouldProcess('scene')) {
        totalOccurrences += await processItems(id, episode.id, 'scene', analysis.scenes, assetCache);
      }
      if (shouldProcess('prop')) {
        totalOccurrences += await processItems(id, episode.id, 'prop', analysis.props, assetCache);
      }
      analyzedCount++;
    }

    const assets = await getProjectAssets(id);

    return NextResponse.json({
      success: true,
      data: {
        assets,
        analyzed: analyzedCount,
        totalAssets: assets.length,
        totalOccurrences,
      },
    });
}, {
  fallbackMessage: '资产分析失败',
  context: '[API] Asset analyze',
});
