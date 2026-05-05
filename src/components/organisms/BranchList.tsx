import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "../../store/toastStore";
import { useGitStore } from "../../store/gitStore";
import { useUiStore } from "../../store/uiStore";
import { useGitRepository } from "../../infrastructure/GitRepositoryContext";
import { useRepoStore } from "../../store/repoStore";
import {
  listBranchesUseCase,
  checkoutBranchUseCase,
  checkoutRemoteBranchUseCase,
  createBranchUseCase,
  deleteBranchUseCase,
  renameBranchUseCase,
  mergeBranchUseCase,
  setBranchUpstreamUseCase,
  unsetBranchUpstreamUseCase,
} from "../../usecases/branches";
import { getStatusUseCase } from "../../usecases/staging";
import { rebaseBranchUseCase } from "../../usecases/rebase";
import { buildTree } from "../../usecases/tree";
import type { TreeNode } from "../../usecases/tree";
import { IconBranch, IconChevronRight, IconChevronDown } from "../atoms/icons";
import { AheadBehind } from "../atoms/AheadBehind";
import { GitFlowPanel } from "./GitFlowPanel";
import type { BranchInfo } from "../../domain/entities";

export function BranchList() {
  const { t } = useTranslation();
  const repo = useGitRepository();
  const { currentRepo } = useRepoStore();
  const { branches, setBranches, setStatus, bumpLogVersion } = useGitStore();
  const { setRepositoryState, setActiveView, setHighlightedOid } = useUiStore();
  const [newBranchName, setNewBranchName] = useState("");
  const [sourceRef, setSourceRef] = useState("HEAD");
  const [creating, setCreating] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ branch: BranchInfo; x: number; y: number } | null>(null);
  const [mergeDialog, setMergeDialog] = useState<{ branch: BranchInfo } | null>(null);
  const [noFf, setNoFf] = useState(false);
  const [merging, setMerging] = useState(false);
  const [rebaseDialog, setRebaseDialog] = useState<{ branch: BranchInfo } | null>(null);
  const [rebasing, setRebasing] = useState(false);
  // REQ-BR-011 — Rename
  const [renameDialog, setRenameDialog] = useState<{ branch: BranchInfo } | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [renaming, setRenaming] = useState(false);
  // REQ-BR-012 — Delete dialog (replaces confirm())
  const [deleteDialog, setDeleteDialog] = useState<{ branch: BranchInfo; forceAvailable: boolean } | null>(null);
  const [deleting, setDeleting] = useState(false);
  // REQ-BR-017 — Tree expansion state
  const [expandedLocal, setExpandedLocal] = useState<Set<string>>(new Set());
  const [expandedRemote, setExpandedRemote] = useState<Set<string>>(new Set());
  // REQ-SEARCH-002 — Branch name filter
  const [branchFilter, setBranchFilter] = useState("");
  // REQ-BR-019 — Checkout remote branch
  const [checkoutRemoteDialog, setCheckoutRemoteDialog] = useState<{ branch: BranchInfo; localName: string } | null>(null);
  const [checkingOutRemote, setCheckingOutRemote] = useState(false);
  // REQ-BR-023 / REQ-BR-024 — Set / unset upstream
  const [upstreamDialog, setUpstreamDialog] = useState<{ branch: BranchInfo } | null>(null);
  const [selectedUpstream, setSelectedUpstream] = useState("");
  const [settingUpstream, setSettingUpstream] = useState(false);

  const refresh = async () => {
    try { setBranches(await listBranchesUseCase(repo, "all")); }
    catch (e) { toast.error(String(e)); }
  };

  useEffect(() => { refresh(); }, [currentRepo?.path]);

  const handleCheckout = async (name: string) => {
    try {
      await checkoutBranchUseCase(repo, name);
      toast.success(t("branches.checkedOut", { name }));
      const [newStatus, branchList] = await Promise.all([
        getStatusUseCase(repo),
        listBranchesUseCase(repo, "all"),
      ]);
      setStatus(newStatus);
      setBranches(branchList);
      bumpLogVersion();
    } catch (e) {
      toast.error(t("branches.checkoutFailed", { error: String(e) }));
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBranchName.trim()) return;
    setCreating(true);
    try {
      await createBranchUseCase(repo, newBranchName, sourceRef);
      toast.success(t("branches.created", { name: newBranchName }));
      setNewBranchName("");
      setSourceRef("HEAD");
      await refresh();
    } catch (err) {
      toast.error(t("branches.createFailed", { error: String(err) }));
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteConfirm = async (force: boolean) => {
    if (!deleteDialog) return;
    setDeleting(true);
    try {
      await deleteBranchUseCase(repo, deleteDialog.branch.name, force);
      toast.success(t("branches.deleted", { name: deleteDialog.branch.name }));
      setDeleteDialog(null);
      await refresh();
    } catch (e) {
      const msg = String(e);
      if (!force && msg === "BranchNotFullyMerged") {
        // Offer force delete
        setDeleteDialog((prev) => prev ? { ...prev, forceAvailable: true } : null);
      } else {
        toast.error(t("branches.deleteFailed", { error: msg }));
        setDeleteDialog(null);
      }
    } finally {
      setDeleting(false);
    }
  };

  const handleRename = async () => {
    if (!renameDialog || !renameValue.trim()) return;
    setRenaming(true);
    try {
      await renameBranchUseCase(repo, renameDialog.branch.name, renameValue.trim());
      toast.success(t("branches.renamed", { name: renameDialog.branch.name, newName: renameValue.trim() }));
      setRenameDialog(null);
      await refresh();
    } catch (e) {
      toast.error(t("branches.renameFailed", { error: String(e) }));
    } finally {
      setRenaming(false);
    }
  };

  const handleMerge = async () => {
    if (!mergeDialog) return;
    setMerging(true);
    try {
      const result = await mergeBranchUseCase(repo, mergeDialog.branch.name, noFf);
      setMergeDialog(null);
      if (result.hasConflicts) {
        setRepositoryState("merge");
        setStatus(await getStatusUseCase(repo));
        setActiveView("changes");
        toast.error(t("branches.merge.conflicts", { count: result.conflictCount }));
      } else {
        const [newStatus, branchList] = await Promise.all([
          getStatusUseCase(repo),
          listBranchesUseCase(repo, "all"),
        ]);
        setStatus(newStatus);
        setBranches(branchList);
        bumpLogVersion();
        toast.success(t("branches.merge.done", { name: mergeDialog.branch.name }));
      }
    } catch (e) {
      toast.error(String(e));
    } finally {
      setMerging(false);
    }
  };

  const handleRebase = async () => {
    if (!rebaseDialog) return;
    setRebasing(true);
    try {
      const result = await rebaseBranchUseCase(repo, rebaseDialog.branch.name);
      setRebaseDialog(null);
      if (result.completed) {
        await refresh();
        bumpLogVersion();
        toast.success(t("branches.rebase.done", { name: rebaseDialog.branch.name }));
      } else if (result.hasConflicts) {
        setRepositoryState("rebase");
        setStatus(await getStatusUseCase(repo));
        setActiveView("changes");
        toast.error(
          t("branches.rebase.conflict", { current: result.currentStep, total: result.totalSteps, count: result.conflictCount })
        );
      }
    } catch (e) {
      toast.error(String(e));
    } finally {
      setRebasing(false);
    }
  };

  const handleCheckoutRemote = (branch: BranchInfo) => {
    if (checkingOutRemote) return;
    // Strip the remote prefix (first segment before '/')
    const slashIdx = branch.name.indexOf("/");
    if (slashIdx === -1 || branch.name.endsWith("/HEAD")) return;
    const localName = branch.name.slice(slashIdx + 1);
    const alreadyExists = branches.some((b) => !b.isRemote && b.name === localName);
    if (alreadyExists) {
      checkoutBranchUseCase(repo, localName)
        .then(async () => {
          toast.success(t("branches.checkedOut", { name: localName }));
          const [newStatus, branchList] = await Promise.all([getStatusUseCase(repo), listBranchesUseCase(repo, "all")]);
          setStatus(newStatus);
          setBranches(branchList);
          bumpLogVersion();
        })
        .catch((e) => toast.error(t("branches.checkoutFailed", { error: String(e) })));
    } else {
      setCheckoutRemoteDialog({ branch, localName });
    }
  };

  const handleConfirmCheckoutRemote = async () => {
    if (!checkoutRemoteDialog) return;
    setCheckingOutRemote(true);
    try {
      await checkoutRemoteBranchUseCase(repo, checkoutRemoteDialog.branch.name);
      toast.success(t("branches.remoteCheckout.done", { localName: checkoutRemoteDialog.localName }));
      setCheckoutRemoteDialog(null);
      const [newStatus, branchList] = await Promise.all([
        getStatusUseCase(repo),
        listBranchesUseCase(repo, "all"),
      ]);
      setStatus(newStatus);
      setBranches(branchList);
      bumpLogVersion();
    } catch (e) {
      toast.error(t("branches.checkoutFailed", { error: String(e) }));
    } finally {
      setCheckingOutRemote(false);
    }
  };

  const handleSetUpstream = async () => {
    if (!upstreamDialog || !selectedUpstream) return;
    setSettingUpstream(true);
    try {
      const updated = await setBranchUpstreamUseCase(repo, upstreamDialog.branch.name, selectedUpstream);
      setBranches(branches.map((b) => b.name === updated.name ? updated : b));
      toast.success(t("branches.upstream.setDone", { name: upstreamDialog.branch.name, upstream: selectedUpstream }));
      setUpstreamDialog(null);
    } catch (e) {
      toast.error(t("branches.upstream.setFailed", { error: String(e) }));
    } finally {
      setSettingUpstream(false);
    }
  };

  const handleUnsetUpstream = async (branch: BranchInfo) => {
    try {
      const updated = await unsetBranchUpstreamUseCase(repo, branch.name);
      setBranches(branches.map((b) => b.name === updated.name ? updated : b));
      toast.success(t("branches.upstream.unsetDone", { name: branch.name }));
    } catch (e) {
      toast.error(t("branches.upstream.unsetFailed", { error: String(e) }));
    }
  };

  const filterLower = branchFilter.toLowerCase();
  const localBranches  = branches.filter((b) => !b.isRemote && (filterLower === "" || b.name.toLowerCase().includes(filterLower)));
  const remoteBranches = branches.filter((b) => b.isRemote  && (filterLower === "" || b.name.toLowerCase().includes(filterLower)));

  const localTree  = buildTree(localBranches,  (b) => b.name);
  const remoteTree = buildTree(remoteBranches, (b) => b.name);

  const toggleLocal  = (path: string) =>
    setExpandedLocal((prev) => { const s = new Set(prev); s.has(path) ? s.delete(path) : s.add(path); return s; });
  const toggleRemote = (path: string) =>
    setExpandedRemote((prev) => { const s = new Set(prev); s.has(path) ? s.delete(path) : s.add(path); return s; });

  const handleNavigateToCommit = (branch: BranchInfo) => {
    if (!branch.headOid) return;
    setHighlightedOid(branch.headOid);
    setActiveView("history");
  };

  const renderBranchLeaf = (branch: BranchInfo, depth: number) => (
    <div
      key={branch.name}
      style={{ paddingLeft: `${depth * 12 + 10}px` }}
      onContextMenu={(e) => { e.preventDefault(); setContextMenu({ branch, x: e.clientX, y: e.clientY }); }}
      onDoubleClick={() => !branch.isHead && handleCheckout(branch.name)}
      className={[
        "group flex items-center gap-2.5 pr-2.5 py-2 rounded-md cursor-default transition-colors",
        branch.isHead
          ? "bg-blue-600/20 border border-blue-500/30"
          : "hover:bg-surface-hover border border-transparent",
      ].join(" ")}
    >
      <IconBranch className={`w-3.5 h-3.5 shrink-0 ${branch.isHead ? "text-blue-400" : "text-text-muted"}`} />
      <span className={`text-sm flex-1 truncate ${branch.isHead ? "text-blue-100 font-medium" : "text-text-primary"}`}>
        {branch.name.split("/").pop()}
      </span>
      {branch.isHead && (
        <span className="text-[9px] font-bold text-blue-400 uppercase tracking-wide">{t("branches.head")}</span>
      )}
      {!branch.isRemote && branch.upstream && (
        <span className="text-[9px] text-zinc-500 font-mono shrink-0 truncate max-w-[90px]" title={branch.upstream}>
          {branch.upstream}
        </span>
      )}
      {!branch.isRemote && !branch.upstream &&
        !remoteBranches.some((rb) => rb.name.slice(rb.name.indexOf("/") + 1) === branch.name) && (
        <span className="text-[9px] text-text-muted border border-surface-border rounded px-1 py-px font-mono shrink-0">
          {t("branches.noRemote")}
        </span>
      )}
      {branch.headOid && (
        <button
          title={t("branches.showInHistory")}
          onClick={(e) => { e.stopPropagation(); handleNavigateToCommit(branch); }}
          className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded text-text-muted hover:text-blue-400"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3">
            <path d="M2 8a6 6 0 1 1 12 0A6 6 0 0 1 2 8Zm6-1.5a.75.75 0 0 0 0 1.5h1.69l-.72.72a.75.75 0 1 0 1.06 1.06l2-2a.75.75 0 0 0 0-1.06l-2-2a.75.75 0 0 0-1.06 1.06l.72.72H8Z" />
          </svg>
        </button>
      )}
      <AheadBehind ahead={branch.ahead ?? 0} behind={branch.behind ?? 0} />
    </div>
  );

  const renderLocalTree = (nodes: TreeNode<BranchInfo>[], depth: number): React.ReactNode =>
    nodes.map((node) => {
      if (node.item && node.children.length === 0) {
        return renderBranchLeaf(node.item, depth);
      }
      const isOpen = expandedLocal.has(node.fullPath);
      return (
        <div key={node.fullPath}>
          <div
            style={{ paddingLeft: `${depth * 12 + 10}px` }}
            onClick={(e) => { e.stopPropagation(); toggleLocal(node.fullPath); }}
            className="flex items-center gap-1.5 pr-2.5 py-1.5 rounded-md cursor-pointer hover:bg-surface-hover transition-colors select-none"
          >
            {isOpen
              ? <IconChevronDown className="w-3 h-3 shrink-0 text-text-muted" />
              : <IconChevronRight className="w-3 h-3 shrink-0 text-text-muted" />}
            <span className="text-xs text-text-muted font-medium">{node.label}/</span>
          </div>
          {isOpen && (
            <>
              {node.item && renderBranchLeaf(node.item, depth + 1)}
              {renderLocalTree(node.children, depth + 1)}
            </>
          )}
        </div>
      );
    });

  const renderRemoteTree = (nodes: TreeNode<BranchInfo>[], depth: number): React.ReactNode =>
    nodes.map((node) => {
      if (node.item && node.children.length === 0) {
        const leaf = node.item;
        return (
          <div
            key={leaf.name}
            style={{ paddingLeft: `${depth * 12 + 10}px` }}
            onDoubleClick={() => handleCheckoutRemote(leaf)}
            onContextMenu={(e) => { e.preventDefault(); setContextMenu({ branch: leaf, x: e.clientX, y: e.clientY }); }}
            className="group flex items-center gap-2.5 pr-2.5 py-2 rounded-md border border-transparent hover:bg-surface-hover cursor-pointer"
          >
            <IconBranch className="w-3.5 h-3.5 shrink-0 text-text-muted" />
            <span className="text-sm text-text-secondary truncate flex-1">{leaf.name.split("/").pop()}</span>
            {leaf.headOid && (
              <button
                title={t("branches.showInHistory")}
                onClick={(e) => { e.stopPropagation(); handleNavigateToCommit(leaf); }}
                className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded text-text-muted hover:text-blue-400"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3">
                  <path d="M2 8a6 6 0 1 1 12 0A6 6 0 0 1 2 8Zm6-1.5a.75.75 0 0 0 0 1.5h1.69l-.72.72a.75.75 0 1 0 1.06 1.06l2-2a.75.75 0 0 0 0-1.06l-2-2a.75.75 0 0 0-1.06 1.06l.72.72H8Z" />
                </svg>
              </button>
            )}
          </div>
        );
      }
      const isOpen = expandedRemote.has(node.fullPath);
      return (
        <div key={node.fullPath}>
          <div
            style={{ paddingLeft: `${depth * 12 + 10}px` }}
            onClick={(e) => { e.stopPropagation(); toggleRemote(node.fullPath); }}
            className="flex items-center gap-1.5 pr-2.5 py-1.5 rounded-md cursor-pointer hover:bg-surface-hover transition-colors select-none"
          >
            {isOpen
              ? <IconChevronDown className="w-3 h-3 shrink-0 text-text-muted" />
              : <IconChevronRight className="w-3 h-3 shrink-0 text-text-muted" />}
            <span className="text-xs text-text-muted font-medium">{node.label}/</span>
          </div>
          {isOpen && renderRemoteTree(node.children, depth + 1)}
        </div>
      );
    });

  return (
    <div className="flex flex-col h-full overflow-hidden" onClick={() => setContextMenu(null)}>
      {/* Branch filter */}
      <div className="flex gap-1.5 px-2 pt-2 pb-1.5 border-b border-surface-border">
        <input
          type="text"
          value={branchFilter}
          onChange={(e) => setBranchFilter(e.target.value)}
          placeholder={t("branches.filterPlaceholder")}
          className="flex-1 bg-surface-elevated text-text-primary text-xs rounded px-2 py-1.5 border border-surface-border focus:outline-none focus:border-blue-500 placeholder:text-text-muted"
        />
        {branchFilter && (
          <button
            onClick={() => setBranchFilter("")}
            className="text-xs px-2 py-1 rounded border border-surface-border text-text-muted hover:text-red-400 hover:border-red-500/40 transition-colors"
          >
            ✕
          </button>
        )}
      </div>

      {/* Create branch */}
      <form onSubmit={handleCreate} className="flex flex-col gap-2 p-3 border-b border-surface-border">
        <div className="flex gap-2">
          <input
            value={newBranchName}
            onChange={(e) => setNewBranchName(e.target.value)}
            placeholder={t("branches.newBranchPlaceholder")}
            className="flex-1 bg-surface-elevated text-text-primary text-sm rounded-md px-3 py-1.5 border border-surface-border focus:outline-none focus:border-blue-500 placeholder:text-text-muted"
          />
          <button
            type="submit"
            disabled={creating || !newBranchName.trim()}
            className="px-3 py-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-500 disabled:bg-surface-elevated disabled:text-text-muted text-white rounded-md transition-colors"
          >
            {creating ? "…" : t("branches.create")}
          </button>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-text-muted shrink-0">{t("branches.fromLabel")}</span>
          <div className="relative flex-1">
            <select
              value={sourceRef}
              onChange={(e) => setSourceRef(e.target.value)}
              disabled={creating}
              className="w-full appearance-none bg-surface-elevated text-text-primary text-xs rounded-md px-2 py-1 pr-6 border border-surface-border focus:outline-none focus:border-blue-500 disabled:opacity-50"
            >
              <option value="HEAD" className="bg-zinc-900 text-zinc-100">{t("branches.fromHead")}</option>
              {branches.filter((b) => !b.isRemote).map((b) => (
                <option key={b.name} value={b.name} className="bg-zinc-900 text-zinc-100">{b.name}</option>
              ))}
              {branches.filter((b) => b.isRemote).map((b) => (
                <option key={b.name} value={b.name} className="bg-zinc-900 text-zinc-100">{b.name}</option>
              ))}
            </select>
            <span className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-text-muted text-[10px]">▾</span>
          </div>
        </div>
      </form>

      <div className="flex-1 overflow-y-auto px-2 py-2 flex flex-col gap-0.5">
        {/* Local */}
        <p className="text-[10px] text-text-muted uppercase tracking-widest px-2 py-1.5 font-medium">
          {t("branches.local", { count: localBranches.length })}
        </p>
        {renderLocalTree(localTree, 0)}

        {/* Remote */}
        {remoteBranches.length > 0 && (
          <>
            <p className="text-[10px] text-text-muted uppercase tracking-widest px-2 py-1.5 font-medium mt-2">
              {t("branches.remote", { count: remoteBranches.length })}
            </p>
            {renderRemoteTree(remoteTree, 0)}
          </>
        )}

        <p className="text-xs text-text-muted text-center px-3 py-2 mt-1">
          {t("branches.hint")}
        </p>
      </div>

      <GitFlowPanel />

      {/* Context menu */}
      {contextMenu && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setContextMenu(null)} />
          <div
            style={{ top: contextMenu.y, left: contextMenu.x }}
          className="fixed z-50 bg-surface-elevated border border-surface-border rounded-lg shadow-2xl py-1 min-w-40 overflow-hidden"
        >
          {!contextMenu.branch.isHead && (
            <button
              onClick={() => {
                contextMenu.branch.isRemote
                  ? handleCheckoutRemote(contextMenu.branch)
                  : handleCheckout(contextMenu.branch.name);
                setContextMenu(null);
              }}
              className="w-full text-left px-4 py-2 text-sm text-text-primary hover:bg-surface-hover transition-colors"
            >
              {t("branches.checkout")}
            </button>
          )}
          {!contextMenu.branch.isHead && (
            <button
              onClick={() => { setMergeDialog({ branch: contextMenu.branch }); setNoFf(false); setContextMenu(null); }}
              className="w-full text-left px-4 py-2 text-sm text-text-primary hover:bg-surface-hover transition-colors"
            >
              {t("branches.merge")}
            </button>
          )}
          {!contextMenu.branch.isHead && (
            <button
              onClick={() => { setRebaseDialog({ branch: contextMenu.branch }); setContextMenu(null); }}
              className="w-full text-left px-4 py-2 text-sm text-text-primary hover:bg-surface-hover transition-colors"
            >
              {t("branches.rebase")}
            </button>
          )}
          {/* REQ-BR-011 — Rename (local branches only) */}
          {!contextMenu.branch.isRemote && (
            <button
              onClick={() => {
                setRenameValue(contextMenu.branch.name);
                setRenameDialog({ branch: contextMenu.branch });
                setContextMenu(null);
              }}
              className="w-full text-left px-4 py-2 text-sm text-text-primary hover:bg-surface-hover transition-colors"
            >
              {t("branches.rename")}
            </button>
          )}
          {/* REQ-BR-023 / REQ-BR-024 — Set/change/remove upstream (local branches only) */}
          {!contextMenu.branch.isRemote && (
            <>
              <div className="border-t border-surface-border my-1" />
              <button
                onClick={() => {
                  setSelectedUpstream(contextMenu.branch.upstream ?? remoteBranches[0]?.name ?? "");
                  setUpstreamDialog({ branch: contextMenu.branch });
                  setContextMenu(null);
                }}
                className="w-full text-left px-4 py-2 text-sm text-text-primary hover:bg-surface-hover transition-colors"
              >
                {contextMenu.branch.upstream ? t("branches.upstream.change") : t("branches.upstream.set")}
              </button>
              {contextMenu.branch.upstream && (
                <button
                  onClick={() => { handleUnsetUpstream(contextMenu.branch); setContextMenu(null); }}
                  className="w-full text-left px-4 py-2 text-sm text-text-secondary hover:bg-surface-hover transition-colors"
                >
                  {t("branches.upstream.unsetAction")}
                </button>
              )}
            </>
          )}
          {/* REQ-BR-012 — Delete (local non-HEAD only) */}
          {!contextMenu.branch.isHead && !contextMenu.branch.isRemote && (
            <>
              <div className="border-t border-surface-border my-1" />
              <button
                onClick={() => { setDeleteDialog({ branch: contextMenu.branch, forceAvailable: false }); setContextMenu(null); }}
                className="w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-surface-hover transition-colors"
              >
                {t("branches.delete")}
              </button>
            </>
          )}
          </div>
        </>
      )}

      {/* REQ-BR-011 — Rename dialog */}
      {renameDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-surface-elevated border border-surface-border rounded-xl shadow-2xl w-full max-w-sm mx-4 p-5 flex flex-col gap-4">
            <div>
              <p className="text-sm font-semibold text-text-primary">{t("branches.rename")}</p>
              <p className="text-xs text-text-muted mt-0.5 font-mono">{renameDialog.branch.name}</p>
            </div>
            <input
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleRename(); if (e.key === "Escape") setRenameDialog(null); }}
              autoFocus
              placeholder={t("branches.rename.newNamePlaceholder")}
              className="bg-surface-overlay text-text-primary text-sm rounded-md px-3 py-2 border border-surface-border focus:outline-none focus:border-blue-500 placeholder:text-text-muted"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setRenameDialog(null)}
                disabled={renaming}
                className="px-4 py-2 text-sm text-text-secondary hover:text-text-primary transition-colors disabled:opacity-50"
              >
                {t("common.cancel")}
              </button>
              <button
                onClick={handleRename}
                disabled={renaming || !renameValue.trim() || renameValue.trim() === renameDialog.branch.name}
                className="px-4 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-500 text-white rounded-md transition-colors flex items-center gap-2 disabled:opacity-50"
              >
                {renaming && <span className="w-3.5 h-3.5 rounded-full border-2 border-white/40 border-t-white animate-spin" />}
                {t("branches.rename")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* REQ-BR-012 — Delete dialog */}
      {deleteDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-surface-elevated border border-surface-border rounded-xl shadow-2xl w-full max-w-sm mx-4 p-5 flex flex-col gap-4">
            <div>
              <p className="text-sm font-semibold text-text-primary">{t("branches.delete.title")}</p>
              <p className="text-xs text-text-muted mt-0.5 font-mono">{deleteDialog.branch.name}</p>
            </div>
            {deleteDialog.forceAvailable ? (
              <>
                <p className="text-xs text-red-400 bg-red-500/10 rounded-md px-3 py-2">
                  {t("branches.delete.unmergedWarning")}
                </p>
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => setDeleteDialog(null)}
                    disabled={deleting}
                    className="px-4 py-2 text-sm text-text-secondary hover:text-text-primary transition-colors disabled:opacity-50"
                  >
                    {t("common.cancel")}
                  </button>
                  <button
                    onClick={() => handleDeleteConfirm(true)}
                    disabled={deleting}
                    className="px-4 py-2 text-sm font-medium bg-red-600 hover:bg-red-500 text-white rounded-md transition-colors flex items-center gap-2 disabled:opacity-50"
                  >
                    {deleting && <span className="w-3.5 h-3.5 rounded-full border-2 border-white/40 border-t-white animate-spin" />}
                    {t("branches.delete.force")}
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="text-xs text-text-secondary">
                  {t("branches.delete.confirm", { name: deleteDialog.branch.name })}
                </p>
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => setDeleteDialog(null)}
                    disabled={deleting}
                    className="px-4 py-2 text-sm text-text-secondary hover:text-text-primary transition-colors disabled:opacity-50"
                  >
                    {t("common.cancel")}
                  </button>
                  <button
                    onClick={() => handleDeleteConfirm(false)}
                    disabled={deleting}
                    className="px-4 py-2 text-sm font-medium bg-red-600 hover:bg-red-500 text-white rounded-md transition-colors flex items-center gap-2 disabled:opacity-50"
                  >
                    {deleting && <span className="w-3.5 h-3.5 rounded-full border-2 border-white/40 border-t-white animate-spin" />}
                    {t("common.delete")}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* REQ-BR-019 — Checkout remote dialog */}
      {checkoutRemoteDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-surface-elevated border border-surface-border rounded-xl shadow-2xl w-full max-w-sm mx-4 p-5 flex flex-col gap-4">
            <div>
              <p className="text-sm font-semibold text-text-primary">{t("branches.remoteCheckout.title")}</p>
              <p className="text-xs text-text-muted mt-0.5 font-mono">{checkoutRemoteDialog.branch.name}</p>
            </div>
            <p className="text-xs text-text-secondary">
              {t("branches.remoteCheckout.description", { localName: checkoutRemoteDialog.localName, remoteName: checkoutRemoteDialog.branch.name })}
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setCheckoutRemoteDialog(null)}
                disabled={checkingOutRemote}
                className="px-4 py-2 text-sm text-text-secondary hover:text-text-primary transition-colors disabled:opacity-50"
              >
                {t("common.cancel")}
              </button>
              <button
                onClick={handleConfirmCheckoutRemote}
                disabled={checkingOutRemote}
                className="px-4 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-500 text-white rounded-md transition-colors flex items-center gap-2 disabled:opacity-50"
              >
                {checkingOutRemote && <span className="w-3.5 h-3.5 rounded-full border-2 border-white/40 border-t-white animate-spin" />}
                {t("branches.checkout")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Merge dialog */}
      {mergeDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-surface-elevated border border-surface-border rounded-xl shadow-2xl w-full max-w-sm mx-4 p-5 flex flex-col gap-4">
            <div>
              <p className="text-sm font-semibold text-text-primary">{t("branches.merge.title")}</p>
              <p className="text-xs text-text-muted mt-0.5 font-mono">{mergeDialog.branch.name}</p>
            </div>
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={noFf}
                onChange={(e) => setNoFf(e.target.checked)}
                disabled={merging}
                className="w-3.5 h-3.5 accent-blue-500"
              />
              <span className="text-sm text-text-primary">{t("branches.merge.noFF")}</span>
            </label>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setMergeDialog(null)}
                disabled={merging}
                className="px-4 py-2 text-sm text-text-secondary hover:text-text-primary transition-colors disabled:opacity-50"
              >
                {t("common.cancel")}
              </button>
              <button
                onClick={handleMerge}
                disabled={merging}
                className="px-4 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-500 text-white rounded-md transition-colors flex items-center gap-2 disabled:opacity-50"
              >
                {merging && <span className="w-3.5 h-3.5 rounded-full border-2 border-white/40 border-t-white animate-spin" />}
                {t("branches.merge.button")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* REQ-BR-023 — Set/change upstream dialog */}
      {upstreamDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-surface-elevated border border-surface-border rounded-xl shadow-2xl w-full max-w-sm mx-4 p-5 flex flex-col gap-4">
            <div>
              <p className="text-sm font-semibold text-text-primary">{t("branches.upstream.dialogTitle")}</p>
              <p className="text-xs text-text-muted mt-0.5 font-mono">{upstreamDialog.branch.name}</p>
            </div>
            {remoteBranches.filter((rb) => !rb.name.endsWith("/HEAD")).length === 0 ? (
              <p className="text-xs text-text-secondary">{t("branches.upstream.noRemoteBranches")}</p>
            ) : (
              <div className="relative">
                <select
                  value={selectedUpstream}
                  onChange={(e) => setSelectedUpstream(e.target.value)}
                  disabled={settingUpstream}
                  className="w-full appearance-none bg-surface-overlay text-text-primary text-sm rounded-md px-3 py-2 pr-8 border border-surface-border focus:outline-none focus:border-blue-500 disabled:opacity-50"
                >
                  {remoteBranches
                    .filter((rb) => !rb.name.endsWith("/HEAD"))
                    .map((rb) => (
                      <option key={rb.name} value={rb.name} className="bg-zinc-900 text-zinc-100">{rb.name}</option>
                    ))}
                </select>
                <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted text-[10px]">▾</span>
              </div>
            )}
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setUpstreamDialog(null)}
                disabled={settingUpstream}
                className="px-4 py-2 text-sm text-text-secondary hover:text-text-primary transition-colors disabled:opacity-50"
              >
                {t("common.cancel")}
              </button>
              <button
                onClick={handleSetUpstream}
                disabled={settingUpstream || !selectedUpstream}
                className="px-4 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-500 text-white rounded-md transition-colors flex items-center gap-2 disabled:opacity-50"
              >
                {settingUpstream && <span className="w-3.5 h-3.5 rounded-full border-2 border-white/40 border-t-white animate-spin" />}
                {t("branches.upstream.confirm")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rebase dialog */}
      {rebaseDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-surface-elevated border border-surface-border rounded-xl shadow-2xl w-full max-w-sm mx-4 p-5 flex flex-col gap-4">
            <div>
              <p className="text-sm font-semibold text-text-primary">{t("branches.rebase.title")}</p>
              <p className="text-xs text-text-muted mt-0.5 font-mono">{rebaseDialog.branch.name}</p>
            </div>
            <p className="text-xs text-text-secondary">
              {t("branches.rebase.description", { remoteName: rebaseDialog.branch.name })}
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setRebaseDialog(null)}
                disabled={rebasing}
                className="px-4 py-2 text-sm text-text-secondary hover:text-text-primary transition-colors disabled:opacity-50"
              >
                {t("common.cancel")}
              </button>
              <button
                onClick={handleRebase}
                disabled={rebasing}
                className="px-4 py-2 text-sm font-medium bg-purple-600 hover:bg-purple-500 text-white rounded-md transition-colors flex items-center gap-2 disabled:opacity-50"
              >
                {rebasing && <span className="w-3.5 h-3.5 rounded-full border-2 border-white/40 border-t-white animate-spin" />}
                {t("branches.rebase.button")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
