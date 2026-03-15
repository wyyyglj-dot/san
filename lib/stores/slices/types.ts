import type { Episode } from '@/components/episodes/types';
import type { ProjectAsset, ProjectAssetType } from '@/lib/db-comic';

// ── Shared type aliases ──
export type WorkspaceTab = 'episodes' | 'assets';
export type AnalysisStatus = 'idle' | 'analyzing' | 'done';
export type StoryboardStatus = 'idle' | 'generating' | 'done' | 'failed';
export type AssetFilterType = 'all' | 'character' | 'scene' | 'prop';

// ── Episode slice ──
export interface EpisodeSlice {
  episodes: Episode[];
  nextOrderNum: number;
  selectedEpisodeId: string | null;
  isLoadingEpisodes: boolean;
  isLoadingMoreEpisodes: boolean;
  episodesTotal: number;
  episodesHasMore: boolean;
  storyboardStatus: Record<string, StoryboardStatus>;
  analyzedEpisodeIds: string[];

  fetchEpisodes: () => Promise<void>;
  loadMoreEpisodes: () => Promise<void>;
  updateEpisodeContent: (episodeId: string, content: string) => Promise<boolean>;
  generateStoryboard: (episodeId: string) => Promise<void>;
  deleteEpisodes: (ids: string[]) => Promise<{ deletedCount: number }>;
  deleteEpisode: (episodeId: string) => Promise<void>;
  setSelectedEpisodeId: (id: string | null) => void;
}

// ── Asset slice ──
export interface AssetSlice {
  assets: ProjectAsset[];
  episodeAssets: ProjectAsset[];
  selectedAssetId: string | null;
  isLoadingAssets: boolean;
  isLoadingEpisodeAssets: boolean;
  analysisStatus: AnalysisStatus;
  assetFilter: AssetFilterType;

  fetchAssets: () => Promise<void>;
  fetchEpisodeAssets: (episodeId?: string, silent?: boolean) => Promise<void>;
  analyzeAssets: (types?: ProjectAssetType[]) => Promise<void>;
  clearEpisodeAssets: (types?: ProjectAssetType[]) => Promise<boolean>;
  createAsset: (payload: {
    type: ProjectAssetType;
    name: string;
    description?: string;
    primaryImageUrl?: string;
    attributes?: Record<string, unknown>;
  }) => Promise<ProjectAsset | null>;
  attachAssetToEpisode: (
    episodeId: string,
    assetId: string,
  ) => Promise<boolean>;
  uploadAssetImage: (
    assetId: string,
    payload: {
      base64Data: string;
      filename?: string;
      mimeType?: string;
      optimisticUrl?: string;
    },
  ) => Promise<boolean>;
  updateAsset: (
    assetId: string,
    updates: Partial<ProjectAsset>,
  ) => Promise<boolean>;
  generateAssetImage: (assetId: string) => Promise<boolean>;
  setSelectedAssetId: (id: string | null) => void;
  setAssetFilter: (filter: AssetFilterType) => void;
}

// ── UI slice ──
export interface UiSlice {
  activeTab: WorkspaceTab;
  leftSidebarOpen: boolean;
  rightSidebarOpen: boolean;

  setActiveTab: (tab: WorkspaceTab) => void;
  toggleLeftSidebar: () => void;
  toggleRightSidebar: () => void;
}

// ── Facade-only state & actions (cross-domain orchestration) ──
export interface FacadeSlice {
  projectId: string | null;

  /** Cross-domain: sets episode + clears asset selection + fetches episode assets */
  setSelectedEpisodeId: (id: string | null) => void;
  /** Cross-domain: sets tab + triggers lazy loading */
  setActiveTab: (tab: WorkspaceTab) => void;
  /** Resets all slices for a new project */
  resetForProject: (projectId: string) => void;
}

// ── Full combined store type ──
export type WorkspaceStore = EpisodeSlice & AssetSlice & UiSlice & FacadeSlice;
