'use client';

import { useMemo, useCallback } from 'react';
import { StageWorkspace } from '@/components/episodes/stage-workspace';
import { useWorkspaceStore } from '@/lib/stores/workspace-store';
import type { ProjectAsset } from '@/lib/db-comic';

export function EpisodeWorkspaceView({ projectId }: { projectId: string }) {
  const episodes = useWorkspaceStore((s) => s.episodes);
  const selectedEpisodeId = useWorkspaceStore((s) => s.selectedEpisodeId);
  const selectedAssetId = useWorkspaceStore((s) => s.selectedAssetId);
  const setSelectedAssetId = useWorkspaceStore((s) => s.setSelectedAssetId);
  const projectAssets = useWorkspaceStore((s) => s.assets);
  const episodeAssets = useWorkspaceStore((s) => s.episodeAssets);
  const updateAsset = useWorkspaceStore((s) => s.updateAsset);
  const generateAssetImage = useWorkspaceStore((s) => s.generateAssetImage);

  const selectedEpisode = episodes.find((e) => e.id === selectedEpisodeId);

  const selectedAsset = useMemo(() => {
    if (!selectedAssetId) return null;
    return (
      episodeAssets?.find((a) => a.id === selectedAssetId) ??
      projectAssets.find((a) => a.id === selectedAssetId) ??
      null
    );
  }, [selectedAssetId, episodeAssets, projectAssets]);

  const handleUpdateAsset = useCallback(
    (updates: Partial<ProjectAsset>) => {
      if (selectedAssetId) {
        void updateAsset(selectedAssetId, updates);
      }
    },
    [selectedAssetId, updateAsset],
  );

  const handleGenerateImage = useCallback(() => {
    if (selectedAssetId) {
      void generateAssetImage(selectedAssetId);
    }
  }, [selectedAssetId, generateAssetImage]);

  return (
    <div className="h-full flex flex-col">
      <StageWorkspace
        selectedEpisode={selectedEpisode}
        selectedAsset={selectedAsset}
        onCloseAsset={() => setSelectedAssetId(null)}
        onUpdateAsset={handleUpdateAsset}
        onGenerateImage={handleGenerateImage}
      />
    </div>
  );
}
