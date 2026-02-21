'use client';

import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { AssetGalleryTab } from '../tabs/asset-gallery-tab';
import type { ProjectAsset, AssetGenerationHistory } from '@/lib/db-comic';

interface AssetGalleryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  asset: ProjectAsset;
  onSetPrimary: (historyId: string, imageUrl: string) => void;
  onEdit: (history: AssetGenerationHistory) => void;
  refreshKey?: number;
}

export function AssetGalleryDialog({
  open,
  onOpenChange,
  asset,
  onSetPrimary,
  onEdit,
  refreshKey,
}: AssetGalleryDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl h-[80vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-6 py-4 border-b">
          <DialogTitle>生成历史图库</DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto p-6">
          <AssetGalleryTab
            asset={asset}
            onSetPrimary={onSetPrimary}
            onEdit={onEdit}
            refreshKey={refreshKey}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
