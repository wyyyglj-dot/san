'use client';

import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { CreationToolbar } from '@/components/assets/creation-toolbar';
import { useImageGenerationConfig } from '@/lib/hooks/use-image-generation-config';
import { ImageIcon } from 'lucide-react';
import type { ProjectAsset } from '@/lib/db-comic';
import { apiPost, ApiClientError } from '@/lib/api-client';

interface AssetEditorDialogProps {
  open: boolean;
  onClose: () => void;
  asset: ProjectAsset;
  defaultPrompt: string;
  currentImageUrl: string | null;
  onGenerationComplete: () => void;
}

export function AssetEditorDialog({
  open,
  onClose,
  asset,
  defaultPrompt,
  currentImageUrl,
  onGenerationComplete,
}: AssetEditorDialogProps) {
  const config = useImageGenerationConfig();
  const [prompt, setPrompt] = React.useState('');
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [error, setError] = React.useState('');

  // 打开时同步 prompt
  React.useEffect(() => {
    if (open) {
      setPrompt(defaultPrompt);
      setError('');
    }
  }, [open, defaultPrompt]);

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
      onClose();
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
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-5xl max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden">
        {/* 图片预览区（更大） */}
        <div className="relative bg-black/30 flex items-center justify-center min-h-[240px] max-h-[50vh] overflow-hidden">
          {currentImageUrl ? (
            <img
              src={currentImageUrl}
              alt={asset.name}
              className="max-w-full max-h-[50vh] object-contain"
            />
          ) : (
            <div className="flex flex-col items-center gap-2 text-muted-foreground py-16">
              <ImageIcon className="h-12 w-12 opacity-30" />
              <span className="text-sm">暂无图片</span>
            </div>
          )}
        </div>

        {/* 创作面板 */}
        <div className="p-6 space-y-4 border-t border-white/[0.06] overflow-y-auto">
          <DialogHeader className="p-0">
            <DialogTitle className="text-base">精修图片 - {asset.name}</DialogTitle>
          </DialogHeader>

          {error && (
            <div className="text-sm text-red-400 bg-red-400/10 rounded-lg px-3 py-2">
              {error}
            </div>
          )}

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
        </div>
      </DialogContent>
    </Dialog>
  );
}
