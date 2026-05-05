import { useEffect, useState, useCallback } from "react";
import type { IGitRepository } from "../../domain/ports/IGitRepository";
import { useTranslation } from "react-i18next";
import { useResizable } from "../../hooks/useResizable";
import { useGitRepository } from "../../infrastructure/GitRepositoryContext";
import { useRepoStore } from "../../store/repoStore";
import { useGitStore } from "../../store/gitStore";
import { useUiStore } from "../../store/uiStore";
import { toast } from "../../store/toastStore";
import { getStatusUseCase } from "../../usecases/staging";
import { listStashesUseCase, saveStashUseCase } from "../../usecases/stash";
import { abortMergeUseCase, getRepositoryStateUseCase } from "../../usecases/branches";
import { continueCherryPickUseCase, abortCherryPickUseCase } from "../../usecases/cherry-pick";
import { continueRebaseUseCase, abortRebaseUseCase } from "../../usecases/rebase";
import { resolveDeletionAcceptUseCase, resolveDeletionRestoreUseCase, resolveDeletionAcceptTheirsUseCase, resolveDeletionKeepOursUseCase } from "../../usecases/staging";
import { FileList } from "../organisms/FileList";
import { CommitForm } from "../organisms/CommitForm";
import { DiffViewer } from "../organisms/DiffViewer";
import { FileHistoryPanel } from "../organisms/FileHistoryPanel";
import { FileEditor } from "../organisms/FileEditor";
import { MergeEditor } from "../organisms/MergeEditor";
import { StashPanel } from "../organisms/StashPanel";
import { StashCreateDialog } from "../molecules/StashCreateDialog";
import { ResizeHandle } from "../atoms/ResizeHandle";

function DeletedConflictPanel({
  filePath,
  repo,
  onResolved,
}: {
  filePath: string;
  repo: IGitRepository;
  onResolved: () => Promise<void>;
}) {
  const { t } = useTranslation();
  const [resolving, setResolving] = useState<"accept" | "restore" | null>(null);

  const handleAccept = useCallback(async () => {
    setResolving("accept");
    try {
      await resolveDeletionAcceptUseCase(repo, filePath);
      toast.success(t("conflict.acceptDeletionDone"));
      await onResolved();
    } catch (e) {
      toast.error(String(e));
    } finally {
      setResolving(null);
    }
  }, [repo, filePath, onResolved, t]);

  const handleRestore = useCallback(async () => {
    setResolving("restore");
    try {
      await resolveDeletionRestoreUseCase(repo, filePath);
      toast.success(t("conflict.restoreTheirsDone"));
      await onResolved();
    } catch (e) {
      toast.error(String(e));
    } finally {
      setResolving(null);
    }
  }, [repo, filePath, onResolved, t]);

  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 px-6">
      <svg className="w-10 h-10 text-orange-400 opacity-80" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width={40} height={40} style={{ display: "block" }}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
      </svg>
      <div className="text-center">
        <p className="text-sm font-medium text-text-primary">{t("conflict.deletedByUs")}</p>
        <p className="text-xs text-text-muted mt-1 max-w-xs">{t("conflict.deletedByUsDesc")}</p>
      </div>
      <div className="flex gap-2 mt-2">
        <button
          onClick={handleAccept}
          disabled={resolving !== null}
          className="text-xs px-3 py-1.5 bg-red-700 hover:bg-red-600 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded transition-colors"
        >
          {resolving === "accept" ? "…" : t("conflict.acceptDeletion")}
        </button>
        <button
          onClick={handleRestore}
          disabled={resolving !== null}
          className="text-xs px-3 py-1.5 bg-green-700 hover:bg-green-600 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded transition-colors"
        >
          {resolving === "restore" ? "…" : t("conflict.restoreTheirs")}
        </button>
      </div>
    </div>
  );
}

function DeletedByThemConflictPanel({
  filePath,
  repo,
  onResolved,
}: {
  filePath: string;
  repo: IGitRepository;
  onResolved: () => Promise<void>;
}) {
  const { t } = useTranslation();
  const [resolving, setResolving] = useState<"accept" | "keep" | null>(null);

  const handleAccept = useCallback(async () => {
    setResolving("accept");
    try {
      await resolveDeletionAcceptTheirsUseCase(repo, filePath);
      toast.success(t("conflict.acceptTheirDeletionDone"));
      await onResolved();
    } catch (e) {
      toast.error(String(e));
    } finally {
      setResolving(null);
    }
  }, [repo, filePath, onResolved, t]);

  const handleKeep = useCallback(async () => {
    setResolving("keep");
    try {
      await resolveDeletionKeepOursUseCase(repo, filePath);
      toast.success(t("conflict.keepOurVersionDone"));
      await onResolved();
    } catch (e) {
      toast.error(String(e));
    } finally {
      setResolving(null);
    }
  }, [repo, filePath, onResolved, t]);

  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 px-6">
      <svg className="w-10 h-10 text-orange-400 opacity-80" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width={40} height={40} style={{ display: "block" }}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
      </svg>
      <div className="text-center">
        <p className="text-sm font-medium text-text-primary">{t("conflict.deletedByThem")}</p>
        <p className="text-xs text-text-muted mt-1 max-w-xs">{t("conflict.deletedByThemDesc")}</p>
      </div>
      <div className="flex gap-2 mt-2">
        <button
          onClick={handleAccept}
          disabled={resolving !== null}
          className="text-xs px-3 py-1.5 bg-red-700 hover:bg-red-600 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded transition-colors"
        >
          {resolving === "accept" ? "…" : t("conflict.acceptTheirDeletion")}
        </button>
        <button
          onClick={handleKeep}
          disabled={resolving !== null}
          className="text-xs px-3 py-1.5 bg-green-700 hover:bg-green-600 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded transition-colors"
        >
          {resolving === "keep" ? "…" : t("conflict.keepOurVersion")}
        </button>
      </div>
    </div>
  );
}

export function ChangesView() {
  const { t } = useTranslation();
  const { width, onMouseDown } = useResizable(288, 180, 480);
  const repo = useGitRepository();
  const { currentRepo } = useRepoStore();
  const { status, setStatus, setStashes, stashes, bumpLogVersion } = useGitStore();
  const { repositoryState, setRepositoryState, selectedFilePath, selectedFileStaged, currentDiff, setCurrentDiff, setSelectedFile } = useUiStore();

  const selectedEntry = selectedFilePath ? status.find((e) => e.path === selectedFilePath) : null;
  const isConflicted = !selectedFileStaged && selectedEntry?.unstaged === "conflicted";
  const [rightTab, setRightTab] = useState<"diff" | "history" | "edit">("diff");
  const [showStash, setShowStash] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [creating, setCreating] = useState(false);
  const [aborting, setAborting] = useState(false);
  const [continuingCherryPick, setContinuingCherryPick] = useState(false);
  const [abortingCherryPick, setAbortingCherryPick] = useState(false);
  const [rebaseStep, setRebaseStep] = useState<{ current: number; total: number } | null>(null);
  const [continuingRebase, setContinuingRebase] = useState(false);
  const [abortingRebase, setAbortingRebase] = useState(false);

  useEffect(() => {
    listStashesUseCase(repo).then(setStashes).catch(() => {});
    // Detect merge/cherry-pick/rebase state on mount
    getRepositoryStateUseCase(repo).then(setRepositoryState).catch(() => {});
  }, [repo, currentRepo?.path]);

  // Keep repositoryState in sync with the actual git state whenever status changes.
  // Handles three cases:
  //   1. Conflicts appeared but repositoryState is still "clean" (e.g. just after a pull)
  //   2. All conflicts resolved → re-check git so the banner stays until the merge commit is made
  //   3. Merge commit done → status becomes empty, repositoryState still "merge" → clear banner
  useEffect(() => {
    const hasConflicts = status.some((e) => e.staged === "conflicted" || e.unstaged === "conflicted");
    if (
      (hasConflicts && repositoryState === "clean") ||
      (!hasConflicts && repositoryState === "merge")
    ) {
      getRepositoryStateUseCase(repo).then(setRepositoryState).catch(() => {});
    }
  }, [status]);

  const refreshStatus = async () => {
    try {
      setStatus(await getStatusUseCase(repo));
    } catch {
      // non-fatal
    }
  };

  const handleAbortMerge = async () => {
    setAborting(true);
    try {
      await abortMergeUseCase(repo);
      setRepositoryState("clean");
      setCurrentDiff(null);
      setSelectedFile(null);
      await refreshStatus();
      toast.success(t("changes.merge.aborted"));
    } catch (e) {
      toast.error(String(e));
    } finally {
      setAborting(false);
    }
  };

  const handleCreateStash = async (
    message: string | null,
    includeUntracked: boolean,
    keepIndex: boolean
  ) => {
    setCreating(true);
    try {
      await saveStashUseCase(repo, message, includeUntracked, keepIndex);
      setStashes(await listStashesUseCase(repo));
      await refreshStatus();
      setShowCreateDialog(false);
      setShowStash(true);
      toast.success(t("changes.stash.created"));
    } catch (e) {
      toast.error(t("changes.stash.error", { error: String(e) }));
    } finally {
      setCreating(false);
    }
  };

  const conflictedFiles = status.filter(
    (e) => e.staged === "conflicted" || e.unstaged === "conflicted"
  );
  const conflictCount = conflictedFiles.length;
  const resolvedCount = conflictedFiles.filter((e) => e.staged !== "conflicted" && e.unstaged !== "conflicted").length;

  const handleConflictResolved = async () => {
    await refreshStatus();
    setCurrentDiff(null);
  };

  const handleContinueCherryPick = async () => {
    setContinuingCherryPick(true);
    try {
      await continueCherryPickUseCase(repo);
      setRepositoryState("clean");
      await refreshStatus();
      bumpLogVersion();
      toast.success(t("changes.cherrypick.done"));
    } catch (e) {
      toast.error(String(e));
    } finally {
      setContinuingCherryPick(false);
    }
  };

  const handleAbortCherryPick = async () => {
    setAbortingCherryPick(true);
    try {
      await abortCherryPickUseCase(repo);
      setRepositoryState("clean");
      setCurrentDiff(null);
      setSelectedFile(null);
      await refreshStatus();
      toast.success(t("changes.cherrypick.aborted"));
    } catch (e) {
      toast.error(String(e));
    } finally {
      setAbortingCherryPick(false);
    }
  };

  const handleContinueRebase = async () => {
    setContinuingRebase(true);
    try {
      const result = await continueRebaseUseCase(repo);
      if (result.completed) {
        setRepositoryState("clean");
        setRebaseStep(null);
        await refreshStatus();
        bumpLogVersion();
        toast.success(t("changes.rebase.done"));
      } else if (result.hasConflicts) {
        setRebaseStep({ current: result.currentStep, total: result.totalSteps });
        await refreshStatus();
        toast.error(t("changes.rebase.conflict", {
          step: result.currentStep,
          total: result.totalSteps,
          count: result.conflictCount,
        }));
      }
    } catch (e) {
      toast.error(String(e));
    } finally {
      setContinuingRebase(false);
    }
  };

  const handleAbortRebase = async () => {
    setAbortingRebase(true);
    try {
      await abortRebaseUseCase(repo);
      setRepositoryState("clean");
      setRebaseStep(null);
      setCurrentDiff(null);
      setSelectedFile(null);
      await refreshStatus();
      toast.success(t("changes.rebase.aborted"));
    } catch (e) {
      toast.error(String(e));
    } finally {
      setAbortingRebase(false);
    }
  };

  return (
    <div className="flex h-full overflow-hidden">
      <div className="flex flex-col shrink-0 overflow-hidden" style={{ width }}>

        {/* Merge conflict banner */}
        {repositoryState === "merge" && (
          <div className="flex items-center justify-between gap-2 px-3 py-2 bg-orange-500/10 border-b border-orange-500/30 shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-orange-400 shrink-0">⚠</span>
              <span className="text-xs text-orange-300 truncate">
                {t("changes.merge.banner")}
                {conflictCount > 0 && t("changes.merge.resolved", { resolved: resolvedCount, count: conflictCount })}
                {conflictCount === 0 && t("common.allResolved")}
              </span>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={handleAbortMerge}
                disabled={aborting}
                className="text-xs px-2 py-1 text-orange-600 hover:text-red-600 dark:text-orange-400 dark:hover:text-red-400 border border-orange-500/40 hover:border-red-500/40 rounded transition-colors disabled:opacity-50"
              >
                {aborting ? "…" : t("common.cancel")}
              </button>
            </div>
          </div>
        )}

        {/* Cherry-pick conflict banner */}
        {repositoryState === "cherry_pick" && (
          <div className="flex items-center justify-between gap-2 px-3 py-2 bg-orange-500/10 border-b border-orange-500/30 shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-orange-400 shrink-0">🍒</span>
              <span className="text-xs text-orange-300 truncate">
                {t("changes.cherrypick.banner")}
                {conflictCount > 0 && t("changes.merge.resolved", { resolved: resolvedCount, count: conflictCount })}
                {conflictCount === 0 && t("common.allResolved")}
              </span>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={handleContinueCherryPick}
                disabled={conflictCount > 0 || continuingCherryPick}
                className="text-xs px-2 py-1 text-green-700 hover:text-green-600 dark:text-green-400 dark:hover:text-green-300 border border-green-500/40 hover:border-green-500/70 rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {continuingCherryPick ? "…" : t("common.continue")}
              </button>
              <button
                onClick={handleAbortCherryPick}
                disabled={abortingCherryPick}
                className="text-xs px-2 py-1 text-orange-600 hover:text-red-600 dark:text-orange-400 dark:hover:text-red-400 border border-orange-500/40 hover:border-red-500/40 rounded transition-colors disabled:opacity-50"
              >
                {abortingCherryPick ? "…" : t("common.abort")}
              </button>
            </div>
          </div>
        )}

        {/* Rebase banner */}
        {repositoryState === "rebase" && (
          <div className="flex items-center justify-between gap-2 px-3 py-2 bg-purple-500/10 border-b border-purple-500/30 shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-purple-400 shrink-0">⎇</span>
              <span className="text-xs text-purple-300 truncate">
                {t("changes.rebase.banner")}
                {rebaseStep && t("changes.rebase.step", { current: rebaseStep.current, total: rebaseStep.total })}
                {conflictCount > 0 && t("changes.merge.resolved", { resolved: resolvedCount, count: conflictCount })}
                {conflictCount === 0 && t("common.allResolved")}
              </span>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={handleContinueRebase}
                disabled={conflictCount > 0 || continuingRebase}
                className="text-xs px-2 py-1 text-green-700 hover:text-green-600 dark:text-green-400 dark:hover:text-green-300 border border-green-500/40 hover:border-green-500/70 rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {continuingRebase ? "…" : t("common.continue")}
              </button>
              <button
                onClick={handleAbortRebase}
                disabled={abortingRebase}
                className="text-xs px-2 py-1 text-purple-400 hover:text-red-400 border border-purple-500/40 hover:border-red-500/40 rounded transition-colors disabled:opacity-50"
              >
                {abortingRebase ? "…" : t("common.abort")}
              </button>
            </div>
          </div>
        )}

        {/* Stash toolbar */}
        <div className="flex items-center gap-1 px-2 py-1.5 border-b border-surface-border shrink-0">
          <button
            onClick={() => setShowCreateDialog(true)}
            className="text-xs px-2 py-1 bg-surface-overlay hover:bg-surface-active text-text-primary rounded border border-surface-border transition-colors"
          >
            {t("changes.stash.button")}
          </button>
          {stashes.length > 0 && (
            <button
              onClick={() => setShowStash((v) => !v)}
              className="text-xs px-2 py-1 text-text-secondary hover:text-text-primary transition-colors flex items-center gap-1"
            >
              <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-surface-overlay text-text-secondary text-[10px] font-mono">
                {stashes.length}
              </span>
              {showStash ? "▴" : "▾"}
            </button>
          )}
        </div>

        {/* Stash list (collapsible) */}
        {showStash && stashes.length > 0 && (
          <div className="border-b border-surface-border shrink-0 overflow-y-auto max-h-40">
            <StashPanel onStatusChanged={refreshStatus} />
          </div>
        )}

        <div className="flex-1 overflow-hidden">
          <FileList />
        </div>
        <CommitForm />
      </div>
      <ResizeHandle onMouseDown={onMouseDown} />
      <div className="flex flex-col flex-1 overflow-hidden">
        {isConflicted && currentDiff && currentDiff.newPath === null && currentDiff.hunks.length === 0 ? (
          <DeletedConflictPanel
            filePath={selectedFilePath!}
            repo={repo}
            onResolved={async () => { await refreshStatus(); setCurrentDiff(null); }}
          />
        ) : isConflicted && currentDiff && currentDiff.deletedByThem ? (
          <DeletedByThemConflictPanel
            filePath={selectedFilePath!}
            repo={repo}
            onResolved={async () => { await refreshStatus(); setCurrentDiff(null); }}
          />
        ) : isConflicted && currentDiff ? (
          <MergeEditor
            key={selectedFilePath}
            filePath={selectedFilePath!}
            diff={currentDiff}
            onResolved={handleConflictResolved}
          />
        ) : (
          <>
            {selectedFilePath && (
              <div className="flex items-center gap-1 px-2 py-1 border-b border-surface-border bg-surface-base shrink-0">
                {(["diff", "history"] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setRightTab(tab)}
                    className={`text-xs px-2 py-0.5 rounded transition-colors ${
                      rightTab === tab
                        ? "bg-surface-active text-text-primary"
                        : "text-text-muted hover:text-text-primary"
                    }`}
                  >
                    {t(`changes.tab.${tab}`)}
                  </button>
                ))}
                {!selectedFileStaged && (
                  <button
                    onClick={() => setRightTab("edit")}
                    className={`text-xs px-2 py-0.5 rounded transition-colors ${
                      rightTab === "edit"
                        ? "bg-surface-active text-text-primary"
                        : "text-text-muted hover:text-text-primary"
                    }`}
                  >
                    {t("changes.tab.edit")}
                  </button>
                )}
              </div>
            )}
            <div className="flex-1 overflow-hidden">
              {rightTab === "history" && selectedFilePath ? (
                <FileHistoryPanel filePath={selectedFilePath} />
              ) : rightTab === "edit" && selectedFilePath && !selectedFileStaged ? (
                <FileEditor
                  filePath={selectedFilePath}
                  onClose={() => setRightTab("diff")}
                  onSaved={refreshStatus}
                />
              ) : (
                <DiffViewer interactive onStaged={refreshStatus} />
              )}
            </div>
          </>
        )}
      </div>

      {showCreateDialog && (
        <StashCreateDialog
          onClose={() => !creating && setShowCreateDialog(false)}
          onConfirm={handleCreateStash}
          loading={creating}
        />
      )}
    </div>
  );
}
