import { NextResponse } from 'next/server';
import { authHandler } from '@/lib/api-handler';
import {
  checkProjectAccess,
  getProjectAssetById,
  getAssetOccurrencesWithEpisode,
  getAssetGenerationHistory,
  getAssetGenerationHistoryCount,
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
  const includeHistory = url.searchParams.get('includeHistory') === 'true';
  const includeOccurrences = url.searchParams.get('includeOccurrences') !== 'false';

  const exportData: Record<string, unknown> = {
    asset,
    exportedAt: Date.now(),
    exportedBy: session.user.id,
  };

  if (includeOccurrences) {
    exportData.occurrences = await getAssetOccurrencesWithEpisode(assetId);
  }

  if (includeHistory) {
    const total = await getAssetGenerationHistoryCount(assetId);
    const historyLimit = 200;
    const history = await getAssetGenerationHistory(assetId, { limit: historyLimit });
    exportData.history = history;
    exportData.historyTotal = total;
    exportData.historyTruncated = total > historyLimit;
  }

  return NextResponse.json({ success: true, data: exportData });
});
