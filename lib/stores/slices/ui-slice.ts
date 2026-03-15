import type { StateCreator } from 'zustand';
import type { WorkspaceStore, UiSlice } from './types';

export const createUiSlice: StateCreator<
  WorkspaceStore,
  [],
  [],
  UiSlice
> = (set) => ({
  activeTab: 'episodes',
  leftSidebarOpen: true,
  rightSidebarOpen: true,

  // Basic setter only – no cross-domain side effects.
  // The facade overrides this with orchestration logic.
  setActiveTab: (tab) => {
    set({ activeTab: tab });
  },

  toggleLeftSidebar: () => {
    set((s) => ({ leftSidebarOpen: !s.leftSidebarOpen }));
  },

  toggleRightSidebar: () => {
    set((s) => ({ rightSidebarOpen: !s.rightSidebarOpen }));
  },
});
