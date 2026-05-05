import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useUiStore } from "../../store/uiStore";
import { useGitStore } from "../../store/gitStore";
import { useGitRepository } from "../../infrastructure/GitRepositoryContext";
import { resetToCommitUseCase, revertCommitUseCase, getCommitFileDiffUseCase } from "../../usecases/history";
import { getStatusUseCase } from "../../usecases/staging";
import { toast } from "../../store/toastStore";
import type { ChangedFileSummary, FileDiff } from "../../domain/entities";
import type { ResetMode } from "../../usecases/history";
import { MiniDiff } from "../molecules/MiniDiff";
import { FileHistoryPanel } from "./FileHistoryPanel";
import { FileEditor } from "./FileEditor";
import { buildTree } from "../../usecases/tree";
import type { TreeNode } from "../../usecases/tree";

const RESET_MODES: { mode: ResetMode; danger: boolean }[] = [
  { mode: "soft",  danger: false },
  { mode: "mixed", danger: false },
  { mode: "hard",  danger: true  },
];

function fileStatusClass(status: string): string | null {
  if (status === "added")    return "text-green-400";
  if (status === "deleted")  return "text-red-400";
  if (status === "renamed")  return "text-yellow-400";
  if (status === "copied")   return "text-blue-400";
  if (status === "modified") return "text-text-muted";
  return null;
}

type DiffState = "collapsed" | "loading" | FileDiff | "error";

export function CommitDetailPanel() {
  const { t } = useTranslation();
  const { currentCommitDetail, setCurrentCommitDetail, setBlameTarget, setActiveView, ignoreWhitespace } = useUiStore();
  const { bumpLogVersion, setStatus, branches, tags } = useGitStore();
  const repo = useGitRepository();

  const [showReset, setShowReset] = useState(false);
  const [resetMode, setResetMode] = useState<ResetMode>("mixed");
  const [showRevert, setShowRevert] = useState(false);
  const [busy, setBusy] = useState(false);
  const [historyFile, setHistoryFile] = useState<string | null>(null);
  const [editFile, setEditFile] = useState<string | null>(null);
  // Per-file diff state keyed by file path
  const [diffs, setDiffs] = useState<Map<string, DiffState>>(new Map());

  // File list controls
  const [displayMode, setDisplayMode] = useState<"flat" | "group" | "tree">("flat");
  const [sortOrder, setSortOrder] = useState<"name-asc" | "name-desc">("name-asc");
  const [filterText, setFilterText] = useState("");
  const [filterStatuses, setFilterStatuses] = useState<Set<string>>(new Set());
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set());

  // Reset filters when commit changes
  useEffect(() => {
    setFilterText("");
    setFilterStatuses(new Set());
    setExpandedDirs(new Set());
    setDiffs(new Map());
    setHistoryFile(null);
    setEditFile(null);
  }, [currentCommitDetail?.oid]);

  const getPath = (f: ChangedFileSummary) => f.newPath ?? f.oldPath ?? "";

  const toggleStatus = (status: string) => {
    setFilterStatuses((prev) => {
      const next = new Set(prev);
      next.has(status) ? next.delete(status) : next.add(status);
      return next;
    });
  };

  const toggleDir = useCallback((path: string) => {
    setExpandedDirs((prev) => {
      const next = new Set(prev);
      next.has(path) ? next.delete(path) : next.add(path);
      return next;
    });
  }, []);

  const handleReset = async () => {
    if (!currentCommitDetail) return;
    setBusy(true);
    try {
      await resetToCommitUseCase(repo, currentCommitDetail.oid, resetMode);
      setStatus(await getStatusUseCase(repo));
      bumpLogVersion();
      setCurrentCommitDetail(null);
      setShowReset(false);
      toast.success(t("commitDetail.reset.done", { mode: resetMode }));
    } catch (e) {
      toast.error(String(e));
    } finally {
      setBusy(false);
    }
  };

  const handleRevert = async () => {
    if (!currentCommitDetail) return;
    setBusy(true);
    try {
      await revertCommitUseCase(repo, currentCommitDetail.oid);
      bumpLogVersion();
      setShowRevert(false);
      toast.success(t("commitDetail.revert.done"));
    } catch (e) {
      toast.error(String(e));
    } finally {
      setBusy(false);
    }
  };

  const toggleDiff = async (file: ChangedFileSummary) => {
    const path = file.newPath ?? file.oldPath ?? "";
    if (!currentCommitDetail || !path) return;

    const current = diffs.get(path) ?? "collapsed";
    if (current !== "collapsed" && current !== "error") {
      // Collapse
      setDiffs((prev) => new Map(prev).set(path, "collapsed"));
      return;
    }

    // Load
    setDiffs((prev) => new Map(prev).set(path, "loading"));
    try {
      const fileDiff = await getCommitFileDiffUseCase(repo, currentCommitDetail.oid, path, ignoreWhitespace);
      setDiffs((prev) => new Map(prev).set(path, fileDiff));
    } catch (e) {
      setDiffs((prev) => new Map(prev).set(path, "error"));
      toast.error(String(e));
    }
  };

  if (!currentCommitDetail) {
    return (
      <div className="flex items-center justify-center h-full text-text-muted text-sm">
        {t("commitDetail.selectCommit")}
      </div>
    );
  }

  const d = currentCommitDetail;
  const commitBranches = branches.filter((b) => b.headOid === d.oid);
  const commitTags = tags.filter((tag) => tag.targetOid === d.oid);

  return (
    <div className="relative h-full overflow-hidden">
      <div className="flex flex-col h-full overflow-y-auto p-4 gap-4">
        {/* Header */}
        <div>
          <h2 className="text-base font-semibold text-text-primary mb-1">{d.summary}</h2>
          {d.body && <p className="text-sm text-text-secondary whitespace-pre-wrap">{d.body}</p>}
        </div>

        {/* Branches & tags */}
        {(commitBranches.length > 0 || commitTags.length > 0) && (
          <div className="flex flex-wrap gap-1.5">
            {commitBranches.map((branch) => (
              <span
                key={branch.name}
                className={`inline-flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.5 rounded ${
                  branch.isRemote
                    ? "bg-sky-500/15 text-sky-400"
                    : branch.isHead
                    ? "bg-violet-500/25 text-violet-700 dark:text-violet-300 font-semibold ring-1 ring-violet-500/40"
                    : "bg-green-500/15 text-green-400"
                }`}
              >
                ⎇ {branch.name}
              </span>
            ))}
            {commitTags.map((tag) => (
              <span
                key={tag.name}
                className={`inline-flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.5 rounded ${
                  tag.isAnnotated ? "bg-blue-500/15 text-blue-400" : "bg-amber-500/15 text-amber-400"
                }`}
              >
                {tag.name}
              </span>
            ))}
          </div>
        )}

        {/* Meta */}
        <dl className="text-xs text-text-secondary grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
          <dt className="text-text-muted">{t("commitDetail.commit")}</dt>
          <dd className="font-mono text-text-primary flex items-center gap-2">
            {d.shortOid}
            {d.isSignedCommit && (
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-green-900/30 text-green-400 border border-green-800/40 tracking-wide">
                {t("commitDetail.signed")}
              </span>
            )}
          </dd>
          <dt className="text-text-muted">{t("commitDetail.author")}</dt>
          <dd>{d.author.name} &lt;{d.author.email}&gt;</dd>
          <dt className="text-text-muted">{t("commitDetail.date")}</dt>
          <dd>{new Date(d.author.when * 1000).toLocaleString()}</dd>
          {d.parentOids.length > 0 && (
            <>
              <dt className="text-text-muted">{t("commitDetail.parents")}</dt>
              <dd className="font-mono">{d.parentOids.map((p) => p.slice(0, 7)).join(", ")}</dd>
            </>
          )}
        </dl>

        {/* Actions */}
        <div className="flex items-center gap-2 pt-1 border-t border-surface-border">
          <button
            onClick={() => setShowReset(true)}
            className="text-xs px-3 py-1.5 bg-surface-overlay hover:bg-surface-active text-text-primary rounded border border-surface-border transition-colors"
          >
            {t("commitDetail.resetHere")}
          </button>
          <button
            onClick={() => setShowRevert(true)}
            className="text-xs px-3 py-1.5 bg-surface-overlay hover:bg-surface-active text-text-primary rounded border border-surface-border transition-colors"
          >
            {t("commitDetail.revert")}
          </button>
          {diffs.size > 0 && (
            <button
              onClick={() => setDiffs(new Map())}
              className="text-xs px-3 py-1.5 text-text-muted hover:text-text-primary transition-colors ml-auto"
            >
              {t("commitDetail.collapseAll")}
            </button>
          )}
        </div>

        {/* Changed files */}
        {(() => {
          // Compute filtered + sorted list
          const statusCounts = new Map<string, number>();
          for (const f of d.changedFiles) statusCounts.set(f.status, (statusCounts.get(f.status) ?? 0) + 1);

          const filtered = d.changedFiles
            .filter((f) => {
              const path = getPath(f);
              if (filterText && !path.toLowerCase().includes(filterText.toLowerCase())) return false;
              if (filterStatuses.size > 0 && !filterStatuses.has(f.status)) return false;
              return true;
            })
            .sort((a, b) => {
              const pa = getPath(a), pb = getPath(b);
              return sortOrder === "name-asc" ? pa.localeCompare(pb) : pb.localeCompare(pa);
            });

          const renderFileCard = (file: ChangedFileSummary, displayName?: string) => {
            const statusClass = fileStatusClass(file.status);
            const path = getPath(file);
            const diffState = diffs.get(path) ?? "collapsed";
            const isOpen = diffState !== "collapsed" && diffState !== "loading";
            const isLoading = diffState === "loading";
            return (
              <div key={path} className="border border-surface-border rounded overflow-hidden">
                <div className="flex items-center gap-2 px-3 py-1.5 bg-surface-overlay">
                  {!file.isBinary && (
                    <button
                      onClick={() => toggleDiff(file)}
                      className="text-text-muted hover:text-text-primary transition-colors shrink-0 w-3.5 text-center"
                      title={isOpen ? t("commitDetail.collapse") : t("commitDetail.expand")}
                    >
                      {isLoading ? (
                        <span className="w-3 h-3 rounded-full border border-text-muted border-t-transparent animate-spin inline-block" />
                      ) : (
                        <span>{isOpen ? "▼" : "▶"}</span>
                      )}
                    </button>
                  )}
                  <p className="text-sm text-text-primary font-mono flex-1 min-w-0 truncate" title={path}>
                    {displayName ?? path}
                    {statusClass && <span className={`${statusClass} ml-1.5 font-sans text-xs`}>({t(`commitDetail.status.${file.status}`)})</span>}
                    {file.isBinary && <span className="text-text-muted ml-1.5 font-sans text-xs">({t("commitDetail.binary")})</span>}
                  </p>
                  {path && !file.isBinary && (
                    <>
                      <button
                        onClick={() => setEditFile(path)}
                        className="text-xs px-2 py-0.5 text-text-muted hover:text-text-primary border border-surface-border hover:border-text-muted rounded transition-colors shrink-0"
                      >{t("fileEditor.buttonLabel")}</button>
                      <button
                        onClick={() => setHistoryFile(path)}
                        className="text-xs px-2 py-0.5 text-text-muted hover:text-text-primary border border-surface-border hover:border-text-muted rounded transition-colors shrink-0"
                      >{t("fileHistory.buttonLabel")}</button>
                      {file.status === "deleted" ? (
                        <span title={t("commitDetail.blameUnavailable")} className="text-xs px-2 py-0.5 text-text-muted border border-surface-border rounded opacity-40 cursor-not-allowed shrink-0">{t("commitDetail.blame")}</span>
                      ) : (
                        <button
                          onClick={() => { setBlameTarget({ path, commitOid: d.oid }); setActiveView("blame"); }}
                          className="text-xs px-2 py-0.5 text-text-muted hover:text-text-primary border border-surface-border hover:border-text-muted rounded transition-colors shrink-0"
                        >{t("commitDetail.blame")}</button>
                      )}
                    </>
                  )}
                </div>
                {isOpen && typeof diffState === "object" && (
                  <div className="border-t border-surface-border"><MiniDiff hunks={diffState.hunks} filename={path} /></div>
                )}
                {diffState === "error" && (
                  <p className="text-xs text-red-400 px-3 py-2 border-t border-surface-border">{t("commitDetail.diffError")}</p>
                )}
              </div>
            );
          };

          const renderGrouped = (files: ChangedFileSummary[]): React.ReactNode => {
            const groups = new Map<string, ChangedFileSummary[]>();
            for (const f of files) {
              const p = getPath(f);
              const lastSlash = p.lastIndexOf("/");
              const dir = lastSlash >= 0 ? p.slice(0, lastSlash + 1) : "";
              if (!groups.has(dir)) groups.set(dir, []);
              groups.get(dir)!.push(f);
            }
            const sorted = [...groups.entries()].sort(([a], [b]) =>
              sortOrder === "name-asc" ? a.localeCompare(b) : b.localeCompare(a)
            );
            return sorted.map(([dir, groupFiles]) => (
              <div key={`grp-${dir || "root"}`} className="flex flex-col gap-1">
                {dir && (
                  <div className="px-2 py-1 bg-surface-elevated border border-surface-border rounded-t -mb-1">
                    <span className="text-[10px] font-mono text-text-muted">{dir}</span>
                  </div>
                )}
                {groupFiles.map((f) => renderFileCard(f, getPath(f).split("/").slice(-1)[0]))}
              </div>
            ));
          };

          const renderTreeNodes = (nodes: TreeNode<ChangedFileSummary>[], depth: number): React.ReactNode =>
            nodes.map((node) => {
              if (node.item) return (
                <div key={node.fullPath} style={{ paddingLeft: depth * 12 }}>
                  {renderFileCard(node.item, node.label)}
                </div>
              );
              const isExpanded = expandedDirs.has(node.fullPath);
              const count = node.children.reduce(function count(s: number, c: TreeNode<ChangedFileSummary>): number {
                return s + (c.item ? 1 : c.children.reduce(count, 0));
              }, 0);
              return (
                <div key={node.fullPath}>
                  <button
                    onClick={() => toggleDir(node.fullPath)}
                    style={{ paddingLeft: depth * 12 }}
                    className="w-full text-left flex items-center gap-1.5 px-2 py-1 text-xs text-text-secondary hover:text-text-primary hover:bg-surface-hover transition-colors"
                  >
                    <span className="text-[10px] w-2.5 text-text-muted">{isExpanded ? "▼" : "▶"}</span>
                    <span className="font-mono">{node.label}</span>
                    <span className="text-text-muted text-[10px]">({count})</span>
                  </button>
                  {isExpanded && renderTreeNodes(node.children, depth + 1)}
                </div>
              );
            });

          const STATUS_META: Record<string, { labelKey: string; className: string }> = {
            added:    { labelKey: "commitDetail.status.added",    className: "text-green-400 border-green-500/40 bg-green-500/10" },
            modified: { labelKey: "commitDetail.status.modified", className: "text-text-muted border-surface-border bg-surface-overlay" },
            deleted:  { labelKey: "commitDetail.status.deleted",  className: "text-red-400 border-red-500/40 bg-red-500/10" },
            renamed:  { labelKey: "commitDetail.status.renamed",  className: "text-yellow-400 border-yellow-500/40 bg-yellow-500/10" },
            copied:   { labelKey: "commitDetail.status.copied",   className: "text-blue-400 border-blue-500/40 bg-blue-500/10" },
          };

          return (
            <div>
              {/* Controls */}
              <div className="flex flex-col gap-1.5 mb-2">
                <div className="flex items-center gap-1">
                  <span className="text-xs text-text-secondary uppercase tracking-wide font-medium flex-1">
                    {filtered.length !== d.changedFiles.length
                      ? t("commitDetail.filesChangedFiltered", { count: filtered.length, total: d.changedFiles.length })
                      : t("commitDetail.filesChanged", { count: filtered.length })}
                  </span>
                  {/* Mode buttons */}
                  {(["flat", "group", "tree"] as const).map((mode) => {
                    const icons = { flat: "≡", group: "▤", tree: "⊞" };
                    const titleKeys: Record<string, string> = { flat: "commitDetail.flat", group: "commitDetail.grouped", tree: "commitDetail.tree" };
                    return (
                      <button
                        key={mode}
                        onClick={() => setDisplayMode(mode)}
                        title={t(titleKeys[mode])}
                        className={`text-xs px-1.5 py-0.5 rounded border transition-colors ${
                          displayMode === mode
                            ? "border-blue-500/50 text-blue-400 bg-blue-500/10"
                            : "border-surface-border text-text-muted hover:text-text-primary"
                        }`}
                      >{icons[mode]}</button>
                    );
                  })}
                  <div className="w-px h-3 bg-surface-border mx-0.5" />
                  <button
                    onClick={() => setSortOrder(sortOrder === "name-asc" ? "name-desc" : "name-asc")}
                    title={sortOrder === "name-asc" ? t("commitDetail.sortAZ") : t("commitDetail.sortZA")}
                    className="text-xs px-1.5 py-0.5 rounded border border-surface-border text-text-muted hover:text-text-primary transition-colors"
                  >{sortOrder === "name-asc" ? t("commitDetail.sortAZ") : t("commitDetail.sortZA")}</button>
                </div>

                {/* Search */}
                <input
                  type="text"
                  value={filterText}
                  onChange={(e) => setFilterText(e.target.value)}
                  placeholder={t("commitDetail.filterPlaceholder")}
                  className="w-full bg-surface-elevated text-text-primary text-xs rounded px-2 py-1 border border-surface-border focus:outline-none focus:border-blue-500 placeholder:text-text-muted"
                />

                {/* Status badges */}
                {statusCounts.size > 1 && (
                  <div className="flex flex-wrap gap-1">
                    {Object.entries(STATUS_META).map(([status, meta]) => {
                      const count = statusCounts.get(status);
                      if (!count) return null;
                      const active = filterStatuses.has(status);
                      return (
                        <button
                          key={status}
                          onClick={() => toggleStatus(status)}
                          className={`text-[10px] px-1.5 py-0.5 rounded border transition-colors ${
                            active ? meta.className : "text-text-muted border-surface-border hover:text-text-primary"
                          }`}
                        >{t(meta.labelKey)} {count}</button>
                      );
                    })}
                    {filterStatuses.size > 0 && (
                      <button
                        onClick={() => setFilterStatuses(new Set())}
                        className="text-[10px] px-1.5 py-0.5 text-text-muted hover:text-text-primary transition-colors"
                      >{t("commitDetail.clearFilter")}</button>
                    )}
                  </div>
                )}
              </div>

              {/* File list */}
              <div className="flex flex-col gap-1">
                {filtered.length === 0 && (
                  <p className="text-xs text-text-muted py-2">{t("commitDetail.noFileMatch")}</p>
                )}
                {displayMode === "flat" && filtered.map((file) => renderFileCard(file))}
                {displayMode === "group" && renderGrouped(filtered)}
                {displayMode === "tree" && renderTreeNodes(buildTree(filtered, getPath), 0)}
              </div>
            </div>
          );
        })()}
      </div>

      {/* Reset dialog */}
      {showReset && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-surface-elevated border border-surface-border rounded-xl shadow-2xl w-full max-w-sm mx-4 p-5 flex flex-col gap-4">
            <div>
              <p className="text-sm font-semibold text-text-primary">{t("commitDetail.reset.title")}</p>
              <p className="text-xs text-text-muted mt-0.5 font-mono">{d.shortOid} — {d.summary}</p>
            </div>
            <div className="flex flex-col gap-2">
              {RESET_MODES.map(({ mode, danger }) => (
                <label key={mode} className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="radio"
                    name="reset-mode"
                    value={mode}
                    checked={resetMode === mode}
                    onChange={() => setResetMode(mode)}
                    className="mt-0.5 accent-blue-500"
                  />
                  <span>
                    <span className={`text-sm font-medium ${danger ? "text-red-400" : "text-text-primary"}`}>{t(`commitDetail.reset.${mode}`)}</span>
                    <span className="text-xs text-text-secondary block">{t(`commitDetail.reset.${mode}Desc`)}</span>
                  </span>
                </label>
              ))}
            </div>
            {resetMode === "hard" && (
              <p className="text-xs text-red-400 bg-red-500/10 rounded-md px-3 py-2">
                {t("commitDetail.reset.hardWarning")}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowReset(false)}
                disabled={busy}
                className="px-4 py-2 text-sm text-text-secondary hover:text-text-primary transition-colors disabled:opacity-50"
              >
                {t("common.cancel")}
              </button>
              <button
                onClick={handleReset}
                disabled={busy}
                className={`px-4 py-2 text-sm font-medium text-white rounded-md transition-colors flex items-center gap-2 disabled:opacity-50 ${
                  resetMode === "hard" ? "bg-red-600 hover:bg-red-500" : "bg-blue-600 hover:bg-blue-500"
                }`}
              >
                {busy && <span className="w-3.5 h-3.5 rounded-full border-2 border-white/40 border-t-white animate-spin" />}
                {t(`commitDetail.reset.${resetMode}`)}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* File editor overlay */}
      {editFile && (
        <div className="absolute inset-0 z-30 bg-surface-base flex flex-col">
          <FileEditor
            filePath={editFile}
            onClose={() => setEditFile(null)}
          />
        </div>
      )}

      {/* File history overlay */}
      {historyFile && (
        <div className="absolute inset-0 z-30 bg-surface-base flex flex-col">
          <div className="flex items-center justify-between px-3 py-1.5 border-b border-surface-border shrink-0">
            <span className="text-xs text-text-muted">{t("fileHistory.title")}</span>
            <button
              onClick={() => setHistoryFile(null)}
              title={t("common.close")}
              className="text-text-muted hover:text-text-primary transition-colors text-sm px-1"
            >✕</button>
          </div>
          <div className="flex-1 overflow-hidden">
            <FileHistoryPanel filePath={historyFile} />
          </div>
        </div>
      )}

      {/* Revert dialog */}
      {showRevert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-surface-elevated border border-surface-border rounded-xl shadow-2xl w-full max-w-sm mx-4 p-5 flex flex-col gap-4">
            <div>
              <p className="text-sm font-semibold text-text-primary">{t("commitDetail.revert.title")}</p>
              <p className="text-xs text-text-muted mt-0.5 font-mono">{d.shortOid} — {d.summary}</p>
            </div>
            <p className="text-xs text-text-secondary">
              {t("commitDetail.revert.description")}
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowRevert(false)}
                disabled={busy}
                className="px-4 py-2 text-sm text-text-secondary hover:text-text-primary transition-colors disabled:opacity-50"
              >
                {t("common.cancel")}
              </button>
              <button
                onClick={handleRevert}
                disabled={busy}
                className="px-4 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-500 text-white rounded-md transition-colors flex items-center gap-2 disabled:opacity-50"
              >
                {busy && <span className="w-3.5 h-3.5 rounded-full border-2 border-white/40 border-t-white animate-spin" />}
                {t("commitDetail.revert.title")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
