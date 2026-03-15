'use client';

import * as React from 'react';
import type { ProjectAsset, AssetGenerationHistory } from '@/lib/db-comic';
import { apiGet, apiPost, ApiClientError } from '@/lib/api-client';
import { CreationToolbar } from '@/components/assets/creation-toolbar';
import { AssetHistoryStrip } from '@/components/assets/asset-history-strip';
import { AssetGalleryDialog } from '../modals/asset-gallery-dialog';
import { useImageGenerationConfig } from '@/lib/hooks/use-image-generation-config';
import { ImageIcon, History } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface AssetStudioTabProps {
  asset: ProjectAsset;
  onGenerationComplete: () => void;
  onSetPrimary: (historyId: string, imageUrl: string) => void;
  onEditFromGallery: (history: AssetGenerationHistory) => void;
  refreshKey?: number;
}

export function AssetStudioTab({
  asset,
  onGenerationComplete,
  onSetPrimary,
  onEditFromGallery,
  refreshKey,
}: AssetStudioTabProps) {
  const config = useImageGenerationConfig();
  const [prompt, setPrompt] = React.useState('');
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [error, setError] = React.useState('');
  const [galleryOpen, setGalleryOpen] = React.useState(false);

  const refreshHistory = React.useCallback(() => {
    (window as any)[`__refreshHistory_${asset.id}`]?.();
  }, [asset.id]);

  const handleGalleryOpenChange = React.useCallback((open: boolean) => {
    setGalleryOpen(open);
    if (!open) refreshHistory();
  }, [refreshHistory]);

  // Prompt Chain: 默认文本 = 最新历史 prompt 或 descriptors
  React.useEffect(() => {
    (async () => {
      try {
        const data = await apiGet<AssetGenerationHistory[]>(`/api/assets/${asset.id}/image-history?limit=1`);
        if (data?.length > 0 && data[0].prompt) {
          setPrompt(data[0].prompt);
        } else {
          const descriptors = (asset.attributes as Record<string, unknown>)?.descriptors;
          setPrompt(typeof descriptors === 'string' ? descriptors : '');
        }
      } catch { /* ignore */ }
    })();
  }, [asset.id, asset.attributes]);

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    setIsSubmitting(true);
    setError('');

    try {
      await apiPost(`/api/assets/${asset.id}/generate-image`, {
        prompt: prompt.trim(),
        channelId: config.selectedChannelId || undefined,
        aspectRatio: config.aspectRatio,
        imageSize: config.imageSize || undefined,
        count: config.count,
      });

      onGenerationComplete();
      refreshHistory();
    } catch (err) {
      if (err instanceof ApiClientError) {
        setError(err.message);
      } else {
        setError('网络错误');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-4 max-w-3xl mx-auto">
      {/* 当前主图预览（小尺寸参考图） */}
      <div className="flex items-start gap-4">
        <div className="w-20 h-20 shrink-0 rounded-lg overflow-hidden border border-white/[0.08] bg-muted/20">
          {asset.primaryImageUrl ? (
            <img
              src={asset.primaryImageUrl}
              alt={asset.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <ImageIcon className="h-6 w-6 text-muted-foreground/30" />
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0 pt-1">
          <h4 className="text-sm font-medium truncate">{asset.name}</h4>
          <p className="text-xs text-muted-foreground mt-0.5">
            选择渠道和参数，输入提示词后生成图片
          </p>
        </div>
      </div>

      {/* 错误提示 */}
      {error && (
        <div className="text-sm text-red-400 bg-red-400/10 rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      {/* 创作工具栏 */}
      {config.isLoading ? (
        <div className="text-sm text-muted-foreground py-8 text-center">
          加载渠道配置...
        </div>
      ) : (
        <CreationToolbar
          channels={config.channels}
          currentModel={config.currentModel}
          selectedChannelId={config.selectedChannelId}
          onChannelChange={config.setSelectedChannelId}
          aspectRatio={config.aspectRatio}
          onAspectRatioChange={config.setAspectRatio}
          availableRatios={config.availableRatios}
          imageSize={config.imageSize}
          onImageSizeChange={config.setImageSize}
          availableSizes={config.availableSizes}
          count={config.count}
          onCountChange={config.setCount}
          prompt={prompt}
          onPromptChange={setPrompt}
          onSubmit={handleGenerate}
          isSubmitting={isSubmitting}
        />
      )}

      {/* 历史记录条 */}
      <div className="pt-6 border-t border-white/[0.06] space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-medium flex items-center gap-2">
            <History className="h-4 w-4 text-muted-foreground" />
            生成历史
          </h4>
          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setGalleryOpen(true)}>
            查看全部
          </Button>
        </div>
        <div className="overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-0">
          <div className="flex gap-3 min-w-min">
            <AssetHistoryStrip
              assetId={asset.id}
              currentPrimaryUrl={asset.primaryImageUrl}
              onSetPrimary={onSetPrimary}
              onEdit={onEditFromGallery}
              refreshKey={refreshKey}
            />
          </div>
        </div>
      </div>

      <AssetGalleryDialog
        open={galleryOpen}
        onOpenChange={handleGalleryOpenChange}
        asset={asset}
        onSetPrimary={onSetPrimary}
        onEdit={onEditFromGallery}
        refreshKey={refreshKey}
      />
    </div>
  );
}
