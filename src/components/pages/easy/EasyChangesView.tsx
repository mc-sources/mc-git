import { useEffect, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useResizable } from "../../../hooks/useResizable";
import { useGitRepository } from "../../../infrastructure/GitRepositoryContext";
import { useRepoStore } from "../../../store/repoStore";
import { useGitStore } from "../../../store/gitStore";
import { useUiStore } from "../../../store/uiStore";
import { toast } from "../../../store/toastStore";
import { getStatusUseCase } from "../../../usecases/staging";
import { abortMergeUseCase, getRepositoryStateUseCase } from "../../../usecases/branches";
import { resolveDeletionAcceptUseCase, resolveDeletionRestoreUseCase, resolveDeletionAcceptTheirsUseCase, resolveDeletionKeepOursUseCase } from "../../../usecases/staging";
import { createCommitUseCase } from "../../../usecases/commit";
import { getStatusUseCase as getStatusForCommit } from "../../../usecases/staging";
import { listBranchesUseCase } from "../../../usecases/branches";
import { FileList } from "../../organisms/FileList";
import { DiffViewer } from "../../organisms/DiffViewer";
import { MergeEditor } from "../../organisms/MergeEditor";
import { ResizeHandle } from "../../atoms/ResizeHandle";
import type { IGitRepository } from "../../../domain/ports/IGitRepository";
import type { FileDiff } from "../../../domain/entities";
import { SUBJECT_MAX_LENGTH } from "../../../domain/value-objects/CommitMessage";

// ─── Conflict panels (reused from ChangesView) ────────────────────────────────

function EasyDeletedConflictPanel({
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
          {resolving === "accept" ? "…" : t("easy.conflict.keepTheirs")}
        </button>
        <button
          onClick={handleRestore}
          disabled={resolving !== null}
          className="text-xs px-3 py-1.5 bg-green-700 hover:bg-green-600 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded transition-colors"
        >
          {resolving === "restore" ? "…" : t("easy.conflict.keepMine")}
        </button>
      </div>
    </div>
  );
}

function EasyDeletedByThemConflictPanel({
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
          {resolving === "accept" ? "…" : t("easy.conflict.keepTheirs")}
        </button>
        <button
          onClick={handleKeep}
          disabled={resolving !== null}
          className="text-xs px-3 py-1.5 bg-green-700 hover:bg-green-600 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded transition-colors"
        >
          {resolving === "keep" ? "…" : t("easy.conflict.keepMine")}
        </button>
      </div>
    </div>
  );
}

// ─── Simplified MergeEditor wrapper (ours/theirs only) ────────────────────────

function EasyMergeEditor({
  filePath,
  diff,
  onResolved,
}: {
  filePath: string;
  diff: FileDiff;
  onResolved: () => Promise<void>;
}) {
  // Reuse MergeEditor — it already exposes ours/theirs buttons.
  // The "both" button is part of ConflictResolver inside MergeEditor.
  // For simplicity in Easy mode, we render the full MergeEditor;
  // hiding the "both" button is a future refinement.
  return <MergeEditor key={filePath} filePath={filePath} diff={diff} onResolved={onResolved} />;
}

// ─── Simplified commit form ────────────────────────────────────────────────────

function EasyCommitForm() {
  const { t } = useTranslation();
  const repo = useGitRepository();
  const [subject, setSubject] = useState("");
  const [loading, setLoading] = useState(false);
  const { status, setStatus, setBranches, bumpLogVersion } = useGitStore();
  const { setCurrentDiff, setSelectedFile, setRepositoryState } = useUiStore();

  const hasStagedChanges = status.some((e) =>
    ["added", "modified", "deleted", "renamed"].includes(e.staged)
  );
  const subjectLen = subject.length;
  const subjectOver = subjectLen > SUBJECT_MAX_LENGTH;
  const canCommit = hasStagedChanges;

  const handleSubmit = async () => {
    if (!canCommit || loading) return;
    setLoading(true);
    try {
      const now = new Date();
      const pad = (n: number) => String(n).padStart(2, "0");
      const date = `${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
      const message = subject.trim() || t("easy.commit.defaultMessage", { date });
      await createCommitUseCase(repo, message);
      toast.success(t("easy.commit.created"));
      setSubject("");
      setCurrentDiff(null);
      setSelectedFile(null);
      const [newStatus, repoState, branchList] = await Promise.all([
        getStatusForCommit(repo),
        getRepositoryStateUseCase(repo),
        listBranchesUseCase(repo, "all"),
      ]);
      setStatus(newStatus);
      setRepositoryState(repoState);
      setBranches(branchList);
      bumpLogVersion();
    } catch (err) {
      toast.error(t("commit.failed", { error: String(err) }));
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="flex flex-col gap-2 p-3 border-t border-surface-border bg-surface-base">
      <div className="relative">
        <input
          type="text"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={t("easy.commit.summaryPlaceholder")}
          className={[
            "w-full bg-surface-elevated text-text-primary text-sm rounded-md px-3 py-2 border focus:outline-none placeholder:text-text-muted transition-colors",
            subjectOver
              ? "border-red-500 focus:border-red-400"
              : "border-surface-border focus:border-blue-500",
          ].join(" ")}
        />
        {subjectLen > 0 && (
          <span
            className={[
              "absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-mono tabular-nums",
              subjectOver ? "text-red-400" : "text-text-muted",
            ].join(" ")}
          >
            {subjectLen}/{SUBJECT_MAX_LENGTH}
          </span>
        )}
      </div>
      <div className="flex items-center justify-end">
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-text-muted select-none">⌃↵</span>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={loading || !canCommit}
            className="px-4 py-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-500 disabled:bg-surface-elevated disabled:text-text-muted text-white rounded-md transition-all duration-100 flex items-center gap-1.5"
          >
            {loading && (
              <span className="w-3 h-3 rounded-full border-2 border-white/40 border-t-white animate-spin" />
            )}
            {t("easy.commit.button")}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main view ────────────────────────────────────────────────────────────────

export function EasyChangesView() {
  const { t } = useTranslation();
  const { width, onMouseDown } = useResizable(288, 180, 480);
  const repo = useGitRepository();
  const { currentRepo } = useRepoStore();
  const { status, setStatus } = useGitStore();
  const { repositoryState, setRepositoryState, selectedFilePath, selectedFileStaged, currentDiff, setCurrentDiff } = useUiStore();

  const selectedEntry = selectedFilePath ? status.find((e) => e.path === selectedFilePath) : null;
  const isConflicted = !selectedFileStaged && selectedEntry?.unstaged === "conflicted";
  const [aborting, setAborting] = useState(false);

  useEffect(() => {
    getRepositoryStateUseCase(repo).then(setRepositoryState).catch(() => {});
  }, [repo, currentRepo?.path]);

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

  const conflictedFiles = status.filter(
    (e) => e.staged === "conflicted" || e.unstaged === "conflicted"
  );
  const conflictCount = conflictedFiles.length;
  const resolvedCount = conflictedFiles.filter(
    (e) => e.staged !== "conflicted" && e.unstaged !== "conflicted"
  ).length;

  const handleConflictResolved = async () => {
    await refreshStatus();
    setCurrentDiff(null);
  };

  const handleAbortMerge = async () => {
    setAborting(true);
    try {
      await abortMergeUseCase(repo);
      setRepositoryState("clean");
      setCurrentDiff(null);
      await refreshStatus();
      toast.success(t("changes.merge.aborted"));
    } catch (e) {
      toast.error(String(e));
    } finally {
      setAborting(false);
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

        <div className="flex-1 overflow-hidden">
          <FileList showDirActions={false} />
        </div>
        <EasyCommitForm />
      </div>

      <ResizeHandle onMouseDown={onMouseDown} />

      <div className="flex flex-col flex-1 overflow-hidden">
        {isConflicted && currentDiff && currentDiff.newPath === null && currentDiff.hunks.length === 0 ? (
          <EasyDeletedConflictPanel
            filePath={selectedFilePath!}
            repo={repo}
            onResolved={async () => { await refreshStatus(); setCurrentDiff(null); }}
          />
        ) : isConflicted && currentDiff && currentDiff.deletedByThem ? (
          <EasyDeletedByThemConflictPanel
            filePath={selectedFilePath!}
            repo={repo}
            onResolved={async () => { await refreshStatus(); setCurrentDiff(null); }}
          />
        ) : isConflicted && currentDiff ? (
          <EasyMergeEditor
            filePath={selectedFilePath!}
            diff={currentDiff}
            onResolved={handleConflictResolved}
          />
        ) : (
          <DiffViewer interactive onStaged={refreshStatus} />
        )}
      </div>
    </div>
  );
}
