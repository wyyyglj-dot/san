'use client';

import * as React from 'react';
import type { ProjectAsset } from '@/lib/db-comic';
import { Film, ExternalLink } from 'lucide-react';
import { apiGet } from '@/lib/api-client';

interface AssetOccurrenceWithEpisode {
  id: string;
  assetId: string;
  episodeId: string;
  sourceText: string | null;
  confidence: number | null;
  createdAt: number;
  episodeTitle: string;
  episodeOrderNum: number;
}

interface AssetEpisodesTabProps {
  asset: ProjectAsset;
}

export function AssetEpisodesTab({ asset }: AssetEpisodesTabProps) {
  const [occurrences, setOccurrences] = React.useState<AssetOccurrenceWithEpisode[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    (async () => {
      try {
        const data = await apiGet<{ occurrences?: AssetOccurrenceWithEpisode[] }>(`/api/assets/${asset.id}`);
        if (data?.occurrences) {
          setOccurrences(data.occurrences);
        }
      } catch {
        /* ignore */
      } finally {
        setLoading(false);
      }
    })();
  }, [asset.id]);

  // 去重：同一个 episodeId 可能有多条 occurrence
  const uniqueEpisodes = React.useMemo(() => {
    const map = new Map<string, AssetOccurrenceWithEpisode>();
    for (const occ of occurrences) {
      if (!map.has(occ.episodeId)) {
        map.set(occ.episodeId, occ);
      }
    }
    return Array.from(map.values()).sort((a, b) => a.episodeOrderNum - b.episodeOrderNum);
  }, [occurrences]);

  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-16 rounded-lg bg-muted/30 animate-pulse" />
        ))}
      </div>
    );
  }

  if (uniqueEpisodes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3">
        <Film className="h-12 w-12 opacity-30" />
        <p className="text-sm">该资产未关联任何剧集</p>
        <p className="text-xs">当资产在剧集中被引用时，关联信息将自动显示在这里</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-2xl mx-auto">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium">关联剧集</h4>
        <span className="text-xs text-muted-foreground">
          共 {uniqueEpisodes.length} 个剧集
        </span>
      </div>

      <div className="space-y-2">
        {uniqueEpisodes.map((ep) => (
          <div
            key={ep.episodeId}
            className="flex items-center gap-3 p-3 rounded-lg border border-white/[0.06] bg-card/30 hover:bg-card/50 transition-colors group"
          >
            <div className="flex items-center justify-center w-8 h-8 rounded-md bg-muted/30 text-xs font-medium text-muted-foreground shrink-0">
              {ep.episodeOrderNum}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">
                {ep.episodeTitle || `第 ${ep.episodeOrderNum} 集`}
              </p>
              {ep.sourceText && (
                <p className="text-xs text-muted-foreground truncate mt-0.5">
                  {ep.sourceText}
                </p>
              )}
            </div>
            <ExternalLink className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
          </div>
        ))}
      </div>
    </div>
  );
}
