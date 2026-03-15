'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { CheckCircle2, Wand2, ImageIcon, Loader2, RotateCcw } from 'lucide-react';
import type { AssetGenerationHistory } from '@/lib/db-comic';
import { apiGet } from '@/lib/api-client';

interface AssetHistoryStripProps {
  assetId: string;
  currentPrimaryUrl: string | null;
  onSetPrimary: (historyId: string, imageUrl: string) => void;
  onEdit: (history: AssetGenerationHistory) => void;
  refreshKey?: number;
}

export function AssetHistoryStrip({
  assetId,
  currentPrimaryUrl,
  onSetPrimary,
  onEdit,
  refreshKey,
}: AssetHistoryStripProps) {
  const [history, setHistory] = React.useState<AssetGenerationHistory[]>([]);
  const [total, setTotal] = React.useState(0);
  const [loading, setLoading] = React.useState(true);

  const fetchHistory = React.useCallback(async () => {
    try {
      const data = await apiGet<AssetGenerationHistory[]>(`/api/assets/${assetId}/image-history?limit=50`);
      setHistory(data || []);
      setTotal(Array.isArray(data) ? data.length : 0);
    } catch (err) {
      console.error('Failed to fetch history:', err);
    } finally {
      setLoading(false);
    }
  }, [assetId]);

  React.useEffect(() => { fetchHistory(); }, [fetchHistory, refreshKey]);

  // Expose refresh for parent
  React.useEffect(() => {
    (window as any)[`__refreshHistory_${assetId}`] = fetchHistory;
    return () => { delete (window as any)[`__refreshHistory_${assetId}`]; };
  }, [assetId, fetchHistory]);

  const handleDragStart = (e: React.DragEvent, item: AssetGenerationHistory) => {
    if (!item.imageUrl) return;
    e.dataTransfer.setData('application/x-sanhub-history', JSON.stringify({
      v: 1,
      source: 'history-strip',
      historyId: item.id,
      imageUrl: item.imageUrl,
      prompt: item.prompt,
    }));
    e.dataTransfer.effectAllowed = 'copy';
    (e.currentTarget as HTMLElement).style.opacity = '0.5';
  };

  const handleDragEnd = (e: React.DragEvent) => {
    (e.currentTarget as HTMLElement).style.opacity = '1';
  };

  if (loading) {
    return (
      <div className="flex gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="w-24 h-24 shrink-0 rounded-lg bg-muted/30 animate-pulse" />
        ))}
      </div>
    );
  }

  if (history.length === 0) {
    return (
      <div className="flex items-center justify-center h-24 text-muted-foreground text-xs gap-2">
        <ImageIcon className="h-5 w-5 opacity-30" />
        <span>暂无生成历史</span>
      </div>
    );
  }

  return (
    <>
      {history.map((item) => (
        <div
          key={item.id}
          draggable={!!item.imageUrl}
          onDragStart={(e) => handleDragStart(e, item)}
          onDragEnd={handleDragEnd}
          className={cn(
            'relative group w-24 h-24 shrink-0 rounded-lg overflow-hidden border transition-all cursor-pointer',
            currentPrimaryUrl && item.imageUrl === currentPrimaryUrl
              ? 'ring-2 ring-primary border-primary'
              : 'border-white/[0.08] hover:border-white/[0.2]'
          )}
        >
          {item.status === 'completed' && item.imageUrl ? (
            <img
              src={item.imageUrl}
              alt={item.prompt}
              className="w-full h-full object-cover"
              loading="lazy"
            />
          ) : item.status === 'failed' ? (
            <div className="w-full h-full bg-red-950/30 flex flex-col items-center justify-center gap-1">
              <RotateCcw className="h-4 w-4 text-red-400" />
              <span className="text-[10px] text-red-400">失败</span>
            </div>
          ) : (
            <div className="w-full h-full bg-muted/30 flex items-center justify-center">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          )}

          {/* Hover actions */}
          {item.imageUrl && (
            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onSetPrimary(item.id, item.imageUrl!); }}
                className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors focus:outline-none focus:ring-2 focus:ring-primary"
                title="选为主图"
              >
                <CheckCircle2 className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onEdit(item); }}
                className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors focus:outline-none focus:ring-2 focus:ring-primary"
                title="编辑"
              >
                <Wand2 className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      ))}
    </>
  );
}
