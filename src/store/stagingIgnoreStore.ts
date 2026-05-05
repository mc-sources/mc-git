import { create } from "zustand";
import { persist } from "zustand/middleware";

interface StagingIgnoreStore {
  /** repoPath → list of file paths excluded from Stage All */
  ignored: Record<string, string[]>;
  toggleIgnore: (repoPath: string, filePath: string) => void;
}

export const useStagingIgnoreStore = create<StagingIgnoreStore>()(
  persist(
    (set) => ({
      ignored: {},

      toggleIgnore: (repoPath, filePath) =>
        set((state) => {
          const current = state.ignored[repoPath] ?? [];
          const next = current.includes(filePath)
            ? current.filter((p) => p !== filePath)
            : [...current, filePath];
          return { ignored: { ...state.ignored, [repoPath]: next } };
        }),
    }),
    { name: "mcgit-staging-ignore" }
  )
);
