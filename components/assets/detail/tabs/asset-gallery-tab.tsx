'use client';

import * as React from 'react';
import type { ProjectAsset, AssetGenerationHistory } from '@/lib/db-comic';
import { apiGet, apiDelete } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import {
  CheckCircle2, Wand2, Trash2, ImageIcon, Loader2,
  RotateCcw, CheckSquare, Square, X,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface AssetGalleryTabProps {
  asset: ProjectAsset;
  onSetPrimary: (historyId: string, imageUrl: string) => void;
  onEdit: (history: AssetGenerationHistory) => void;
  refreshKey?: number;
}

export function AssetGalleryTab({
  asset,
  onSetPrimary,
  onEdit,
  refreshKey = 0,
}: AssetGalleryTabProps) {
  const [history, setHistory] = React.useState<AssetGenerationHistory[]>([]);
  const [total, setTotal] = React.useState(0);
  const [loading, setLoading] = React.useState(true);
  const [loadingMore, setLoadingMore] = React.useState(false);
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());
  const [isSelectMode, setIsSelectMode] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState(false);

  const PAGE_SIZE = 20;

  const fetchHistory = React.useCallback(async (offset = 0, append = false) => {
    try {
      if (!append) setLoading(true);
      else setLoadingMore(true);

      const data = await apiGet<AssetGenerationHistory[]>(
        `/api/assets/${asset.id}/image-history?limit=${PAGE_SIZE}&offset=${offset}`
      );
      const list = data || [];
      setHistory(prev => append ? [...prev, ...list] : list);
      if (!append) setTotal(list.length < PAGE_SIZE ? list.length : list.length + 1);
    } catch (err) {
      console.error('Failed to fetch history:', err);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [asset.id]);

  React.useEffect(() => {
    fetchHistory(0, false);
  }, [fetchHistory, refreshKey]);

  const hasMore = history.length < total;

  const handleLoadMore = () => {
    fetchHistory(history.length, true);
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleBatchDelete = async () => {
    if (selectedIds.size === 0) return;
    setIsDeleting(true);
    try {
      await apiDelete(`/api/assets/${asset.id}/image-history`, {
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: Array.from(selectedIds) }),
      });
      setSelectedIds(new Set());
      setIsSelectMode(false);
      fetchHistory(0, false);
    } catch (err) {
      console.error('Batch delete failed:', err);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSingleDelete = async (id: string) => {
    try {
      await apiDelete(`/api/assets/${asset.id}/image-history`, {
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: [id] }),
      });
      fetchHistory(0, false);
    } catch (err) {
      console.error('Delete failed:', err);
    }
  };

  const handleDragStart = (e: React.DragEvent, item: AssetGenerationHistory) => {
    if (!item.imageUrl) return;
    e.dataTransfer.setData('application/x-sanhub-history', JSON.stringify({
      v: 1,
      source: 'gallery-tab',
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

  // 加载骨架屏
  if (loading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="aspect-square rounded-lg bg-muted/30 animate-pulse" />
        ))}
      </div>
    );
  }

  // 空状态
  if (history.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3">
        <ImageIcon className="h-12 w-12 opacity-30" />
        <p className="text-sm">暂无生成历史</p>
        <p className="text-xs">在「创作」Tab 中生成图片后，历史记录将显示在这里</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 工具栏 */}
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">
          共 {total} 条记录
        </span>
        <div className="flex items-center gap-2">
          {isSelectMode ? (
            <>
              <span className="text-xs text-muted-foreground">
                已选 {selectedIds.size} 项
              </span>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleBatchDelete}
                disabled={selectedIds.size === 0 || isDeleting}
                className="gap-1.5"
              >
                <Trash2 className="h-3.5 w-3.5" />
                {isDeleting ? '删除中...' : '批量删除'}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { setIsSelectMode(false); setSelectedIds(new Set()); }}
              >
                <X className="h-3.5 w-3.5" />
                取消
              </Button>
            </>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsSelectMode(true)}
              className="gap-1.5"
            >
              <CheckSquare className="h-3.5 w-3.5" />
              批量选择
            </Button>
          )}
        </div>
      </div>

      {/* 网格 */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
        {history.map((item) => {
          const isPrimary = asset.primaryImageUrl && item.imageUrl === asset.primaryImageUrl;
          const isSelected = selectedIds.has(item.id);

          return (
            <div
              key={item.id}
              draggable={!!item.imageUrl && !isSelectMode}
              onDragStart={(e) => handleDragStart(e, item)}
              onDragEnd={handleDragEnd}
              className={cn(
                'relative group aspect-square rounded-lg overflow-hidden border transition-all',
                isPrimary
                  ? 'ring-2 ring-primary border-primary'
                  : 'border-white/[0.08] hover:border-white/[0.2]',
                isSelected && 'ring-2 ring-blue-500 border-blue-500'
              )}
              onClick={() => {
                if (isSelectMode && item.imageUrl) toggleSelect(item.id);
              }}
            >
              {/* 图片内容 */}
              {item.status === 'completed' && item.imageUrl ? (
                <img
                  src={item.imageUrl}
                  alt={item.prompt}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              ) : item.status === 'failed' ? (
                <div className="w-full h-full bg-red-950/30 flex flex-col items-center justify-center gap-1">
                  <RotateCcw className="h-5 w-5 text-red-400" />
                  <span className="text-xs text-red-400">失败</span>
                </div>
              ) : (
                <div className="w-full h-full bg-muted/30 flex items-center justify-center">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              )}

              {/* 主图标记 */}
              {isPrimary && (
                <div className="absolute top-1.5 left-1.5 bg-primary text-primary-foreground text-[10px] px-1.5 py-0.5 rounded-full font-medium">
                  主图
                </div>
              )}

              {/* 批量选择 checkbox */}
              {isSelectMode && item.imageUrl && (
                <div className="absolute top-1.5 right-1.5 z-10">
                  {isSelected ? (
                    <CheckSquare className="h-5 w-5 text-blue-500" />
                  ) : (
                    <Square className="h-5 w-5 text-white/60" />
                  )}
                </div>
              )}

              {/* Hover 操作（非选择模式） */}
              {!isSelectMode && item.imageUrl && (
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity flex items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onSetPrimary(item.id, item.imageUrl!); }}
                    className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
                    title="选为主图"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onEdit(item); }}
                    className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
                    title="编辑"
                  >
                    <Wand2 className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); handleSingleDelete(item.id); }}
                    className="p-2 rounded-full bg-white/10 hover:bg-red-500/30 text-white transition-colors"
                    title="删除"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* 加载更多 */}
      {hasMore && (
        <div className="flex justify-center pt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleLoadMore}
            disabled={loadingMore}
            className="gap-1.5"
          >
            {loadingMore ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            {loadingMore ? '加载中...' : `加载更多 (${history.length}/${total})`}
          </Button>
        </div>
      )}
    </div>
  );
}