import { create } from "zustand";
import type { RepoInfo } from "../domain/entities";

export interface Tab {
  id: string;
  repoInfo: RepoInfo;
}

interface TabStore {
  tabs: Tab[];
  activeTabId: string | null;
  addTab: (tab: Tab) => void;
  setActiveTab: (id: string) => void;
  removeTab: (id: string) => void;
  updateTabInfo: (id: string, repoInfo: RepoInfo) => void;
}

export const useTabStore = create<TabStore>((set) => ({
  tabs: [],
  activeTabId: null,

  addTab: (tab) =>
    set((state) => ({ tabs: [...state.tabs, tab], activeTabId: tab.id })),

  setActiveTab: (id) => set({ activeTabId: id }),

  removeTab: (id) =>
    set((state) => {
      const tabs = state.tabs.filter((t) => t.id !== id);
      let activeTabId = state.activeTabId;
      if (activeTabId === id) {
        // Switch to the nearest remaining tab
        const idx = state.tabs.findIndex((t) => t.id === id);
        const next = tabs[Math.max(0, idx - 1)];
        activeTabId = next?.id ?? null;
      }
      return { tabs, activeTabId };
    }),

  updateTabInfo: (id, repoInfo) =>
    set((state) => ({
      tabs: state.tabs.map((t) => (t.id === id ? { ...t, repoInfo } : t)),
    })),
}));
