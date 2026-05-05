import { useEffect, useState, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "../../store/toastStore";
import { useGitStore } from "../../store/gitStore";
import { useUiStore } from "../../store/uiStore";
import { useGitRepository } from "../../infrastructure/GitRepositoryContext";
import { useRepoStore } from "../../store/repoStore";
import { useStagingIgnoreStore } from "../../store/stagingIgnoreStore";
import {
  getStatusUseCase,
  listTrackedFilesUseCase,
  stageFileUseCase,
  stagePathsUseCase,
  unstageFileUseCase,
  unstagePathsUseCase,
  stageAllUseCase,
  unstageAllUseCase,
  discardChangesUseCase,
  discardAllUseCase,
  getFileDiffUseCase,
  resetConflictFileUseCase,
  resetStagedConflictFileUseCase,
} from "../../usecases/staging";
import { loadPref } from "../../utils/localStorage";
import { buildTree } from "../../usecases/tree";
import type { TreeNode } from "../../usecases/tree";
import type { StatusEntry } from "../../domain/entities";
import { FileRow } from "../molecules/FileRow";
import { ContextMenu, type MenuItem } from "../molecules/ContextMenu";
import { openFolder } from "../../services/systemService";

type DisplayMode = "flat" | "group" | "tree";
type SortOrder = "name-asc" | "name-desc" | "status";

const STATUS_PRIORITY: Record<string, number> = {
  conflicted: 0,
  added: 1,
  modified: 2,
  deleted: 3,
  renamed: 4,
  untracked: 5,
  clean: 6,
  ignored: 7,
};


function sortEntries(entries: StatusEntry[], order: SortOrder, staged: boolean): StatusEntry[] {
  return [...entries].sort((a, b) => {
    if (order === "status") {
      const aStatus = staged ? a.staged : a.unstaged;
      const bStatus = staged ? b.staged : b.unstaged;
      const diff = (STATUS_PRIORITY[aStatus] ?? 9) - (STATUS_PRIORITY[bStatus] ?? 9);
      return diff !== 0 ? diff : a.path.localeCompare(b.path);
    }
    return order === "name-asc" ? a.path.localeCompare(b.path) : b.path.localeCompare(a.path);
  });
}

function countLeaves<T>(node: TreeNode<T>): number {
  if (node.item !== undefined) return 1;
  return node.children.reduce((sum, c) => sum + countLeaves(c), 0);
}

function collectLeaves<T>(nodes: TreeNode<T>[]): T[] {
  const result: T[] = [];
  for (const node of nodes) {
    if (node.item !== undefined) result.push(node.item);
    else result.push(...collectLeaves(node.children));
  }
  return result;
}

interface FileListProps {
  showDirActions?: boolean;
}

export function FileList({ showDirActions = true }: FileListProps = {}) {
  const { t } = useTranslation();
  const repo = useGitRepository();
  const { currentRepo } = useRepoStore();
  const { status, setStatus } = useGitStore();
  const ignoredPaths = useStagingIgnoreStore((s) => s.ignored[currentRepo?.path ?? ""]) ?? [];
  const toggleIgnore = useStagingIgnoreStore((s) => s.toggleIgnore);
  const ignoredSet = useMemo(() => new Set(ignoredPaths), [ignoredPaths]);
  const { selectedFilePath, selectedFileStaged, setSelectedFile, setCurrentDiff, ignoreWhitespace, repositoryState } = useUiStore();

  const [displayMode, setDisplayMode] = useState<DisplayMode>(() => loadPref("fileListMode", "flat"));
  const [sortOrder, setSortOrder] = useState<SortOrder>(() => loadPref("fileListSort", "name-asc"));
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set());
  const [multiStagedPaths, setMultiStagedPaths] = useState<Set<string>>(new Set());
  const [multiUnstagedPaths, setMultiUnstagedPaths] = useState<Set<string>>(new Set());
  const [confirmDiscard, setConfirmDiscard] = useState<StatusEntry | null>(null);
  const [confirmDiscardAll, setConfirmDiscardAll] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; path: string } | null>(null);
  const [stagedCollapsed, setStagedCollapsed] = useState(() => loadPref("stagedCollapsed", false));
  const [unstagedCollapsed, setUnstagedCollapsed] = useState(() => loadPref("unstagedCollapsed", false));

  const toggleStaged = () => {
    const next = !stagedCollapsed;
    localStorage.setItem("stagedCollapsed", JSON.stringify(next));
    setStagedCollapsed(next);
  };

  const toggleUnstaged = () => {
    const next = !unstagedCollapsed;
    localStorage.setItem("unstagedCollapsed", JSON.stringify(next));
    setUnstagedCollapsed(next);
  };

  const [showCleanFiles, setShowCleanFiles] = useState(() => loadPref("showCleanFiles", false));
  const [cleanFiles, setCleanFiles] = useState<string[]>([]);
  const [loadingClean, setLoadingClean] = useState(false);

  const loadCleanFiles = useCallback(async () => {
    setLoadingClean(true);
    try {
      setCleanFiles(await listTrackedFilesUseCase(repo));
    } catch {
      setCleanFiles([]);
    } finally {
      setLoadingClean(false);
    }
  }, [repo]);

  useEffect(() => {
    if (!showCleanFiles || !currentRepo) {
      setCleanFiles([]);
      return;
    }
    loadCleanFiles();
  }, [showCleanFiles, currentRepo?.path]);

  const modifiedPaths = useMemo(() => {
    const s = new Set<string>();
    for (const e of status) s.add(e.path);
    return s;
  }, [status]);

  const visibleCleanFiles = useMemo(
    () => cleanFiles.filter((p) => !modifiedPaths.has(p)),
    [cleanFiles, modifiedPaths]
  );

  const cleanEntries = useMemo<StatusEntry[]>(
    () => visibleCleanFiles.map((path) => ({ path, oldPath: null, staged: "clean" as const, unstaged: "clean" as const })),
    [visibleCleanFiles]
  );

  const [cleanCollapsed, setCleanCollapsed] = useState(() => loadPref("cleanCollapsed", false));

  const toggleClean = () => {
    const next = !cleanCollapsed;
    localStorage.setItem("cleanCollapsed", JSON.stringify(next));
    setCleanCollapsed(next);
  };

  const handleSelectClean = async (path: string) => {
    setMultiStagedPaths(new Set());
    setMultiUnstagedPaths(new Set());
    setCurrentDiff(null);
    setSelectedFile(path, false);
    try {
      setCurrentDiff(await getFileDiffUseCase(repo, path, false, ignoreWhitespace));
    } catch {
      setCurrentDiff(null);
    }
  };

  const renderCleanRow = (path: string, displayName?: string) => (
    <div
      key={`clean-${path}`}
      onClick={() => handleSelectClean(path)}
      onContextMenu={(e) => handleContextMenu(e, path)}
      title={path}
      className={`flex items-center gap-2 px-2 py-1.5 cursor-pointer hover:bg-surface-hover ${
        selectedFilePath === path && !selectedFileStaged ? "bg-surface-active" : "opacity-60"
      }`}
    >
      <span className="text-sm text-text-muted font-mono truncate">{displayName ?? path}</span>
    </div>
  );

  const renderCleanNodes = (nodes: TreeNode<StatusEntry>[], depth: number): React.ReactNode =>
    nodes.map((node) => {
      if (node.item) {
        return (
          <div key={`clean-${node.fullPath}`} style={{ paddingLeft: depth * 12 }}>
            {renderCleanRow(node.item.path, node.label)}
          </div>
        );
      }
      const isExpanded = expandedDirs.has(node.fullPath);
      const count = countLeaves(node);
      return (
        <div key={`clean-dir-${node.fullPath}`}>
          <div
            style={{ paddingLeft: depth * 12 }}
            className="flex items-center hover:bg-surface-hover transition-colors"
          >
            <button
              onClick={() => toggleDir(node.fullPath)}
              className="flex-1 text-left flex items-center gap-1.5 px-2 py-1 text-xs text-text-secondary hover:text-text-primary transition-colors opacity-60"
            >
              <span className="text-[10px] w-2.5 text-text-muted">{isExpanded ? "▼" : "▶"}</span>
              <span className="font-mono">{node.label}</span>
              <span className="text-text-muted text-[10px]">({count})</span>
            </button>
          </div>
          {isExpanded && renderCleanNodes(node.children, depth + 1)}
        </div>
      );
    });

  const renderCleanGrouped = (entries: StatusEntry[]): React.ReactNode => {
    const groups = new Map<string, StatusEntry[]>();
    for (const entry of entries) {
      const lastSlash = entry.path.lastIndexOf("/");
      const dir = lastSlash >= 0 ? entry.path.slice(0, lastSlash + 1) : "";
      if (!groups.has(dir)) groups.set(dir, []);
      groups.get(dir)!.push(entry);
    }
    const sortedGroups = [...groups.entries()].sort(([a], [b]) =>
      sortOrder === "name-desc" ? b.localeCompare(a) : a.localeCompare(b)
    );
    return sortedGroups.map(([dir, files]) => (
      <div key={`clean-grp-${dir || "root"}`}>
        {dir && (
          <div className="flex items-center px-2 py-1 bg-surface-elevated border-b border-surface-border opacity-60">
            <span className="flex-1 text-[10px] font-mono text-text-muted">{dir}</span>
          </div>
        )}
        {files.map((e) => renderCleanRow(e.path, e.path.split("/").slice(-1)[0]))}
      </div>
    ));
  };

  const renderCleanSection = (): React.ReactNode => {
    const sorted = sortEntries(cleanEntries, sortOrder, false);
    if (displayMode === "tree") {
      const tree = buildTree(sorted, (e) => e.path);
      return renderCleanNodes(tree, 0);
    }
    if (displayMode === "group") {
      return renderCleanGrouped(sorted);
    }
    return sorted.map((entry) => renderCleanRow(entry.path));
  };

  const refresh = async () => {
    try {
      setStatus(await getStatusUseCase(repo));
      setMultiStagedPaths(new Set());
      setMultiUnstagedPaths(new Set());
    } catch (e) {
      toast.error(String(e));
    }
  };

  useEffect(() => {
    refresh();
    setMultiStagedPaths(new Set());
    setMultiUnstagedPaths(new Set());
  }, [currentRepo?.path]);

  const setMode = (next: DisplayMode) => {
    localStorage.setItem("fileListMode", JSON.stringify(next));
    setDisplayMode(next);
    setExpandedDirs(new Set());
  };

  const toggleSort = () => {
    const cycle: SortOrder[] = ["name-asc", "name-desc", "status"];
    const next = cycle[(cycle.indexOf(sortOrder) + 1) % cycle.length];
    localStorage.setItem("fileListSort", JSON.stringify(next));
    setSortOrder(next);
  };

  const toggleDir = useCallback((path: string) => {
    setExpandedDirs((prev) => {
      const next = new Set(prev);
      next.has(path) ? next.delete(path) : next.add(path);
      return next;
    });
  }, []);

  const handleSelect = async (entry: StatusEntry, staged: boolean, e: React.MouseEvent) => {
    if (e.ctrlKey || e.metaKey) {
      if (staged) {
        setMultiStagedPaths((prev) => {
          const next = new Set(prev);
          // Implicitly include the currently selected file on first Ctrl+click
          if (next.size === 0 && selectedFilePath && selectedFileStaged === staged) {
            next.add(selectedFilePath);
          }
          next.has(entry.path) ? next.delete(entry.path) : next.add(entry.path);
          return next;
        });
      } else {
        setMultiUnstagedPaths((prev) => {
          const next = new Set(prev);
          if (next.size === 0 && selectedFilePath && selectedFileStaged === staged) {
            next.add(selectedFilePath);
          }
          next.has(entry.path) ? next.delete(entry.path) : next.add(entry.path);
          return next;
        });
      }
      return;
    }
    // Regular click: clear multi-selection
    setMultiStagedPaths(new Set());
    setMultiUnstagedPaths(new Set());
    setCurrentDiff(null);
    setSelectedFile(entry.path, staged);
    try {
      setCurrentDiff(await getFileDiffUseCase(repo, entry.path, staged, ignoreWhitespace));
    } catch (e) {
      toast.error(String(e));
      setCurrentDiff(null);
    }
  };

  const handleToggleStage = async (entry: StatusEntry, currentlyStaged: boolean) => {
    try {
      if (currentlyStaged) {
        await unstageFileUseCase(repo, entry.path);
      } else {
        await stageFileUseCase(repo, entry.path);
      }
      await refresh();
    } catch (e) {
      toast.error(String(e));
    }
  };

  const handleDiscard = (entry: StatusEntry) => {
    setConfirmDiscard(entry);
  };

  const handleDiscardConfirmed = async () => {
    if (!confirmDiscard) return;
    const entry = confirmDiscard;
    setConfirmDiscard(null);
    try {
      await discardChangesUseCase(repo, entry.path);
      if (entry.path === selectedFilePath) {
        setCurrentDiff(null);
        setSelectedFile(null);
      }
      await refresh();
    } catch (e) {
      toast.error(String(e));
    }
  };

  const handleDiscardAllConfirmed = async () => {
    setConfirmDiscardAll(false);
    try {
      await discardAllUseCase(repo);
      setCurrentDiff(null);
      setSelectedFile(null);
      await refresh();
    } catch (e) {
      toast.error(String(e));
    }
  };

  const handleMarkResolved = async (entry: StatusEntry) => {
    try {
      await stageFileUseCase(repo, entry.path);
      await refresh();
      toast.success(t("fileList.markedResolved", { path: entry.path }));
    } catch (e) {
      toast.error(String(e));
    }
  };

  const handleResetConflictFile = async (entry: StatusEntry) => {
    try {
      await resetConflictFileUseCase(repo, entry.path);
      await refresh();
    } catch (e) {
      toast.error(String(e));
    }
  };

  const handleContextMenu = (e: React.MouseEvent, path: string) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, path });
  };

  const buildMenuItems = (path: string): MenuItem[] => {
    const repoPath = currentRepo?.path;
    return [
      {
        id: "reveal-in-explorer",
        label: t("fileList.contextMenu.revealInExplorer"),
        icon: "📂",
        disabled: !repoPath,
        onClick: async () => {
          if (!repoPath) return;
          const idx = path.lastIndexOf("/");
          const absDir = idx === -1 ? repoPath : `${repoPath}/${path.slice(0, idx)}`;
          try {
            await openFolder(absDir);
          } catch (err) {
            toast.error(String(err));
          }
        },
      },
    ];
  };

  const handleResetStagedConflictFile = async (entry: StatusEntry) => {
    try {
      await resetStagedConflictFileUseCase(repo, entry.path);
      if (entry.path === selectedFilePath) setCurrentDiff(null);
      await refresh();
    } catch (e) {
      toast.error(String(e));
    }
  };

  const stagedEntries = status.filter((e) => e.staged !== "clean" && e.staged !== "ignored");
  const unstagedEntries = status.filter((e) => e.unstaged !== "clean" && e.unstaged !== "ignored");
  const conflictedEntries = unstagedEntries.filter((e) => e.unstaged === "conflicted");
  // During a merge, staged files are likely resolved conflicts — show them in the conflicts panel.
  const resolvedConflictEntries = repositoryState === "merge" ? stagedEntries : [];

  // ── Tree renderer ────────────────────────────────────────────────────────
  const renderNodes = (nodes: TreeNode<StatusEntry>[], staged: boolean, depth: number): React.ReactNode =>
    nodes.map((node) => {
      if (node.item) {
        const entry = node.item;
        const multiPaths = staged ? multiStagedPaths : multiUnstagedPaths;
        return (
          <div key={`${staged ? "s" : "u"}-${node.fullPath}`} style={{ paddingLeft: depth * 12 }}>
            <FileRow
              entry={entry}
              staged={staged}
              isSelected={selectedFilePath === entry.path && selectedFileStaged === staged}
              isMultiSelected={multiPaths.has(entry.path)}
              onSelect={(e) => handleSelect(entry, staged, e)}
              onToggleStage={() => handleToggleStage(entry, staged)}
              onDiscard={!staged ? () => handleDiscard(entry) : undefined}
              displayName={node.label}
              isIgnored={!staged ? ignoredSet.has(entry.path) : undefined}
              onToggleIgnore={!staged ? () => toggleIgnore(currentRepo!.path, entry.path) : undefined}
              onContextMenu={(e) => handleContextMenu(e, entry.path)}
            />
          </div>
        );
      }
      // Directory node
      const isExpanded = expandedDirs.has(node.fullPath);
      const count = countLeaves(node);
      const dirEntries = collectLeaves<StatusEntry>(node.children);
      return (
        <div key={`${staged ? "s" : "u"}-dir-${node.fullPath}`}>
          <div
            style={{ paddingLeft: depth * 12 }}
            className="flex items-center group hover:bg-surface-hover transition-colors"
          >
            <button
              onClick={() => toggleDir(node.fullPath)}
              className="flex-1 text-left flex items-center gap-1.5 px-2 py-1 text-xs text-text-secondary hover:text-text-primary transition-colors"
            >
              <span className="text-[10px] w-2.5 text-text-muted">{isExpanded ? "▼" : "▶"}</span>
              <span className="font-mono">{node.label}</span>
              <span className="text-text-muted text-[10px]">({count})</span>
            </button>
            {showDirActions && (
              <div className="flex gap-0.5 pr-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                {staged ? (
                  <button
                    onClick={async (e) => { e.stopPropagation(); await unstagePathsUseCase(repo, dirEntries.map(en => en.path)); await refresh(); }}
                    title={t("fileList.dir.unstage")}
                    className="text-xs text-text-secondary hover:text-text-primary px-1"
                  >−</button>
                ) : (
                  <button
                    onClick={async (e) => { e.stopPropagation(); await stagePathsUseCase(repo, dirEntries.filter(en => !ignoredSet.has(en.path)).map(en => en.path)); await refresh(); }}
                    title={t("fileList.dir.stage")}
                    className="text-xs text-text-secondary hover:text-text-primary px-1"
                  >+</button>
                )}
              </div>
            )}
          </div>
          {isExpanded && renderNodes(node.children, staged, depth + 1)}
        </div>
      );
    });

  const renderGrouped = (entries: StatusEntry[], staged: boolean): React.ReactNode => {
    const groups = new Map<string, StatusEntry[]>();
    for (const entry of entries) {
      const lastSlash = entry.path.lastIndexOf("/");
      const dir = lastSlash >= 0 ? entry.path.slice(0, lastSlash + 1) : "";
      if (!groups.has(dir)) groups.set(dir, []);
      groups.get(dir)!.push(entry);
    }
    const sortedGroups = [...groups.entries()].sort(([a], [b]) =>
      sortOrder === "name-desc" ? b.localeCompare(a) : a.localeCompare(b)
    );
    return sortedGroups.map(([dir, files]) => (
      <div key={`${staged ? "s" : "u"}-grp-${dir || "root"}`}>
        {dir && (
          <div className="flex items-center group px-2 py-1 bg-surface-elevated border-b border-surface-border">
            <span className="flex-1 text-[10px] font-mono text-text-muted">{dir}</span>
            <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
              {staged ? (
                <button
                  onClick={async (e) => { e.stopPropagation(); await unstagePathsUseCase(repo, files.map(en => en.path)); await refresh(); }}
                  title={t("fileList.group.unstage")}
                  className="text-xs text-text-secondary hover:text-text-primary px-1"
                >−</button>
              ) : (
                <button
                  onClick={async (e) => { e.stopPropagation(); await stagePathsUseCase(repo, files.filter(en => !ignoredSet.has(en.path)).map(en => en.path)); await refresh(); }}
                  title={t("fileList.group.stage")}
                  className="text-xs text-text-secondary hover:text-text-primary px-1"
                >+</button>
              )}
            </div>
          </div>
        )}
        {files.map((entry) => {
          const multiPaths = staged ? multiStagedPaths : multiUnstagedPaths;
          return (
            <FileRow
              key={`${staged ? "staged" : "unstaged"}-${entry.path}`}
              entry={entry}
              staged={staged}
              isSelected={selectedFilePath === entry.path && selectedFileStaged === staged}
              isMultiSelected={multiPaths.has(entry.path)}
              onSelect={(e) => handleSelect(entry, staged, e)}
              onToggleStage={() => handleToggleStage(entry, staged)}
              onDiscard={!staged ? () => handleDiscard(entry) : undefined}
              displayName={entry.path.split("/").slice(-1)[0]}
              isIgnored={!staged ? ignoredSet.has(entry.path) : undefined}
              onToggleIgnore={!staged ? () => toggleIgnore(currentRepo!.path, entry.path) : undefined}
              onContextMenu={(e) => handleContextMenu(e, entry.path)}
            />
          );
        })}
      </div>
    ));
  };

  const renderSection = (entries: StatusEntry[], staged: boolean) => {
    const sorted = sortEntries(entries, sortOrder, staged);
    if (displayMode === "tree") {
      const tree = buildTree(sorted, (e) => e.path);
      return renderNodes(tree, staged, 0);
    }
    if (displayMode === "group") {
      return renderGrouped(sorted, staged);
    }
    const multiPaths = staged ? multiStagedPaths : multiUnstagedPaths;
    return sorted.map((entry) => (
      <FileRow
        key={`${staged ? "staged" : "unstaged"}-${entry.path}`}
        entry={entry}
        staged={staged}
        isSelected={selectedFilePath === entry.path && selectedFileStaged === staged}
        isMultiSelected={multiPaths.has(entry.path)}
        onSelect={(e) => handleSelect(entry, staged, e)}
        onToggleStage={() => handleToggleStage(entry, staged)}
        onDiscard={!staged ? () => handleDiscard(entry) : undefined}
        isIgnored={!staged ? ignoredSet.has(entry.path) : undefined}
        onToggleIgnore={!staged ? () => toggleIgnore(currentRepo!.path, entry.path) : undefined}
        onContextMenu={(e) => handleContextMenu(e, entry.path)}
      />
    ));
  };

  return (
    <div className="flex flex-col h-full overflow-hidden text-sm">

      {/* Controls */}
      <div className="flex items-center gap-1 px-2 py-1 border-b border-surface-border bg-surface-base shrink-0">
        {(["flat", "group", "tree"] as DisplayMode[]).map((mode) => {
          const labels: Record<DisplayMode, { icon: string; titleKey: string }> = {
            flat:  { icon: "≡", titleKey: "fileList.mode.flat" },
            group: { icon: "▤", titleKey: "fileList.mode.group" },
            tree:  { icon: "⊞", titleKey: "fileList.mode.tree" },
          };
          const isActive = displayMode === mode;
          return (
            <button
              key={mode}
              onClick={() => setMode(mode)}
              title={t(labels[mode].titleKey)}
              className={`text-xs px-1.5 py-0.5 rounded border transition-colors ${
                isActive
                  ? "border-blue-500/50 text-blue-400 bg-blue-500/10"
                  : "border-surface-border text-text-muted hover:text-text-primary"
              }`}
            >
              {labels[mode].icon}
            </button>
          );
        })}
        <div className="w-px h-3 bg-surface-border mx-0.5" />
        <button
          onClick={toggleSort}
          title={t(`fileList.sort.${sortOrder === "name-asc" ? "azTitle" : sortOrder === "name-desc" ? "zaTitle" : "statusTitle"}`)}
          className={`text-xs px-1.5 py-0.5 rounded border transition-colors ${
            sortOrder === "status"
              ? "border-blue-500/50 text-blue-400 bg-blue-500/10"
              : "border-surface-border text-text-muted hover:text-text-primary"
          }`}
        >
          {sortOrder === "name-asc" ? t("fileList.sort.az") : sortOrder === "name-desc" ? t("fileList.sort.za") : t("fileList.sort.status")}
        </button>
        <div className="w-px h-3 bg-surface-border mx-0.5" />
        <button
          onClick={() => {
            const next = !showCleanFiles;
            localStorage.setItem("showCleanFiles", JSON.stringify(next));
            setShowCleanFiles(next);
          }}
          title={t(showCleanFiles ? "fileList.hideCleanTitle" : "fileList.showCleanTitle")}
          className={`text-xs px-1.5 py-0.5 rounded border transition-colors ${
            showCleanFiles
              ? "border-blue-500/50 text-blue-400 bg-blue-500/10"
              : "border-surface-border text-text-muted hover:text-text-primary"
          }`}
        >
          ○
        </button>
      </div>

      {/* Staged */}
      <div className={stagedCollapsed ? "shrink-0" : "flex-1 overflow-y-auto"}>
        <div className="flex items-center justify-between px-2 py-1.5 bg-surface-elevated border-b border-surface-border sticky top-0 z-10">
          <button
            onClick={toggleStaged}
            className="flex items-center gap-1.5 text-xs text-text-secondary uppercase tracking-wide font-medium hover:text-text-primary transition-colors"
          >
            <span className={`transition-transform duration-150 ${stagedCollapsed ? "-rotate-90" : ""}`}>▾</span>
            {t("fileList.staged", { count: stagedEntries.length })}
          </button>
          <div className="flex items-center gap-2">
            {multiStagedPaths.size > 0 && (
              <button
                onClick={async () => {
                  await unstagePathsUseCase(repo, [...multiStagedPaths]);
                  await refresh();
                }}
                className="text-xs text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300"
              >
                {t("fileList.unstageSelected", { count: multiStagedPaths.size })}
              </button>
            )}
            {stagedEntries.length > 0 && (
              <button
                onClick={async () => { await unstageAllUseCase(repo); await refresh(); }}
                className="text-xs text-text-secondary hover:text-text-primary"
              >
                {t("fileList.unstageAll")}
              </button>
            )}
          </div>
        </div>
        {!stagedCollapsed && renderSection(stagedEntries, true)}
        {!stagedCollapsed && stagedEntries.length === 0 && (
          <p className="text-xs text-text-muted px-3 py-2">{t("fileList.nothingStaged")}</p>
        )}
      </div>

      {/* Conflicts */}
      {(conflictedEntries.length > 0 || resolvedConflictEntries.length > 0) && (
        <div className="border-t border-orange-500/30 shrink-0">
          <div className="flex items-center px-2 py-1.5 bg-orange-500/10 border-b border-orange-500/20 sticky top-0 z-10">
            <span className="text-xs text-orange-400 uppercase tracking-wide font-medium">
              {t("fileList.conflicts", { count: conflictedEntries.length })}
            </span>
          </div>
          {conflictedEntries.map((entry) => (
            <div
              key={`conflict-${entry.path}`}
              className="flex items-center gap-2 px-3 py-1.5 hover:bg-surface-hover group"
            >
              <button
                onClick={(e) => handleSelect(entry, false, e)}
                className="flex-1 text-left text-xs font-mono text-orange-300 truncate"
              >
                {entry.path}
              </button>
              <span className="text-[10px] text-red-400 shrink-0">{t("fileList.conflict.pending")}</span>
              <button
                onClick={() => handleResetConflictFile(entry)}
                className="opacity-0 group-hover:opacity-100 text-[10px] px-2 py-0.5 rounded text-text-muted hover:text-orange-300 hover:bg-orange-500/10 border border-surface-border hover:border-orange-500/30 transition-all shrink-0"
                title={t("fileList.conflict.resetTitle")}
              >
                ↺
              </button>
              <button
                onClick={() => handleMarkResolved(entry)}
                className="opacity-0 group-hover:opacity-100 text-[10px] px-2 py-0.5 rounded text-green-400 hover:bg-green-500/10 border border-green-500/30 transition-all shrink-0"
              >
                {t("fileList.conflict.markResolved")}
              </button>
            </div>
          ))}
          {resolvedConflictEntries.length > 0 && (
            <>
              <div className="px-2 py-1 bg-surface-elevated border-b border-surface-border border-t border-orange-500/10">
                <span className="text-[10px] text-text-muted uppercase tracking-wide">{t("fileList.conflict.resolvedSection")}</span>
              </div>
              {resolvedConflictEntries.map((entry) => (
                <div
                  key={`resolved-${entry.path}`}
                  className="flex items-center gap-2 px-3 py-1.5 hover:bg-surface-hover group"
                >
                  <button
                    onClick={(e) => handleSelect(entry, true, e)}
                    className="flex-1 text-left text-xs font-mono text-green-400 truncate"
                  >
                    {entry.path}
                  </button>
                  <span className="text-[10px] text-green-400 shrink-0">{t("fileList.conflict.resolved")}</span>
                  <button
                    onClick={() => handleResetStagedConflictFile(entry)}
                    className="opacity-0 group-hover:opacity-100 text-[10px] px-2 py-0.5 rounded text-text-muted hover:text-orange-300 hover:bg-orange-500/10 border border-surface-border hover:border-orange-500/30 transition-all shrink-0"
                    title={t("fileList.conflict.resetTitle")}
                  >
                    ↺
                  </button>
                </div>
              ))}
            </>
          )}
        </div>
      )}

      {/* Unstaged */}
      <div className={`${unstagedCollapsed ? "shrink-0" : "flex-1 overflow-y-auto"} border-t border-surface-border`}>
        <div className="flex items-center justify-between px-2 py-1.5 bg-surface-elevated border-b border-surface-border sticky top-0 z-10">
          <button
            onClick={toggleUnstaged}
            className="flex items-center gap-1.5 text-xs text-text-secondary uppercase tracking-wide font-medium hover:text-text-primary transition-colors"
          >
            <span className={`transition-transform duration-150 ${unstagedCollapsed ? "-rotate-90" : ""}`}>▾</span>
            {t("fileList.unstaged", { count: unstagedEntries.length })}
          </button>
          <div className="flex items-center gap-2">
            {multiUnstagedPaths.size > 0 && (
              <button
                onClick={async () => {
                  await stagePathsUseCase(repo, [...multiUnstagedPaths]);
                  await refresh();
                }}
                className="text-xs text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300"
              >
                {t("fileList.stageSelected", { count: multiUnstagedPaths.size })}
              </button>
            )}
            {unstagedEntries.length > 0 && (
              <>
                <button
                  onClick={() => setConfirmDiscardAll(true)}
                  className="text-xs text-red-400/70 hover:text-red-400"
                >
                  {t("fileList.discardAll")}
                </button>
                <button
                  onClick={async () => {
                    if (ignoredSet.size === 0) {
                      await stageAllUseCase(repo);
                    } else {
                      await stagePathsUseCase(repo, unstagedEntries.filter(e => !ignoredSet.has(e.path)).map(e => e.path));
                    }
                    await refresh();
                  }}
                  className="text-xs text-text-secondary hover:text-text-primary"
                >
                  {t("fileList.stageAll")}
                </button>
              </>
            )}
          </div>
        </div>
        {!unstagedCollapsed && renderSection(unstagedEntries, false)}
        {!unstagedCollapsed && unstagedEntries.length === 0 && (
          <p className="text-xs text-text-muted px-3 py-2">{t("fileList.nothingToCommit")}</p>
        )}
      </div>

      {/* Clean files */}
      {showCleanFiles && (
        <div className={`${cleanCollapsed ? "shrink-0" : "flex-1 overflow-y-auto"} border-t border-surface-border`}>
          <div className="flex items-center justify-between px-2 py-1.5 bg-surface-elevated border-b border-surface-border sticky top-0 z-10">
            <button
              onClick={toggleClean}
              className="flex items-center gap-1.5 text-xs text-text-muted uppercase tracking-wide font-medium hover:text-text-primary transition-colors"
            >
              <span className={`transition-transform duration-150 ${cleanCollapsed ? "-rotate-90" : ""}`}>▾</span>
              {loadingClean ? t("fileList.cleanLoading") : t("fileList.clean", { count: visibleCleanFiles.length })}
            </button>
          </div>
          {!cleanCollapsed && renderCleanSection()}
          {!cleanCollapsed && !loadingClean && visibleCleanFiles.length === 0 && (
            <p className="text-xs text-text-muted px-3 py-2">{t("fileList.cleanEmpty")}</p>
          )}
        </div>
      )}

      {/* Discard all confirmation dialog */}
      {confirmDiscardAll && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-surface-elevated border border-surface-border rounded-xl shadow-2xl w-full max-w-sm mx-4 p-5 flex flex-col gap-4">
            <p className="text-sm text-text-primary">
              {t("fileList.discardAllConfirm")}
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setConfirmDiscardAll(false)}
                className="px-4 py-2 text-sm text-text-secondary hover:text-text-primary transition-colors"
              >
                {t("common.cancel")}
              </button>
              <button
                onClick={handleDiscardAllConfirmed}
                className="px-4 py-2 text-sm font-medium bg-red-600 hover:bg-red-500 text-white rounded-md transition-colors"
              >
                {t("fileList.discardAllConfirmBtn")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Context menu */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={buildMenuItems(contextMenu.path)}
          onClose={() => setContextMenu(null)}
        />
      )}

      {/* Discard confirmation dialog */}
      {confirmDiscard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-surface-elevated border border-surface-border rounded-xl shadow-2xl w-full max-w-sm mx-4 p-5 flex flex-col gap-4">
            <p className="text-sm text-text-primary">
              {t("fileList.discardConfirm", { path: confirmDiscard.path })}
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setConfirmDiscard(null)}
                className="px-4 py-2 text-sm text-text-secondary hover:text-text-primary transition-colors"
              >
                {t("common.cancel")}
              </button>
              <button
                onClick={handleDiscardConfirmed}
                className="px-4 py-2 text-sm font-medium bg-red-600 hover:bg-red-500 text-white rounded-md transition-colors"
              >
                {t("fileList.discardConfirmBtn")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
