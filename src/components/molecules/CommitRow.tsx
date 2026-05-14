import { memo, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useGitRepository } from "../../infrastructure/GitRepositoryContext";
import { createTagUseCase } from "../../usecases/tags";
import { createBranchUseCase, deleteBranchUseCase } from "../../usecases/branches";
import { cherryPickUseCase } from "../../usecases/cherry-pick";
import { toast } from "../../store/toastStore";
import { useUiStore } from "../../store/uiStore";
import { useSettingsStore } from "../../store/settingsStore";
import type { CommitSummary, TagInfo, BranchInfo, RemoteInfo } from "../../domain/entities";
import { TagCreateDialog } from "./TagCreateDialog";
import { MultiRemoteIndicator } from "./MultiRemoteIndicator";

function formatDate(unixSec: number): string {
  return new Date(unixSec * 1000).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export const CommitRow = memo(function CommitRow({
  commit,
  commitTags,
  commitBranches,
  remoteOnlyBranchNames,
  remotes,
  isSelected,
  onSelect,
  onTagsChanged,
  onBranchesChanged,
  onLogRefresh,
}: {
  commit: CommitSummary;
  commitTags: TagInfo[];
  commitBranches: BranchInfo[];
  remoteOnlyBranchNames?: Set<string>;
  remotes?: RemoteInfo[];
  isSelected: boolean;
  onSelect: () => void;
  onTagsChanged: () => Promise<void>;
  onBranchesChanged: () => Promise<void>;
  onLogRefresh: () => Promise<void>;
}) {
  const { t } = useTranslation();
  const repo = useGitRepository();
  const { setActiveView, setRepositoryState, setInteractiveRebaseFromOid, setHighlightedTagName } = useUiStore();
  const easyMode = useSettingsStore((s) => s.easyMode);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [cherryPicking, setCherryPicking] = useState(false);
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Branch creation modal state
  const [showCreateBranch, setShowCreateBranch] = useState(false);
  const [newBranchName, setNewBranchName] = useState("");
  const [creatingBranch, setCreatingBranch] = useState(false);
  const branchInputRef = useRef<HTMLInputElement>(null);

  // Close context menu on outside click or Escape
  useEffect(() => {
    if (!menu) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent && e.key !== "Escape") return;
      if (e instanceof MouseEvent && menuRef.current?.contains(e.target as Node)) return;
      setMenu(null);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [menu]);

  // Focus branch input when modal opens
  useEffect(() => {
    if (showCreateBranch) {
      setTimeout(() => branchInputRef.current?.focus(), 50);
    } else {
      setNewBranchName("");
    }
  }, [showCreateBranch]);

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const menuW = 200;
    const menuH = 80; // two items
    setMenu({
      x: Math.min(e.clientX, vw - menuW - 8),
      y: Math.min(e.clientY, vh - menuH - 8),
    });
  };

  const handleCherryPick = async () => {
    setMenu(null);
    setCherryPicking(true);
    try {
      const result = await cherryPickUseCase(repo, commit.oid);
      if (result.hasConflicts) {
        setRepositoryState("cherry_pick");
        setActiveView("changes");
        toast.success(t("commitRow.cherrypickConflicts", { count: result.conflictCount }));
      } else {
        await onLogRefresh();
        toast.success(t("commitRow.cherrypickApplied", { sha: commit.shortOid }));
      }
    } catch (err) {
      toast.error(String(err));
    } finally {
      setCherryPicking(false);
    }
  };

  const handleTagBadgeClick = (e: React.MouseEvent, tag: TagInfo) => {
    if (easyMode) return;
    e.stopPropagation();
    setHighlightedTagName(tag.name);
    setActiveView("tags");
  };

  const handleCreateTag = async (name: string, targetOid: string, message: string | null) => {
    setCreating(true);
    try {
      await createTagUseCase(repo, name, targetOid, message);
      await onTagsChanged();
      setShowCreate(false);
      toast.success(t("commitRow.tagCreated", { name }));
    } catch (err) {
      toast.error(String(err));
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteBranch = async (e: React.MouseEvent, branch: BranchInfo) => {
    e.stopPropagation();
    try {
      await deleteBranchUseCase(repo, branch.name, false);
      await onBranchesChanged();
      toast.success(t("branches.deleted", { name: branch.name }));
    } catch (err) {
      toast.error(String(err));
    }
  };

  const handleCreateBranch = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = newBranchName.trim();
    if (!name) return;
    setCreatingBranch(true);
    try {
      await createBranchUseCase(repo, name, commit.oid);
      await onBranchesChanged();
      setShowCreateBranch(false);
      toast.success(t("branches.created", { name }));
    } catch (err) {
      toast.error(String(err));
    } finally {
      setCreatingBranch(false);
    }
  };

  // REQ-HIST-027 — Cap visible labels to avoid crowding the commit message
  const MAX_VISIBLE = 5;
  const visibleBranches = commitBranches.slice(0, Math.min(commitBranches.length, MAX_VISIBLE));
  const remainingSlots = Math.max(0, MAX_VISIBLE - visibleBranches.length);
  const visibleTags = commitTags.slice(0, remainingSlots);
  const overflowCount = (commitBranches.length - visibleBranches.length) + (commitTags.length - visibleTags.length);
  const overflowTitle = [
    ...commitBranches.slice(visibleBranches.length).map((b) => `⎇ ${b.name}`),
    ...commitTags.slice(visibleTags.length).map((t) => t.name),
  ].join("\n");

  return (
    <>
      <div
        role="button"
        tabIndex={0}
        onClick={onSelect}
        onKeyDown={(e) => e.key === "Enter" && onSelect()}
        onContextMenu={handleContextMenu}
        className={[
          "w-full text-left px-3 py-2.5 border-b border-surface-border transition-colors group cursor-pointer",
          isSelected ? "bg-surface-overlay" : "hover:bg-surface-hover",
          cherryPicking ? "opacity-60 pointer-events-none" : "",
        ].join(" ")}
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-mono text-xs text-text-secondary shrink-0">
            {commit.shortOid}
          </span>
          <span className="text-sm text-text-primary truncate flex-1 min-w-0">{commit.summary}</span>

          {/* Branch badges */}
          {visibleBranches.map((branch) => {
            const isRemoteOnly = branch.isRemote && (remoteOnlyBranchNames?.has(branch.name) ?? false);
            return (
            <span
              key={branch.name}
              className={`inline-flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.5 rounded shrink-0 ${
                branch.isRemote
                  ? isRemoteOnly
                    ? "bg-sky-500/10 text-sky-400/80 ring-1 ring-sky-400/40 ring-dashed"
                    : "bg-sky-500/15 text-sky-400"
                  : branch.isHead
                  ? "bg-violet-500/25 text-violet-700 dark:text-violet-300 font-semibold ring-1 ring-violet-500/40"
                  : "bg-green-500/15 text-green-400"
              }`}
              title={isRemoteOnly ? t("commitRow.remoteOnlyBranch") : undefined}
            >
              ⎇ {branch.name}
              {!branch.isRemote && (
                <button
                  onClick={(e) => handleDeleteBranch(e, branch)}
                  className="opacity-0 group-hover:opacity-100 hover:text-red-400 transition-opacity leading-none"
                  title={t("commitRow.deleteBranchTitle", { name: branch.name })}
                >
                  ×
                </button>
              )}
            </span>
            );
          })}

          {/* Tag badges — clic ouvre la TagList avec highlight (US-0020) ; pas de × inline */}
          {visibleTags.map((tag) => {
            const baseTitle =
              tag.isAnnotated && tag.message
                ? `${tag.name}\n\n${tag.message}`
                : tag.name;
            const title = easyMode
              ? baseTitle
              : `${baseTitle}\n\n${t("commitRow.tagBadgeClickHint")}`;
            const hasRemotes = (remotes?.length ?? 0) > 0;
            return (
              <span
                key={tag.name}
                title={title}
                onClick={easyMode ? undefined : (e) => handleTagBadgeClick(e, tag)}
                role={easyMode ? undefined : "button"}
                tabIndex={easyMode ? undefined : 0}
                onKeyDown={
                  easyMode
                    ? undefined
                    : (e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          e.stopPropagation();
                          setHighlightedTagName(tag.name);
                          setActiveView("tags");
                        }
                      }
                }
                className={[
                  "inline-flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.5 rounded shrink-0",
                  tag.isAnnotated
                    ? "bg-blue-500/15 text-blue-400"
                    : "bg-amber-500/15 text-amber-400",
                  easyMode ? "" : "cursor-pointer hover:ring-1 hover:ring-current/40 transition-shadow",
                ].join(" ")}
              >
                {tag.name}
                {hasRemotes && (
                  <MultiRemoteIndicator
                    tagName={tag.name}
                    remotes={remotes!}
                    onPushToRemote={async () => { /* no-op : compact mode délègue à TagList */ }}
                    compact
                  />
                )}
              </span>
            );
          })}

          {/* Overflow indicator */}
          {overflowCount > 0 && (
            <span
              className="text-[10px] font-mono px-1.5 py-0.5 rounded shrink-0 bg-surface-overlay text-text-muted border border-surface-border"
              title={overflowTitle}
            >
              +{overflowCount}
            </span>
          )}

          {/* Add tag button */}
          <button
            onClick={(e) => { e.stopPropagation(); setShowCreate(true); }}
            className="opacity-0 group-hover:opacity-100 text-[10px] px-1.5 py-0.5 rounded text-text-muted hover:text-blue-400 hover:bg-blue-500/10 transition-all shrink-0"
            title={t("commitRow.addTag")}
          >
            + tag
          </button>
        </div>

        <div className="flex gap-2 mt-0.5 text-xs text-text-secondary">
          <span>{commit.author.name}</span>
          <span>·</span>
          <span>{formatDate(commit.author.when)}</span>
        </div>
      </div>

      {/* Context menu */}
      {menu && (
        <div
          ref={menuRef}
          style={{ position: "fixed", top: menu.y, left: menu.x, zIndex: 9999 }}
          className="min-w-[180px] bg-surface-elevated border border-surface-border rounded shadow-xl py-1"
        >
          <button
            onClick={() => { setMenu(null); setShowCreateBranch(true); }}
            className="w-full text-left px-3 py-2 text-xs text-text-primary hover:bg-surface-hover transition-colors"
          >
            {t("commitRow.createBranchHere")}
          </button>
          <button
            onClick={handleCherryPick}
            className="w-full text-left px-3 py-2 text-xs text-text-primary hover:bg-surface-hover transition-colors"
          >
            {t("commitRow.cherrypickCommit")}
          </button>
          <button
            onClick={() => { setMenu(null); setInteractiveRebaseFromOid(commit.oid); }}
            className="w-full text-left px-3 py-2 text-xs text-text-primary hover:bg-surface-hover transition-colors"
          >
            {t("commitRow.interactiveRebaseFrom")}
          </button>
        </div>
      )}

      {/* Branch creation modal */}
      {showCreateBranch && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center"
          onClick={(e) => { if (e.target === e.currentTarget) setShowCreateBranch(false); }}
        >
          <div className="bg-surface-elevated border border-surface-border rounded-lg shadow-2xl w-80 p-4">
            <h3 className="text-sm font-semibold text-text-primary mb-3">
              {t("commitRow.createBranchFrom")} <span className="font-mono text-text-secondary">{commit.shortOid}</span>
            </h3>
            <form onSubmit={handleCreateBranch} className="flex flex-col gap-3">
              <input
                ref={branchInputRef}
                type="text"
                value={newBranchName}
                onChange={(e) => setNewBranchName(e.target.value)}
                placeholder={t("commitRow.branchNamePlaceholder")}
                className="w-full px-3 py-1.5 text-sm bg-surface-overlay border border-surface-border rounded text-text-primary placeholder:text-text-muted focus:outline-none focus:border-blue-500"
                onKeyDown={(e) => e.key === "Escape" && setShowCreateBranch(false)}
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowCreateBranch(false)}
                  className="px-3 py-1.5 text-xs text-text-secondary hover:text-text-primary transition-colors"
                >
                  {t("common.cancel")}
                </button>
                <button
                  type="submit"
                  disabled={!newBranchName.trim() || creatingBranch}
                  className="px-3 py-1.5 text-xs bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white rounded transition-colors"
                >
                  {creatingBranch ? t("common.creating") : t("common.create")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showCreate && (
        <TagCreateDialog
          headOid={commit.oid}
          targetOidReadOnly
          onClose={() => !creating && setShowCreate(false)}
          onConfirm={handleCreateTag}
          loading={creating}
        />
      )}
    </>
  );
});
