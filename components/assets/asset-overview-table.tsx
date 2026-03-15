'use client';

import * as React from 'react';
import type { ProjectAsset, ProjectAssetType } from '@/lib/db-comic';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Search,
  Sparkles,
  Trash2,
  ImagePlus,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { AssetCardVisual } from '@/components/assets/asset-card-visual';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

import type { AssetFilterType } from '@/lib/stores/workspace-store';

interface AssetOverviewTableProps {
  assets: ProjectAsset[];
  filter: AssetFilterType;
  onFilterChange: (filter: AssetFilterType) => void;
  onSelectAsset: (id: string) => void;
  onAnalyze: (types?: ProjectAssetType[]) => void;
  onClear: (types?: ProjectAssetType[]) => void;
  showAnalyzeButton: boolean;
  showClearButton: boolean;
  onAttachAsset?: (assetId: string) => void;
  onUploadImage?: (assetId: string, file: File) => void;
  onReplaceImage?: (assetId: string, imageUrl: string) => void;
}

interface AssetDragPayload {
  v: number;
  source: string;
  assetId: string;
  primaryImageUrl: string | null;
}

function parseSanhubAsset(e: React.DragEvent): AssetDragPayload | null {
  const raw = e.dataTransfer.getData('application/x-sanhub-asset');
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

type FilterType = AssetFilterType;

export function AssetOverviewTable({
  assets,
  filter,
  onFilterChange,
  onSelectAsset,
  onAnalyze,
  onClear,
  showAnalyzeButton,
  showClearButton,
  onAttachAsset,
  onUploadImage,
  onReplaceImage,
}: AssetOverviewTableProps) {
  const [search, setSearch] = React.useState('');
  const [clearConfirmOpen, setClearConfirmOpen] = React.useState(false);
  const [dragTarget, setDragTarget] = React.useState<string | 'container' | null>(null);
  const dragLeaveTimer = React.useRef<ReturnType<typeof setTimeout>>();

  const filtered = React.useMemo(() => {
    let result = assets;
    if (filter !== 'all') {
      result = result.filter(a => a.type === filter);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(a =>
        a.name.toLowerCase().includes(q) ||
        a.description?.toLowerCase().includes(q)
      );
    }
    return result;
  }, [assets, filter, search]);

  const counts = React.useMemo(() => {
    const c = { character: 0, scene: 0, prop: 0 };
    for (const a of assets) {
      if (a.type in c) c[a.type as keyof typeof c]++;
    }
    return c;
  }, [assets]);

  const filters: { key: FilterType; label: string }[] = [
    { key: 'all', label: `全部 (${assets.length})` },
    { key: 'character', label: `角色 (${counts.character})` },
    { key: 'scene', label: `场景 (${counts.scene})` },
    { key: 'prop', label: `道具 (${counts.prop})` },
  ];

  const filterLabelMap: Record<FilterType, string> = {
    all: '全部',
    character: '角色',
    scene: '场景',
    prop: '道具',
  };
  const currentFilterLabel = filterLabelMap[filter];
  const clearTarget = filter === 'all'
    ? '当前剧集的全部资产'
    : `当前剧集的${currentFilterLabel}资产`;

  const handleContainerDragOver = (e: React.DragEvent) => {
    const hasSanhub = e.dataTransfer.types.includes('application/x-sanhub-asset');
    if (!hasSanhub) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    clearTimeout(dragLeaveTimer.current);
    if (dragTarget !== 'container') setDragTarget('container');
  };

  const handleContainerDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragTarget(null);
    const payload = parseSanhubAsset(e);
    if (payload && onAttachAsset) {
      onAttachAsset(payload.assetId);
    }
  };

  const handleCardDragOver = (e: React.DragEvent, assetId: string) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'copy';
    clearTimeout(dragLeaveTimer.current);
    if (dragTarget !== assetId) setDragTarget(assetId);
  };

  const handleCardDrop = (e: React.DragEvent, assetId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setDragTarget(null);

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      const file = files[0];
      if (file.type.startsWith('image/') && onUploadImage) {
        onUploadImage(assetId, file);
      }
      return;
    }

    const payload = parseSanhubAsset(e);
    if (payload?.primaryImageUrl && onReplaceImage) {
      onReplaceImage(assetId, payload.primaryImageUrl);
    }
  };

  const handleDragLeave = () => {
    clearTimeout(dragLeaveTimer.current);
    dragLeaveTimer.current = setTimeout(() => setDragTarget(null), 50);
  };

  return (
    <div
      className={cn(
        'flex-1 flex flex-col overflow-hidden relative transition-colors',
        dragTarget === 'container' && 'bg-primary/5'
      )}
      onDragOver={handleContainerDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleContainerDrop}
    >
      {dragTarget === 'container' && (
        <div className="absolute inset-0 z-50 flex items-center justify-center border-2 border-dashed border-primary m-4 rounded-xl bg-background/50 backdrop-blur-sm pointer-events-none">
          <div className="flex flex-col items-center gap-2 text-primary font-medium">
            <ImagePlus className="h-8 w-8 animate-pulse" />
            <span>松开以关联资产</span>
          </div>
        </div>
      )}
      <div className="flex items-center justify-between gap-4 p-4 border-b border-white/[0.06] shrink-0">
        <div className="flex items-center gap-2">
          {filters.map(f => (
            <button
              key={f.key}
              onClick={() => onFilterChange(f.key)}
              className={cn(
                'px-3 py-1.5 rounded-md text-sm transition-colors',
                filter === f.key
                  ? 'bg-primary/10 text-primary font-medium'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="搜索资产..."
              className="pl-8 w-[200px] h-9"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          {showClearButton && (
            <Button
              size="sm"
              onClick={() => setClearConfirmOpen(true)}
              className="gap-1.5 bg-red-600/15 text-red-200 hover:bg-red-600/25 border border-red-500/30"
            >
              <Trash2 className="h-3.5 w-3.5" />
              {filter === 'all' ? '清除全部' : `清除${currentFilterLabel}`}
            </Button>
          )}
          {showAnalyzeButton && (
            <Button
              size="sm"
              onClick={() => onAnalyze(filter === 'all' ? undefined : [filter])}
              className="gap-1.5 bg-purple-600/15 text-purple-200 hover:bg-purple-600/25 border border-purple-500/30"
            >
              <Sparkles className="h-3.5 w-3.5" />
              {filter === 'all' ? '重新分析' : `重新分析${currentFilterLabel}`}
            </Button>
          )}
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4">
          {filtered.length === 0 ? (
            <div className="text-center text-sm text-muted-foreground py-12">
              {search ? '没有匹配的资产' : '暂无资产数据'}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {filtered.map(asset => {
                const isDragOver = dragTarget === asset.id;
                return (
                  <div
                    key={asset.id}
                    onDragOver={(e) => handleCardDragOver(e, asset.id)}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => handleCardDrop(e, asset.id)}
                  >
                    <button
                      className="w-full text-left focus-visible:ring-2 focus-visible:ring-primary rounded-xl"
                      onClick={() => onSelectAsset(asset.id)}
                      title={asset.description || asset.name}
                    >
                      <AssetCardVisual
                        name={asset.name}
                        type={asset.type}
                        imageUrl={asset.primaryImageUrl}
                        isDragOver={isDragOver}
                        size="md"
                        dragOverContent={
                          <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/50 backdrop-blur-[1px] text-white font-medium pointer-events-none">
                            <span className="flex items-center gap-2">
                              <ImagePlus className="w-4 h-4" />
                              替换图片
                            </span>
                          </div>
                        }
                      />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </ScrollArea>

      <AlertDialog open={clearConfirmOpen} onOpenChange={setClearConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认清除资产？</AlertDialogTitle>
            <AlertDialogDescription>
              即将清除{clearTarget}的关联数据。此操作不可撤销，但您可以通过重新分析来恢复。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => onClear(filter === 'all' ? undefined : [filter])}
            >
              确认清除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
