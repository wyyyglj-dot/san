import type { StateCreator } from 'zustand';
import type { Episode } from '@/components/episodes/types';
import { apiDelete } from '@/lib/api-client';
import type { WorkspaceStore, EpisodeSlice } from './types';

export const createEpisodeSlice: StateCreator<
  WorkspaceStore,
  [],
  [],
  EpisodeSlice
> = (set, get) => ({
  episodes: [],
  nextOrderNum: 1,
  selectedEpisodeId: null,
  isLoadingEpisodes: false,
  isLoadingMoreEpisodes: false,
  episodesTotal: 0,
  episodesHasMore: false,
  storyboardStatus: {},
  analyzedEpisodeIds: [],

  // Basic setter only – no cross-domain side effects.
  // The facade overrides this with orchestration logic.
  setSelectedEpisodeId: (id) => {
    set({ selectedEpisodeId: id });
  },

  fetchEpisodes: async () => {
    const pid = get().projectId;
    if (!pid) return;

    set({ isLoadingEpisodes: true });
    try {
      const res = await fetch(
        `/api/projects/${encodeURIComponent(pid)}/episodes?limit=50&offset=0`,
      );
      if (!res.ok) return;
      const data = await res.json();
      if (!data?.success || get().projectId !== pid) return;

      const episodes = (data.data ?? []) as Episode[];
      const nextOrderNum = (data.nextOrderNum as number) || 1;
      const pagination = data.pagination as { total: number; hasMore: boolean } | undefined;
      const { selectedEpisodeId, selectedAssetId } = get();
      const keepSelected =
        selectedEpisodeId !== null &&
        episodes.some((ep) => ep.id === selectedEpisodeId);

      set({
        episodes,
        nextOrderNum,
        episodesTotal: pagination?.total ?? episodes.length,
        episodesHasMore: pagination?.hasMore ?? false,
        selectedEpisodeId: keepSelected ? selectedEpisodeId : null,
        selectedAssetId: keepSelected ? selectedAssetId : null,
      });
    } catch (err) {
      console.error('Failed to fetch episodes:', err);
    } finally {
      if (get().projectId === pid) set({ isLoadingEpisodes: false });
    }
  },

  loadMoreEpisodes: async () => {
    const pid = get().projectId;
    if (!pid || get().isLoadingMoreEpisodes || !get().episodesHasMore) return;

    set({ isLoadingMoreEpisodes: true });
    try {
      const offset = get().episodes.length;
      const res = await fetch(
        `/api/projects/${encodeURIComponent(pid)}/episodes?limit=50&offset=${offset}`,
      );
      if (!res.ok) return;
      const data = await res.json();
      if (!data?.success || get().projectId !== pid) return;

      const moreEpisodes = (data.data ?? []) as Episode[];
      const pagination = data.pagination as { total: number; hasMore: boolean } | undefined;

      set((s) => ({
        episodes: [...s.episodes, ...moreEpisodes],
        episodesTotal: pagination?.total ?? s.episodesTotal,
        episodesHasMore: pagination?.hasMore ?? false,
      }));
    } catch (err) {
      console.error('Failed to load more episodes:', err);
    } finally {
      if (get().projectId === pid) set({ isLoadingMoreEpisodes: false });
    }
  },

  updateEpisodeContent: async (episodeId, content) => {
    const pid = get().projectId;
    if (!pid || !episodeId) return false;

    const trimmed = content.trim();
    if (!trimmed) return false;

    const prevContent =
      get().episodes.find((ep) => ep.id === episodeId)?.content ?? '';

    set((s) => ({
      episodes: s.episodes.map((ep) =>
        ep.id === episodeId ? { ...ep, content } : ep,
      ),
    }));

    try {
      const res = await fetch(
        `/api/episodes/${encodeURIComponent(episodeId)}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content }),
        },
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return true;
    } catch (err) {
      console.error('Failed to update episode content:', err);
      if (get().projectId === pid) {
        const currentContent =
          get().episodes.find((ep) => ep.id === episodeId)?.content ?? '';
        if (currentContent === content) {
          set((s) => ({
            episodes: s.episodes.map((ep) =>
              ep.id === episodeId ? { ...ep, content: prevContent } : ep,
            ),
          }));
        }
      }
      return false;
    }
  },

  generateStoryboard: async (episodeId) => {
    const pid = get().projectId;
    if (!pid || !episodeId) return;

    const prevContent =
      get().episodes.find((ep) => ep.id === episodeId)?.content ?? '';

    set((s) => ({
      storyboardStatus: { ...s.storyboardStatus, [episodeId]: 'generating' },
    }));

    try {
      const res = await fetch(
        `/api/episodes/${encodeURIComponent(episodeId)}/storyboard`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) {
        throw new Error(data?.error || `HTTP ${res.status}`);
      }
      if (get().projectId !== pid) return;

      const shots = data.data?.shots as
        | { index: number; description: string }[]
        | undefined;
      if (Array.isArray(shots) && shots.length > 0) {
        const newContent = shots
          .sort((a, b) => a.index - b.index)
          .map((s) => s.description?.trim().replace(/\r?\n/g, ' '))
          .filter(Boolean)
          .join('\n');

        set((s) => ({
          episodes: s.episodes.map((ep) =>
            ep.id === episodeId ? { ...ep, content: newContent } : ep,
          ),
          storyboardStatus: { ...s.storyboardStatus, [episodeId]: 'done' },
        }));

        try {
          const patchRes = await fetch(
            `/api/episodes/${encodeURIComponent(episodeId)}`,
            {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ content: newContent }),
            },
          );
          if (!patchRes.ok) throw new Error('保存分镜内容失败');
        } catch (patchErr) {
          console.error('Failed to persist storyboard:', patchErr);
          if (get().projectId === pid) {
            set((s) => ({
              episodes: s.episodes.map((ep) =>
                ep.id === episodeId ? { ...ep, content: prevContent } : ep,
              ),
              storyboardStatus: {
                ...s.storyboardStatus,
                [episodeId]: 'failed',
              },
            }));
          }
        }
      } else {
        set((s) => ({
          storyboardStatus: { ...s.storyboardStatus, [episodeId]: 'done' },
        }));
      }
    } catch (err) {
      console.error('Failed to generate storyboard:', err);
      if (get().projectId !== pid) return;
      set((s) => ({
        storyboardStatus: { ...s.storyboardStatus, [episodeId]: 'failed' },
      }));
    }
  },

  deleteEpisodes: async (ids) => {
    const pid = get().projectId;
    if (!pid) {
      throw new Error('项目不存在');
    }

    const safeIds = Array.from(
      new Set(
        ids
          .filter((id) => typeof id === 'string')
          .map((id) => id.trim())
          .filter(Boolean)
      )
    );

    if (safeIds.length === 0) {
      return { deletedCount: 0 };
    }

    const data = await apiDelete<{ deletedCount: number; requestedCount: number }>(
      `/api/projects/${encodeURIComponent(pid)}/episodes`,
      {
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: safeIds }),
      },
    );

    if (get().projectId === pid) {
      await get().fetchEpisodes();
    }

    return { deletedCount: data?.deletedCount ?? 0 };
  },

  deleteEpisode: async (episodeId) => {
    try {
      const { deletedCount } = await get().deleteEpisodes([episodeId]);
      if (deletedCount === 0) {
        throw new Error('剧集不存在或已删除');
      }
    } catch (err) {
      console.error('Failed to delete episode:', err);
      throw err;
    }
  },
});
