'use client';

import * as React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, Plus, ImagePlus } from 'lucide-react';
import { CollapsibleSidebar } from '@/components/episodes/shared/collapsible-sidebar';
import type { ProjectAsset, ProjectAssetType } from '@/lib/db-comic';
import { useWorkspaceStore } from '@/lib/stores/workspace-store';
import { cn, fileToBase64 } from '@/lib/utils';
import { notify } from '@/lib/toast-utils';
import { AssetCardVisual } from '@/components/assets/asset-card-visual';
import { typeConfig, typeLabels } from '@/components/assets/asset-schema';
import { CreateAssetDialog } from '@/components/assets/create-asset-dialog';

function AssetCard({
  asset,
  isSelected,
  onClick,
  projectId,
  onUploadImage,
}: {
  asset: ProjectAsset;
  isSelected: boolean;
  onClick: () => void;
  projectId: string | null;
  onUploadImage?: (assetId: string, file: File) => void;
}) {
  const [isDragOver, setIsDragOver] = React.useState(false);

  const handleDragStart = (e: React.DragEvent<HTMLDivElement>) => {
    const payload = JSON.stringify({
      v: 1,
      source: 'sidebar',
      assetId: asset.id,
      projectId: projectId ?? '',
      type: asset.type,
      name: asset.name,
      primaryImageUrl: asset.primaryImageUrl,
    });
    e.dataTransfer.setData('application/x-sanhub-asset', payload);
    e.dataTransfer.setData('text/plain', payload);
    e.dataTransfer.effectAllowed = 'copy';
    e.currentTarget.style.opacity = '0.5';
  };

  const handleDragEnd = (e: React.DragEvent<HTMLDivElement>) => {
    e.currentTarget.style.opacity = '1';
  };

  const handleFileDragOver = (e: React.DragEvent) => {
    // 仅接受外部文件拖入，排除内部资产拖拽
    if (e.dataTransfer.types.includes('Files')
      && !e.dataTransfer.types.includes('application/x-sanhub-asset')) {
      e.preventDefault();
      e.stopPropagation();
      e.dataTransfer.dropEffect = 'copy';
      setIsDragOver(true);
    }
  };

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file?.type.startsWith('image/') && onUploadImage) {
      onUploadImage(asset.id, file);
    }
  };

  const handleFileDragLeave = (e: React.DragEvent) => {
    // 防止子元素触发 leave
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setIsDragOver(false);
  };

  return (
    <div
      role="button"
      tabIndex={0}
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragOver={handleFileDragOver}
      onDrop={handleFileDrop}
      onDragLeave={handleFileDragLeave}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
      className="cursor-grab active:cursor-grabbing"
    >
      <AssetCardVisual
        name={asset.name}
        type={asset.type}
        imageUrl={asset.primaryImageUrl}
        isSelected={isSelected}
        isDragOver={isDragOver}
        size="sm"
        dragOverContent={
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/50 backdrop-blur-[1px] text-white font-medium pointer-events-none">
            <span className="flex items-center gap-2">
              <ImagePlus className="w-4 h-4" />
              替换图片
            </span>
          </div>
        }
      />
    </div>
  );
}

function EmptyTabState({ type }: { type: ProjectAssetType }) {
  const Icon = typeConfig[type].icon;
  return (
    <div className="text-center text-sm text-muted-foreground py-8 border-2 border-dashed border-white/[0.06] rounded-lg">
      <Icon className="h-10 w-10 mx-auto mb-2 opacity-50" />
      <p>暂无{typeLabels[type]}数据</p>
    </div>
  );
}

export function AssetSidebar() {
  const projectAssets = useWorkspaceStore((s) => s.assets);
  const episodeAssets = useWorkspaceStore((s) => s.episodeAssets);
  const episodes = useWorkspaceStore((s) => s.episodes);
  const projectId = useWorkspaceStore((s) => s.projectId);
  const workspaceTab = useWorkspaceStore((s) => s.activeTab);
  const selectedAssetId = useWorkspaceStore((s) => s.selectedAssetId);
  const selectedEpisodeId = useWorkspaceStore((s) => s.selectedEpisodeId);
  const rightSidebarOpen = useWorkspaceStore((s) => s.rightSidebarOpen);
  const setSelectedAssetId = useWorkspaceStore((s) => s.setSelectedAssetId);
  const toggleRightSidebar = useWorkspaceStore((s) => s.toggleRightSidebar);
  const uploadAssetImage = useWorkspaceStore((s) => s.uploadAssetImage);
  const createAsset = useWorkspaceStore((s) => s.createAsset);
  const attachAssetToEpisode = useWorkspaceStore((s) => s.attachAssetToEpisode);

  const [isCreateDialogOpen, setIsCreateDialogOpen] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState<string>('characters');

  const isEpisodeContext = workspaceTab === 'episodes' && !!selectedEpisodeId;
  const assets = isEpisodeContext ? episodeAssets : projectAssets;
  const selectedEpisode = episodes.find((e) => e.id === selectedEpisodeId);
  const sidebarTitle = isEpisodeContext && selectedEpisode
    ? `素材库 · EP${selectedEpisode.orderNum}`
    : '素材库 · 全局';

  // Tab value → ProjectAssetType 映射
  const tabToType: Record<string, ProjectAssetType> = {
    characters: 'character',
    scenes: 'scene',
    props: 'prop',
  };

  const handleUploadImage = React.useCallback(
    async (assetId: string, file: File) => {
      const optimisticUrl = URL.createObjectURL(file);
      let ok = false;
      try {
        const base64Data = await fileToBase64(file);
        ok = await uploadAssetImage(assetId, {
          base64Data,
          filename: file.name,
          mimeType: file.type,
          optimisticUrl,
        });
      } catch {
        ok = false;
      } finally {
        URL.revokeObjectURL(optimisticUrl);
      }
      if (ok) notify.success('图片上传成功');
      else notify.error('图片上传失败');
    },
    [uploadAssetImage]
  );

  const handleCreateAsset = React.useCallback(
    async (payload: {
      type: ProjectAssetType;
      name: string;
      description?: string;
      attributes?: Record<string, unknown>;
      imageFile?: File;
    }) => {
      const { imageFile, ...createPayload } = payload;
      const asset = await createAsset(createPayload);
      if (asset) {
        notify.success(`${typeLabels[payload.type]}「${payload.name}」创建成功`);
        if (isEpisodeContext && selectedEpisodeId) {
          await attachAssetToEpisode(selectedEpisodeId, asset.id);
        }
        if (imageFile) {
          await handleUploadImage(asset.id, imageFile);
        }
        setSelectedAssetId(asset.id);
      } else {
        notify.error('创建失败');
      }
    },
    [createAsset, attachAssetToEpisode, isEpisodeContext, selectedEpisodeId, setSelectedAssetId, handleUploadImage],
  );

  const [searchQuery, setSearchQuery] = React.useState('');

  const filterByType = (type: ProjectAssetType) => {
    const q = searchQuery.trim().toLowerCase();
    return assets.filter(
      (a) =>
        a.type === type &&
        (!q ||
          a.name.toLowerCase().includes(q) ||
          a.description?.toLowerCase().includes(q)),
    );
  };

  const renderTab = (type: ProjectAssetType) => {
    const filtered = filterByType(type);
    if (filtered.length === 0) return <EmptyTabState type={type} />;
    return (
      <div className="grid grid-cols-2 gap-2">
        {filtered.map((asset) => (
          <AssetCard
            key={asset.id}
            asset={asset}
            isSelected={selectedAssetId === asset.id}
            onClick={() => setSelectedAssetId(asset.id)}
            projectId={projectId}
            onUploadImage={handleUploadImage}
          />
        ))}
      </div>
    );
  };

  return (
    <CollapsibleSidebar
      side="right"
      isOpen={rightSidebarOpen}
      onToggle={toggleRightSidebar}
      title={sidebarTitle}
      width="400px"
      headerActions={
        <Button
          size="icon"
          variant="ghost"
          className="h-8 w-8"
          aria-label="创建素材"
          onClick={() => setIsCreateDialogOpen(true)}
        >
          <Plus className="h-4 w-4" />
        </Button>
      }
    >
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col h-full">
        <div className="p-4 border-b border-white/[0.06] shrink-0">
          <TabsList className="w-full grid grid-cols-3">
            <TabsTrigger value="characters">角色</TabsTrigger>
            <TabsTrigger value="scenes">场景</TabsTrigger>
            <TabsTrigger value="props">道具</TabsTrigger>
          </TabsList>
        </div>

        <div className="p-4 border-b border-white/[0.06] shrink-0">
          <div className="relative">
            <Search
              className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              placeholder="搜索素材..."
              className="pl-8"
              aria-label="搜索素材"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-4">
            <TabsContent value="characters" className="m-0">
              {renderTab('character')}
            </TabsContent>
            <TabsContent value="scenes" className="m-0">
              {renderTab('scene')}
            </TabsContent>
            <TabsContent value="props" className="m-0">
              {renderTab('prop')}
            </TabsContent>
          </div>
        </ScrollArea>
      </Tabs>

      <CreateAssetDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        defaultType={tabToType[activeTab] || 'character'}
        onSubmit={handleCreateAsset}
      />
    </CollapsibleSidebar>
  );
}
