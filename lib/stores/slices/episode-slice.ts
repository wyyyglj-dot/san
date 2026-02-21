import type { StateCreator } from 'zustand';
import type { Episode } from '@/components/episodes/types';
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
        `/api/projects/${encodeURIComponent(pid)}/episodes`,
      );
      if (!res.ok) return;
      const data = await res.json();
      if (!data?.success || get().projectId !== pid) return;

      const episodes = (data.data ?? []) as Episode[];
      const nextOrderNum = (data.nextOrderNum as number) || 1;
      const { selectedEpisodeId, selectedAssetId } = get();
      const keepSelected =
        selectedEpisodeId !== null &&
        episodes.some((ep) => ep.id === selectedEpisodeId);

      set({
        episodes,
        nextOrderNum,
        selectedEpisodeId: keepSelected ? selectedEpisodeId : null,
        selectedAssetId: keepSelected ? selectedAssetId : null,
      });
    } catch (err) {
      console.error('Failed to fetch episodes:', err);
    } finally {
      if (get().projectId === pid) set({ isLoadingEpisodes: false });
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

  deleteEpisode: async (episodeId) => {
    const pid = get().projectId;
    try {
      const res = await fetch(
        `/api/episodes/${encodeURIComponent(episodeId)}`,
        { method: 'DELETE' },
      );
      if (!res.ok) return;
      const data = await res.json();
      if (!data?.success || get().projectId !== pid) return;

      set((s) => {
        const next = s.episodes.filter((ep) => ep.id !== episodeId);
        const cleared = s.selectedEpisodeId === episodeId;
        return {
          episodes: next,
          selectedEpisodeId: cleared ? null : s.selectedEpisodeId,
          selectedAssetId: cleared ? null : s.selectedAssetId,
        };
      });
    } catch (err) {
      console.error('Failed to delete episode:', err);
    }
  },
});
