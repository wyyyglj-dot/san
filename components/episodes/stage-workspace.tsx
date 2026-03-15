'use client';

import * as React from 'react';
import { LayoutTemplate } from 'lucide-react';
import type { Episode } from '@/components/episodes/types';
import type { ProjectAsset } from '@/lib/db-comic';
import { EpisodeOverview } from '@/components/episodes/views/episode-overview';
import { AssetDetailContainer } from '@/components/assets/detail/asset-detail-container';

interface StageWorkspaceProps {
  selectedEpisode: Episode | undefined;
  selectedAsset: ProjectAsset | null;
  onCloseAsset: () => void;
  onUpdateAsset: (updates: Partial<ProjectAsset>) => void;
  onGenerateImage: () => void;
}

export function StageWorkspace({
  selectedEpisode,
  selectedAsset,
  onCloseAsset,
  onUpdateAsset,
  onGenerateImage,
}: StageWorkspaceProps) {
  if (!selectedEpisode) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground bg-background/50">
        <div className="w-16 h-16 bg-muted/50 rounded-2xl flex items-center justify-center mb-4">
          <LayoutTemplate className="h-8 w-8 opacity-50" />
        </div>
        <p>请选择左侧剧集以开始工作</p>
      </div>
    );
  }

  if (selectedAsset) {
    return (
      <AssetDetailContainer
        asset={selectedAsset}
        onBack={onCloseAsset}
        onUpdate={onUpdateAsset}
        onGenerateImage={onGenerateImage}
      />
    );
  }

  return <EpisodeOverview episode={selectedEpisode} />;
}
