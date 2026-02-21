'use client';

import type { ProjectAsset, ProjectAssetType } from '@/lib/db-comic';
import type { AssetFilterType } from '@/lib/stores/workspace-store';
import { AssetEmptyState } from './asset-empty-state';
import { AssetAnalyzing } from './asset-analyzing';
import { AssetOverviewTable } from './asset-overview-table';
import { AssetDetailContainer } from './detail/asset-detail-container';

interface AssetWorkspaceProps {
  assets: ProjectAsset[];
  selectedAssetId: string | null;
  analysisStatus: 'idle' | 'analyzing' | 'done';
  hasAnalyzed: boolean;
  filter: AssetFilterType;
  onFilterChange: (filter: AssetFilterType) => void;
  onAnalyze: (types?: ProjectAssetType[]) => void;
  onClear: (types?: ProjectAssetType[]) => void;
  onSelectAsset: (id: string | null) => void;
  onUpdateAsset: (id: string, updates: Partial<ProjectAsset>) => void;
  onGenerateImage: (assetId: string) => void;
  onAttachAsset?: (assetId: string) => void;
  onUploadImage?: (assetId: string, file: File) => void;
  onReplaceImage?: (assetId: string, imageUrl: string) => void;
  onUploadDetailImage?: (assetId: string, file: File) => void;
}

export function AssetWorkspace({
  assets,
  selectedAssetId,
  analysisStatus,
  hasAnalyzed,
  filter,
  onFilterChange,
  onAnalyze,
  onClear,
  onSelectAsset,
  onUpdateAsset,
  onGenerateImage,
  onAttachAsset,
  onUploadImage,
  onReplaceImage,
  onUploadDetailImage,
}: AssetWorkspaceProps) {
  if (analysisStatus === 'analyzing') {
    return <AssetAnalyzing />;
  }

  if (assets.length === 0) {
    return <AssetEmptyState onAnalyze={() => onAnalyze()} hasAnalyzed={hasAnalyzed} />;
  }

  const selectedAsset = selectedAssetId
    ? assets.find(a => a.id === selectedAssetId)
    : null;

  if (selectedAsset) {
    return (
      <AssetDetailContainer
        asset={selectedAsset}
        onBack={() => onSelectAsset(null)}
        onUpdate={(updates) => onUpdateAsset(selectedAsset.id, updates)}
        onGenerateImage={() => onGenerateImage(selectedAsset.id)}
        onUploadImage={
          onUploadDetailImage
            ? (file) => onUploadDetailImage(selectedAsset.id, file)
            : undefined
        }
      />
    );
  }

  return (
    <AssetOverviewTable
      assets={assets}
      filter={filter}
      onFilterChange={onFilterChange}
      onSelectAsset={onSelectAsset}
      onAnalyze={onAnalyze}
      onClear={onClear}
      showAnalyzeButton={hasAnalyzed}
      showClearButton={hasAnalyzed}
      onAttachAsset={onAttachAsset}
      onUploadImage={onUploadImage}
      onReplaceImage={onReplaceImage}
    />
  );
}
