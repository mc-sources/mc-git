import { create } from "zustand";
import type { BranchInfo, CommitSummary, StashEntry, StatusEntry, TagInfo } from "../domain/entities";

interface GitStore {
  // Status
  status: StatusEntry[];
  setStatus: (status: StatusEntry[]) => void;

  // Branches
  branches: BranchInfo[];
  setBranches: (branches: BranchInfo[]) => void;

  // History
  log: CommitSummary[];
  logHasMore: boolean;
  setLog: (log: CommitSummary[], hasMore: boolean) => void;
  appendLog: (more: CommitSummary[], hasMore: boolean) => void;

  // Graph (full topological fetch for graph rendering)
  graphCommits: CommitSummary[];
  setGraphCommits: (commits: CommitSummary[]) => void;

  // Stash
  stashes: StashEntry[];
  setStashes: (stashes: StashEntry[]) => void;

  // Tags
  tags: TagInfo[];
  setTags: (tags: TagInfo[]) => void;

  // Tags présents par remote (alimenté par fetchUseCase / pullUseCase / pruneRemoteUseCase post-succès,
  // via list_remote_tags). Cache RAM, non persistant. Une entrée absente = remote jamais vérifié → état "?<remote>".
  remoteTagPresence: Map<string, Set<string>>;
  setRemoteTagPresenceForRemote: (remote: string, tagNames: string[]) => void;
  clearRemoteTagPresence: () => void;

  // Incremented after a commit to trigger log refresh in CommitList
  logVersion: number;
  bumpLogVersion: () => void;

  // Tab switch — clears all per-repo state
  resetAll: () => void;
}

export const useGitStore = create<GitStore>((set) => ({
  status: [],
  setStatus: (status) => set({ status }),

  branches: [],
  setBranches: (branches) => set({ branches }),

  log: [],
  logHasMore: false,
  setLog: (log, logHasMore) => set({ log, logHasMore }),
  appendLog: (more, logHasMore) =>
    set((state) => ({ log: [...state.log, ...more], logHasMore })),

  graphCommits: [],
  setGraphCommits: (graphCommits) => set({ graphCommits }),

  stashes: [],
  setStashes: (stashes) => set({ stashes }),

  tags: [],
  setTags: (tags) => set({ tags }),

  remoteTagPresence: new Map<string, Set<string>>(),
  setRemoteTagPresenceForRemote: (remote, tagNames) =>
    set((state) => {
      const next = new Map(state.remoteTagPresence);
      next.set(remote, new Set(tagNames));
      return { remoteTagPresence: next };
    }),
  clearRemoteTagPresence: () => set({ remoteTagPresence: new Map() }),

  logVersion: 0,
  bumpLogVersion: () => set((state) => ({ logVersion: state.logVersion + 1 })),

  resetAll: () =>
    set({
      status: [],
      branches: [],
      log: [],
      logHasMore: false,
      graphCommits: [],
      stashes: [],
      tags: [],
      remoteTagPresence: new Map(),
    }),
}));
