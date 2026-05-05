import { create } from "zustand";
import { loadPref } from "../utils/localStorage";
import type { CommitDetail, FileDiff, ProgressEvent, RepositoryState } from "../domain/entities";

export type ActiveView = "changes" | "history" | "branches" | "remotes" | "submodules" | "settings" | "blame" | "reflog";

export type DiffMode = "unified" | "split";

/** Position mémoisée par onglet (REQ-UX-035) */
export interface TabPosition {
  activeView: ActiveView;
  selectedFilePath: string | null;
  selectedFileStaged: boolean;
  selectedCommitOid: string | null;
}

interface UiStore {
  activeView: ActiveView;
  setActiveView: (view: ActiveView) => void;

  selectedFilePath: string | null;
  selectedFileStaged: boolean;
  setSelectedFile: (path: string | null, staged?: boolean) => void;

  selectedCommitOid: string | null;
  setSelectedCommit: (oid: string | null) => void;

  currentDiff: FileDiff | null;
  setCurrentDiff: (diff: FileDiff | null) => void;

  currentCommitDetail: CommitDetail | null;
  setCurrentCommitDetail: (detail: CommitDetail | null) => void;

  repositoryState: RepositoryState;
  setRepositoryState: (state: RepositoryState) => void;

  blameTarget: { path: string; commitOid: string | null } | null;
  setBlameTarget: (target: { path: string; commitOid: string | null } | null) => void;

  progress: ProgressEvent | null;
  setProgress: (progress: ProgressEvent | null) => void;

  highlightedOid: string | null;
  setHighlightedOid: (oid: string | null) => void;

  // Diff display preferences (persisted)
  diffMode: DiffMode;
  setDiffMode: (mode: DiffMode) => void;
  ignoreWhitespace: boolean;
  setIgnoreWhitespace: (value: boolean) => void;

  // Interactive rebase trigger (set by CommitRow, read by HistoryView)
  interactiveRebaseFromOid: string | null;
  setInteractiveRebaseFromOid: (oid: string | null) => void;

  // Tab switch — resets all transient UI state
  reset: () => void;

  // Per-tab position memory (REQ-UX-035 / REQ-UX-036)
  tabPositions: Record<string, TabPosition>;
  saveTabPosition: (tabId: string) => void;
  /** Atomically reset transient state + restore saved position for tabId (or use defaults). */
  resetAndRestore: (tabId: string) => void;
  clearTabPosition: (tabId: string) => void;
}


export const useUiStore = create<UiStore>((set) => ({
  activeView: "changes",
  setActiveView: (activeView) => set({ activeView }),

  selectedFilePath: null,
  selectedFileStaged: false,
  setSelectedFile: (path, staged = false) =>
    set({ selectedFilePath: path, selectedFileStaged: staged }),

  selectedCommitOid: null,
  setSelectedCommit: (oid) => set({ selectedCommitOid: oid }),

  currentDiff: null,
  setCurrentDiff: (diff) => set({ currentDiff: diff }),

  currentCommitDetail: null,
  setCurrentCommitDetail: (detail) => set({ currentCommitDetail: detail }),

  repositoryState: "clean",
  setRepositoryState: (repositoryState) => set({ repositoryState }),

  blameTarget: null,
  setBlameTarget: (blameTarget) => set({ blameTarget }),

  progress: null,
  setProgress: (progress) => set({ progress }),

  highlightedOid: null,
  setHighlightedOid: (highlightedOid) => set({ highlightedOid }),

  interactiveRebaseFromOid: null,
  setInteractiveRebaseFromOid: (interactiveRebaseFromOid) => set({ interactiveRebaseFromOid }),

  diffMode: loadPref<DiffMode>("diffMode", "unified"),
  setDiffMode: (diffMode) => {
    localStorage.setItem("diffMode", JSON.stringify(diffMode));
    set({ diffMode });
  },

  ignoreWhitespace: loadPref<boolean>("ignoreWhitespace", false),
  setIgnoreWhitespace: (ignoreWhitespace) => {
    localStorage.setItem("ignoreWhitespace", JSON.stringify(ignoreWhitespace));
    set({ ignoreWhitespace });
  },

  reset: () =>
    set({
      activeView: "changes",
      selectedFilePath: null,
      selectedFileStaged: false,
      selectedCommitOid: null,
      currentDiff: null,
      currentCommitDetail: null,
      repositoryState: "clean",
      blameTarget: null,
      progress: null,
      highlightedOid: null,
      interactiveRebaseFromOid: null,
    }),

  tabPositions: {},

  saveTabPosition: (tabId) =>
    set((state) => ({
      tabPositions: {
        ...state.tabPositions,
        [tabId]: {
          activeView: state.activeView,
          selectedFilePath: state.selectedFilePath,
          selectedFileStaged: state.selectedFileStaged,
          selectedCommitOid: state.selectedCommitOid,
        },
      },
    })),

  resetAndRestore: (tabId) =>
    set((state) => {
      const saved = state.tabPositions[tabId];
      return {
        activeView: saved?.activeView ?? "changes",
        selectedFilePath: saved?.selectedFilePath ?? null,
        selectedFileStaged: saved?.selectedFileStaged ?? false,
        selectedCommitOid: saved?.selectedCommitOid ?? null,
        currentDiff: null,
        currentCommitDetail: null,
        repositoryState: "clean",
        blameTarget: null,
        progress: null,
        highlightedOid: null,
        interactiveRebaseFromOid: null,
      };
    }),

  clearTabPosition: (tabId) =>
    set((state) => {
      const { [tabId]: _, ...rest } = state.tabPositions;
      return { tabPositions: rest };
    }),
}));
