'use client';

import * as React from 'react';
import type { ProjectAsset, AssetGenerationHistory } from '@/lib/db-comic';
import { apiPatch } from '@/lib/api-client';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { AssetHero } from './asset-hero';
import { AssetTabsNav } from './asset-tabs-nav';
import { AssetOverviewTab } from './tabs/asset-overview-tab';
import { AssetStudioTab } from './tabs/asset-studio-tab';
import { AssetEpisodesTab } from './tabs/asset-episodes-tab';
import { AssetEditorDialog } from './modals/asset-editor-dialog';

export type AssetDetailTab = 'overview' | 'studio' | 'episodes';

interface AssetDetailContainerProps {
  asset: ProjectAsset;
  onBack: () => void;
  onUpdate: (updates: Partial<ProjectAsset>) => void;
  onGenerateImage: () => void;
  onUploadImage?: (file: File) => void;
}

export function AssetDetailContainer({
  asset,
  onBack,
  onUpdate,
  onGenerateImage,
  onUploadImage,
}: AssetDetailContainerProps) {
  const [activeTab, setActiveTab] = React.useState<AssetDetailTab>('overview');
  const [refreshKey, setRefreshKey] = React.useState(0);
  const [editorOpen, setEditorOpen] = React.useState(false);
  const [editorPrompt, setEditorPrompt] = React.useState('');

  const triggerRefresh = React.useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  const handleSetPrimary = async (historyId: string, imageUrl: string) => {
    try {
      await apiPatch(`/api/assets/${asset.id}/primary-image`, { historyId });
      onUpdate({ primaryImageUrl: imageUrl } as Partial<ProjectAsset>);
    } catch (err) {
      console.error('Failed to set primary image:', err);
    }
  };

  const handleSetPrimaryUrl = React.useCallback(
    (url: string) => {
      onUpdate({ primaryImageUrl: url } as Partial<ProjectAsset>);
    },
    [onUpdate],
  );

  const handleEditFromGallery = (history: AssetGenerationHistory) => {
    setEditorPrompt(history.prompt);
    setEditorOpen(true);
  };

  const handleEditorComplete = () => {
    triggerRefresh();
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Hero 主图区域 */}
      <AssetHero
        asset={asset}
        onSetPrimary={handleSetPrimary}
        onSetPrimaryUrl={handleSetPrimaryUrl}
        onUploadImage={onUploadImage}
        onBack={onBack}
      />

      {/* Tab 导航 + 内容区域 */}
      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as AssetDetailTab)}
        className="flex-1 flex flex-col min-h-0"
      >
        <AssetTabsNav />

        <div className="flex-1 overflow-y-auto p-4">
          <TabsContent value="overview" className="mt-0">
            <AssetOverviewTab
              asset={asset}
              onUpdate={onUpdate}
              onDelete={onBack}
            />
          </TabsContent>

          <TabsContent value="studio" className="mt-0">
            <AssetStudioTab
              asset={asset}
              onGenerationComplete={triggerRefresh}
              onSetPrimary={handleSetPrimary}
              onEditFromGallery={handleEditFromGallery}
              refreshKey={refreshKey}
            />
          </TabsContent>

          <TabsContent value="episodes" className="mt-0">
            <AssetEpisodesTab asset={asset} />
          </TabsContent>
        </div>
      </Tabs>

      {/* 精修弹窗 */}
      <AssetEditorDialog
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
        asset={asset}
        defaultPrompt={editorPrompt}
        currentImageUrl={asset.primaryImageUrl}
        onGenerationComplete={handleEditorComplete}
      />
    </div>
  );
}
