import { create } from 'zustand';
import { createEpisodeSlice } from './slices/episode-slice';
import { createAssetSlice } from './slices/asset-slice';
import { createUiSlice } from './slices/ui-slice';
import type { WorkspaceStore } from './slices/types';

// Re-export all public types so existing imports don't break
export type {
  WorkspaceTab,
  AnalysisStatus,
  StoryboardStatus,
  AssetFilterType,
} from './slices/types';

export const useWorkspaceStore = create<WorkspaceStore>()((...args) => {
  const [set, get] = args;

  // Compose domain slices
  const episodeSlice = createEpisodeSlice(...args);
  const assetSlice = createAssetSlice(...args);
  const uiSlice = createUiSlice(...args);

  return {
    // Spread all slice state & actions
    ...episodeSlice,
    ...assetSlice,
    ...uiSlice,

    // ── Facade-only state ──
    projectId: null,

    // ── Cross-domain orchestration: setActiveTab ──
    setActiveTab: (tab) => {
      // Delegate basic state change
      set({ activeTab: tab });
      if (tab !== 'assets') return;
      // Lazy-load assets when switching to assets tab
      const { assets, analysisStatus, isLoadingAssets } = get();
      if (assets.length === 0 && analysisStatus === 'idle' && !isLoadingAssets) {
        void get().fetchAssets();
      }
      const { selectedEpisodeId, episodeAssets, isLoadingEpisodeAssets } = get();
      if (selectedEpisodeId && episodeAssets.length === 0 && !isLoadingEpisodeAssets) {
        void get().fetchEpisodeAssets(selectedEpisodeId);
      }
    },

    // ── Cross-domain orchestration: setSelectedEpisodeId ──
    setSelectedEpisodeId: (id) => {
      if (id === get().selectedEpisodeId) return;
      set({
        selectedEpisodeId: id,
        selectedAssetId: null,
        episodeAssets: [],
        isLoadingEpisodeAssets: !!id,
      });
      if (id) {
        void get().fetchEpisodeAssets(id);
        const { assets, isLoadingAssets } = get();
        if (assets.length === 0 && !isLoadingAssets) {
          void get().fetchAssets();
        }
      }
    },

    // ── Cross-domain orchestration: resetForProject ──
    resetForProject: (projectId) => {
      set({
        projectId,
        activeTab: 'episodes',
        episodes: [],
        assets: [],
        episodeAssets: [],
        nextOrderNum: 1,
        selectedEpisodeId: null,
        selectedAssetId: null,
        analysisStatus: 'idle',
        assetFilter: 'all',
        analyzedEpisodeIds: [],
        storyboardStatus: {},
        leftSidebarOpen: true,
        rightSidebarOpen: true,
        isLoadingEpisodes: true,
        isLoadingMoreEpisodes: false,
        episodesTotal: 0,
        episodesHasMore: false,
        isLoadingAssets: false,
        isLoadingEpisodeAssets: false,
      });
    },
  };
});
