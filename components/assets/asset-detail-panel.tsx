'use client';

import * as React from 'react';
import type { ProjectAsset, AssetGenerationHistory } from '@/lib/db-comic';
import { apiGet, apiPatch } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import {
  ArrowLeft,
  ImageIcon,
  Save,
  Upload,
  Wand2,
  Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { typeConfig, attributeLabels } from '@/components/assets/asset-schema';
import { AssetHistoryStrip } from './asset-history-strip';
import { AssetEditModal } from './asset-edit-modal';

interface AssetDetailPanelProps {
  asset: ProjectAsset;
  onBack: () => void;
  onUpdate: (updates: Partial<ProjectAsset>) => void;
  onGenerateImage: () => void;
  onUploadImage?: (file: File) => void;
}

export function AssetDetailPanel({
  asset,
  onBack,
  onUpdate,
  onGenerateImage,
  onUploadImage,
}: AssetDetailPanelProps) {
  const [name, setName] = React.useState(asset.name);
  const [isDirty, setIsDirty] = React.useState(false);
  const [isHistoryDragOver, setIsHistoryDragOver] = React.useState(false);
  const [editModalOpen, setEditModalOpen] = React.useState(false);
  const [defaultPrompt, setDefaultPrompt] = React.useState('');
  const [historyCount, setHistoryCount] = React.useState(0);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    setName(asset.name);
    setIsDirty(false);
  }, [asset.id, asset.name]);

  // Fetch latest prompt for Prompt Chain
  React.useEffect(() => {
    (async () => {
      try {
        const data = await apiGet<AssetGenerationHistory[]>(`/api/assets/${asset.id}/image-history?limit=1`);
        setHistoryCount(Array.isArray(data) ? data.length : 0);
        if (data?.length > 0 && data[0].prompt) {
          setDefaultPrompt(data[0].prompt);
        } else {
          const descriptors = (asset.attributes as Record<string, unknown>)?.descriptors;
          setDefaultPrompt(typeof descriptors === 'string' ? descriptors : '');
        }
      } catch { /* ignore */ }
    })();
  }, [asset.id, asset.attributes]);

  const handleSave = () => {
    onUpdate({ name: name.trim() || asset.name });
    setIsDirty(false);
  };

  const handleImageUpload = (file: File) => {
    if (!file.type.startsWith('image/')) return;
    if (onUploadImage) onUploadImage(file);
  };

  const handleSetPrimary = async (historyId: string, imageUrl: string) => {
    try {
      await apiPatch(`/api/assets/${asset.id}/primary-image`, { historyId });
      onUpdate({ primaryImageUrl: imageUrl } as Partial<ProjectAsset>);
    } catch (err) {
      console.error('Failed to set primary image:', err);
    }
  };

  const handleEditFromHistory = (history: AssetGenerationHistory) => {
    setDefaultPrompt(history.prompt);
    setEditModalOpen(true);
  };

  const openEditModal = () => {
    setEditModalOpen(true);
  };

  const refreshHistory = () => {
    const fn = (window as any)[`__refreshHistory_${asset.id}`];
    if (typeof fn === 'function') fn();
    // Re-fetch count
    apiGet<AssetGenerationHistory[]>(`/api/assets/${asset.id}/image-history?limit=1`)
      .then(d => { if (d) setHistoryCount(d.length); })
      .catch(() => {});
  };

  // Drag-drop from history strip to hero image
  const handleHistoryDragOver = (e: React.DragEvent) => {
    if (e.dataTransfer.types.includes('application/x-sanhub-history')) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
      setIsHistoryDragOver(true);
    }
  };

  const handleHistoryDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsHistoryDragOver(false);
    const raw = e.dataTransfer.getData('application/x-sanhub-history');
    if (!raw) return;
    try {
      const { historyId, imageUrl } = JSON.parse(raw);
      if (imageUrl) handleSetPrimary(historyId, imageUrl);
    } catch { /* ignore */ }
  };

  const config = typeConfig[asset.type];
  const Icon = config.icon;
  const descriptors = (asset.attributes as Record<string, unknown>)?.descriptors;

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* ===== Header ===== */}
      <div className="flex items-center gap-3 p-4 border-b border-white/[0.06] shrink-0">
        <Button variant="ghost" size="icon" onClick={onBack} className="h-8 w-8">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className={cn('p-1.5 rounded-md', config.bgColor)}>
          <Icon className={cn('h-4 w-4', config.color)} />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-sm truncate">{asset.name}</h3>
          <span className="text-xs text-muted-foreground">{config.label}</span>
        </div>
        {isDirty && (
          <Button size="sm" onClick={handleSave} className="gap-1.5">
            <Save className="h-3.5 w-3.5" />
            保存
          </Button>
        )}
      </div>

      {/* ===== Upper Section: Two-Column ===== */}
      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[280px_1fr] overflow-hidden">
        {/* Left Column: Fields + Actions */}
        <div className="p-6 space-y-5 border-r border-white/[0.06] overflow-y-auto">
          <div className="space-y-2">
            <label className="text-sm font-medium">名称</label>
            <Input
              value={name}
              onChange={e => { setName(e.target.value); setIsDirty(true); }}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">绘图描述词</label>
            <div className="text-sm text-muted-foreground bg-card/40 rounded-lg p-3 min-h-[60px]">
              {typeof descriptors === 'string' && descriptors ? descriptors : '暂无描述词'}
            </div>
          </div>

          <div className="space-y-2 pt-2">
            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              accept="image/*"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleImageUpload(file);
                e.target.value = '';
              }}
            />
            {onUploadImage && (
              <Button
                variant="outline"
                size="sm"
                className="w-full gap-1.5"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="h-3.5 w-3.5" />
                上传图片
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              className="w-full gap-1.5"
              onClick={openEditModal}
            >
              <Sparkles className="h-3.5 w-3.5" />
              AI 生成图片
            </Button>
          </div>
        </div>

        {/* Right Column: Hero Image + Drop Zone */}
        <div
          className="relative flex items-center justify-center p-4 overflow-hidden"
          onDragOver={handleHistoryDragOver}
          onDragLeave={() => setIsHistoryDragOver(false)}
          onDrop={handleHistoryDrop}
        >
          {isHistoryDragOver && (
            <div className="absolute inset-4 z-10 border-2 border-dashed border-primary rounded-lg bg-primary/10 backdrop-blur-sm flex items-center justify-center pointer-events-none">
              <span className="text-primary font-medium">松开以替换主图</span>
            </div>
          )}
          {asset.primaryImageUrl ? (
            <div className="relative group rounded-lg overflow-hidden max-h-full">
              <img
                src={asset.primaryImageUrl}
                alt={asset.name}
                className="max-w-full max-h-full object-contain rounded-lg"
              />
              <div className="absolute inset-0 bg-black/40 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center rounded-lg">
                <Button onClick={openEditModal} className="gap-2">
                  <Wand2 className="h-4 w-4" />
                  编辑图片
                </Button>
              </div>
            </div>
          ) : (
            <div className="w-full aspect-video max-w-lg bg-muted/20 rounded-lg border border-dashed border-white/[0.08] flex flex-col items-center justify-center gap-2 text-muted-foreground">
              <ImageIcon className="h-10 w-10 opacity-30" />
              <span className="text-sm">暂无图片</span>
            </div>
          )}
        </div>
      </div>

      {/* ===== Lower Section: History Strip ===== */}
      <div className="shrink-0 border-t border-white/[0.06]">
        <div className="px-4 py-2 flex items-center justify-between">
          <h4 className="text-sm font-medium">历史记录</h4>
          <span className="text-xs text-muted-foreground">{historyCount} 条</span>
        </div>
        <ScrollArea className="w-full">
          <div className="flex gap-3 px-4 pb-3">
            <AssetHistoryStrip
              assetId={asset.id}
              currentPrimaryUrl={asset.primaryImageUrl}
              onSetPrimary={handleSetPrimary}
              onEdit={handleEditFromHistory}
            />
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </div>

      {/* Edit Modal */}
      <AssetEditModal
        open={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        asset={asset}
        defaultPrompt={defaultPrompt}
        currentImageUrl={asset.primaryImageUrl}
        onGenerationComplete={refreshHistory}
      />
    </div>
  );
}
