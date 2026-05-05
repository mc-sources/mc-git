import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { RepoInfo } from "../domain/entities";

interface RepoStore {
  currentRepo: RepoInfo | null;
  recentRepos: RepoInfo[];
  allBranchesPerRepo: Record<string, boolean>;
  setCurrentRepo: (repo: RepoInfo | null) => void;
  addRecentRepo: (repo: RepoInfo) => void;
  setAllBranchesForRepo: (path: string, value: boolean) => void;
}

export const useRepoStore = create<RepoStore>()(
  persist(
    (set) => ({
      currentRepo: null,
      recentRepos: [],
      allBranchesPerRepo: {},

      setCurrentRepo: (repo) => set({ currentRepo: repo }),

      addRecentRepo: (repo) =>
        set((state) => {
          const filtered = state.recentRepos.filter((r) => r.path !== repo.path);
          return { recentRepos: [repo, ...filtered].slice(0, 10) };
        }),

      setAllBranchesForRepo: (path, value) =>
        set((state) => ({
          allBranchesPerRepo: { ...state.allBranchesPerRepo, [path]: value },
        })),
    }),
    {
      name: "mcgit-repo-store",
      partialize: (state) => ({
        recentRepos: state.recentRepos,
        allBranchesPerRepo: state.allBranchesPerRepo,
      }),
    }
  )
);
