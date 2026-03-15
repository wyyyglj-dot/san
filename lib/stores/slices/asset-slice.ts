import type { StateCreator } from 'zustand';
import type { ProjectAsset, ProjectAssetType } from '@/lib/db-comic';
import type { WorkspaceStore, AssetSlice } from './types';

export const createAssetSlice: StateCreator<
  WorkspaceStore,
  [],
  [],
  AssetSlice
> = (set, get) => {
  let episodeAssetsRequestId = 0;
  let analyzeAssetsRequestId = 0;

  return {
    assets: [],
    episodeAssets: [],
    selectedAssetId: null,
    isLoadingAssets: false,
    isLoadingEpisodeAssets: false,
    analysisStatus: 'idle',
    assetFilter: 'all',

    setSelectedAssetId: (id) => {
      set({ selectedAssetId: id });
    },

    setAssetFilter: (filter) => {
      set({ assetFilter: filter });
    },

    fetchAssets: async () => {
      const pid = get().projectId;
      if (!pid) return;

      set({ isLoadingAssets: true });
      try {
        const res = await fetch(
          `/api/projects/${encodeURIComponent(pid)}/assets`,
        );
        if (!res.ok) return;
        const data = await res.json();
        if (!data?.success || get().projectId !== pid) return;

        const assets = (data.data ?? []) as ProjectAsset[];
        const { selectedAssetId } = get();
        const keepAssetSelected =
          selectedAssetId !== null &&
          assets.some((a) => a.id === selectedAssetId);
        set({
          assets,
          analysisStatus: assets.length > 0 ? 'done' : get().analysisStatus,
          selectedAssetId: keepAssetSelected ? selectedAssetId : null,
        });
      } catch (err) {
        console.error('Failed to fetch assets:', err);
      } finally {
        if (get().projectId === pid) set({ isLoadingAssets: false });
      }
    },

    fetchEpisodeAssets: async (episodeId, silent) => {
      const eid = episodeId ?? get().selectedEpisodeId;
      if (!eid) {
        set({ episodeAssets: [], isLoadingEpisodeAssets: false });
        return;
      }

      const requestId = ++episodeAssetsRequestId;
      if (!silent) set({ isLoadingEpisodeAssets: true });
      try {
        const res = await fetch(
          `/api/episodes/${encodeURIComponent(eid)}/assets`,
        );
        if (!res.ok) return;
        const data = await res.json();
        if (!data?.success) return;
        if (episodeAssetsRequestId !== requestId) return;
        if (get().selectedEpisodeId !== eid) return;

        const assets = (data.data ?? []) as ProjectAsset[];
        const { selectedAssetId } = get();
        const keepAsset =
          selectedAssetId !== null &&
          assets.some((a) => a.id === selectedAssetId);
        set({
          episodeAssets: assets,
          selectedAssetId: keepAsset ? selectedAssetId : null,
        });
      } catch (err) {
        console.error('Failed to fetch episode assets:', err);
      } finally {
        if (
          episodeAssetsRequestId === requestId &&
          get().selectedEpisodeId === eid
        ) {
          set({ isLoadingEpisodeAssets: false });
        }
      }
    },

    analyzeAssets: async (types) => {
      const pid = get().projectId;
      const episodeId = get().selectedEpisodeId;
      if (!pid || !episodeId) return;

      const reqId = ++analyzeAssetsRequestId;
      set({ analysisStatus: 'analyzing' });
      try {
        const payload: Record<string, unknown> = { episodeIds: [episodeId] };
        if (types && types.length > 0) {
          payload.types = types;
        }

        const res = await fetch(
          `/api/projects/${encodeURIComponent(pid)}/assets/analyze`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          },
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (get().projectId !== pid || analyzeAssetsRequestId !== reqId) return;

        if (data?.success) {
          set((s) => ({
            assets: (data.data?.assets ?? []) as ProjectAsset[],
            analysisStatus: 'done',
            analyzedEpisodeIds: s.analyzedEpisodeIds.includes(episodeId)
              ? s.analyzedEpisodeIds
              : [...s.analyzedEpisodeIds, episodeId],
          }));
          if (get().selectedEpisodeId === episodeId) {
            void get().fetchEpisodeAssets(episodeId, true);
          }
        } else {
          set({
            analysisStatus: get().analyzedEpisodeIds.includes(episodeId)
              ? 'done'
              : 'idle',
          });
        }
      } catch (err) {
        console.error('Failed to analyze assets:', err);
        if (get().projectId === pid && analyzeAssetsRequestId === reqId) {
          set({
            analysisStatus: get().analyzedEpisodeIds.includes(episodeId)
              ? 'done'
              : 'idle',
          });
        }
      }
    },

    clearEpisodeAssets: async (types) => {
      const episodeId = get().selectedEpisodeId;
      if (!episodeId) return false;

      try {
        const res = await fetch(
          `/api/episodes/${encodeURIComponent(episodeId)}/assets/clear`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(types?.length ? { types } : {}),
          },
        );
        if (!res.ok) return false;
        const data = await res.json();
        if (!data?.success) return false;

        void get().fetchEpisodeAssets(episodeId, true);
        void get().fetchAssets();
        return true;
      } catch (err) {
        console.error('Failed to clear episode assets:', err);
        return false;
      }
    },

    createAsset: async (payload) => {
      const pid = get().projectId;
      if (!pid) return null;

      try {
        const res = await fetch(
          `/api/projects/${encodeURIComponent(pid)}/assets`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          },
        );
        if (!res.ok) return null;
        const data = await res.json();
        if (!data?.success || get().projectId !== pid) return null;

        const asset = data.data as ProjectAsset;
        set((s) => ({
          assets: s.assets.some((a) => a.id === asset.id)
            ? s.assets
            : [asset, ...s.assets],
        }));
        return asset;
      } catch (err) {
        console.error('Failed to create asset:', err);
        return null;
      }
    },

    attachAssetToEpisode: async (episodeId, assetId) => {
      try {
        const res = await fetch(
          `/api/episodes/${encodeURIComponent(episodeId)}/assets`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ assetId }),
          },
        );
        if (!res.ok) return false;
        const data = await res.json();
        if (!data?.success) return false;

        void get().fetchEpisodeAssets(episodeId, true);
        return true;
      } catch (err) {
        console.error('Failed to attach asset to episode:', err);
        return false;
      }
    },

    uploadAssetImage: async (assetId, payload) => {
      const prevAsset =
        get().assets.find((a) => a.id === assetId) ??
        get().episodeAssets.find((a) => a.id === assetId);
      const prevUrl = prevAsset?.primaryImageUrl ?? null;

      const applyUrl = (url: string | null) => {
        set((s) => ({
          assets: s.assets.map((a) =>
            a.id === assetId ? { ...a, primaryImageUrl: url } : a,
          ),
          episodeAssets: s.episodeAssets.map((a) =>
            a.id === assetId ? { ...a, primaryImageUrl: url } : a,
          ),
        }));
      };

      if (payload.optimisticUrl) {
        applyUrl(payload.optimisticUrl);
      }

      try {
        const res = await fetch(
          `/api/assets/${encodeURIComponent(assetId)}/upload-image`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              base64Data: payload.base64Data,
              filename: payload.filename,
              mimeType: payload.mimeType,
            }),
          },
        );
        if (!res.ok) {
          if (payload.optimisticUrl) applyUrl(prevUrl);
          return false;
        }
        const data = await res.json();
        if (!data?.success) {
          if (payload.optimisticUrl) applyUrl(prevUrl);
          return false;
        }

        const updated = data.data as ProjectAsset;
        set((s) => ({
          assets: s.assets.map((a) =>
            a.id === assetId ? { ...a, ...updated } : a,
          ),
          episodeAssets: s.episodeAssets.map((a) =>
            a.id === assetId ? { ...a, ...updated } : a,
          ),
        }));
        return true;
      } catch (err) {
        console.error('Failed to upload asset image:', err);
        if (payload.optimisticUrl) applyUrl(prevUrl);
        return false;
      }
    },

    updateAsset: async (assetId, updates) => {
      const pid = get().projectId;
      try {
        const res = await fetch(
          `/api/assets/${encodeURIComponent(assetId)}`,
          {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updates),
          },
        );
        if (!res.ok) return false;
        const data = await res.json();
        if (!data?.success || get().projectId !== pid) return false;

        set((s) => ({
          assets: s.assets.map((a) =>
            a.id === assetId ? { ...a, ...data.data } : a,
          ),
          episodeAssets: s.episodeAssets.map((a) =>
            a.id === assetId ? { ...a, ...data.data } : a,
          ),
        }));
        return true;
      } catch (err) {
        console.error('Failed to update asset:', err);
        return false;
      }
    },

    generateAssetImage: async (assetId) => {
      try {
        const res = await fetch(
          `/api/assets/${encodeURIComponent(assetId)}/generate-image`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({}),
          },
        );
        const data = await res.json();
        return !!data?.success;
      } catch (err) {
        console.error('Failed to generate asset image:', err);
        return false;
      }
    },
  };
};
