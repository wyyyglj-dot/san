'use client';

import { useMemo, useCallback } from 'react';
import { AssetWorkspace } from '@/components/assets/asset-workspace';
import { useWorkspaceStore } from '@/lib/stores/workspace-store';
import { useToast } from '@/components/ui/toaster';
import { Loader2, Film } from 'lucide-react';
import { fileToBase64 } from '@/lib/utils';

export function AssetWorkspaceView({ projectId }: { projectId: string }) {
  const selectedEpisodeId = useWorkspaceStore((s) => s.selectedEpisodeId);
  const episodeAssets = useWorkspaceStore((s) => s.episodeAssets);
  const projectAssets = useWorkspaceStore((s) => s.assets);
  const isLoadingEpisodeAssets = useWorkspaceStore((s) => s.isLoadingEpisodeAssets);
  const selectedAssetId = useWorkspaceStore((s) => s.selectedAssetId);
  const analysisStatus = useWorkspaceStore((s) => s.analysisStatus);
  const analyzeAssets = useWorkspaceStore((s) => s.analyzeAssets);
  const clearEpisodeAssets = useWorkspaceStore((s) => s.clearEpisodeAssets);
  const analyzedEpisodeIds = useWorkspaceStore((s) => s.analyzedEpisodeIds);
  const assetFilter = useWorkspaceStore((s) => s.assetFilter);
  const setAssetFilter = useWorkspaceStore((s) => s.setAssetFilter);
  const setSelectedAssetId = useWorkspaceStore((s) => s.setSelectedAssetId);
  const updateAsset = useWorkspaceStore((s) => s.updateAsset);
  const generateAssetImage = useWorkspaceStore((s) => s.generateAssetImage);
  const attachAssetToEpisode = useWorkspaceStore((s) => s.attachAssetToEpisode);
  const uploadAssetImage = useWorkspaceStore((s) => s.uploadAssetImage);
  const { toast } = useToast();

  const handleUploadImage = useCallback(
    async (assetId: string, file: File) => {
      const optimisticUrl = URL.createObjectURL(file);
      const base64Data = await fileToBase64(file);
      const ok = await uploadAssetImage(assetId, {
        base64Data,
        filename: file.name,
        mimeType: file.type,
        optimisticUrl,
      });
      URL.revokeObjectURL(optimisticUrl);
      toast({
        title: ok ? '图片上传成功' : '图片上传失败',
        ...(ok ? {} : { variant: 'destructive' as const }),
      });
    },
    [uploadAssetImage, toast]
  );

  const handleReplaceImage = useCallback(
    async (assetId: string, imageUrl: string) => {
      const ok = await updateAsset(assetId, { primaryImageUrl: imageUrl });
      toast({
        title: ok ? '图片替换成功' : '图片替换失败',
        ...(ok ? {} : { variant: 'destructive' as const }),
      });
    },
    [updateAsset, toast]
  );

  const handleAttachAsset = useCallback(
    async (assetId: string) => {
      if (!selectedEpisodeId) {
        toast({ title: '请先选择剧集' });
        return;
      }
      const ok = await attachAssetToEpisode(selectedEpisodeId, assetId);
      toast({
        title: ok ? '资产已关联到当前剧集' : '关联失败',
        ...(ok ? {} : { variant: 'destructive' as const }),
      });
    },
    [selectedEpisodeId, attachAssetToEpisode, toast]
  );

  const displayAssets = useMemo(() => {
    const base = episodeAssets ?? [];
    if (!selectedAssetId) return base;
    if (base.some((a) => a.id === selectedAssetId)) return base;
    const fromProject = projectAssets.find((a) => a.id === selectedAssetId);
    if (fromProject) return [...base, fromProject];
    return base;
  }, [episodeAssets, projectAssets, selectedAssetId]);

  const hasAnalyzed =
    (!!selectedEpisodeId && analyzedEpisodeIds.includes(selectedEpisodeId)) ||
    displayAssets.length > 0;

  if (!selectedEpisodeId) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
        <Film className="h-12 w-12 mb-4 opacity-20" />
        <p>请选择左侧剧集以查看相关资产</p>
      </div>
    );
  }

  if (isLoadingEpisodeAssets) {
    return (
      <div className="h-full flex items-center justify-center text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" aria-label="正在加载资产" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <AssetWorkspace
        assets={displayAssets}
        selectedAssetId={selectedAssetId}
        analysisStatus={analysisStatus}
        hasAnalyzed={hasAnalyzed}
        filter={assetFilter}
        onFilterChange={setAssetFilter}
        onAnalyze={(types) => void analyzeAssets(types)}
        onClear={async (types) => {
          const ok = await clearEpisodeAssets(types);
          toast({
            title: ok ? '清除成功' : '清除失败',
            ...(ok ? {} : { variant: 'destructive' as const }),
          });
        }}
        onSelectAsset={setSelectedAssetId}
        onUpdateAsset={async (id, updates) => {
          const ok = await updateAsset(id, updates);
          toast({
            title: ok ? '保存成功' : '保存失败',
            ...(ok ? {} : { variant: 'destructive' as const }),
          });
        }}
        onGenerateImage={async (assetId) => {
          const ok = await generateAssetImage(assetId);
          toast({
            title: ok ? '图片生成中' : '生成失败',
            description: ok ? '请稍候，图片正在后台生成' : '网络错误',
            ...(ok ? {} : { variant: 'destructive' as const }),
          });
        }}
        onAttachAsset={handleAttachAsset}
        onUploadImage={handleUploadImage}
        onReplaceImage={handleReplaceImage}
        onUploadDetailImage={handleUploadImage}
      />
    </div>
  );
}
