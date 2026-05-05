import { useState, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useUiStore } from "../../store/uiStore";
import { useGitRepository } from "../../infrastructure/GitRepositoryContext";
import { useRepoStore } from "../../store/repoStore";
import { useSettingsStore } from "../../store/settingsStore";
import { toast } from "../../store/toastStore";
import {
  stageHunkUseCase,
  unstageHunkUseCase,
  stageSelectionUseCase,
  unstageSelectionUseCase,
  getFileDiffUseCase,
} from "../../usecases/staging";
import { openExternalDiff } from "../../services/systemService";
import { HunkView } from "../molecules/HunkView";
import { SplitHunkView } from "../molecules/SplitHunkView";
import { useHighlight } from "../../hooks/useHighlight";

interface Props {
  interactive?: boolean;
  onStaged?: () => void;
}

export function DiffViewer({ interactive, onStaged }: Props) {
  const { t } = useTranslation();
  const {
    currentDiff,
    selectedFilePath,
    selectedFileStaged,
    setCurrentDiff,
    diffMode,
    setDiffMode,
    ignoreWhitespace,
    setIgnoreWhitespace,
  } = useUiStore();
  const repo = useGitRepository();
  const { currentRepo } = useRepoStore();
  const { diffToolCommand } = useSettingsStore();

  // Map<hunkIndex, Set<lineIndex>>
  const [selectedLines, setSelectedLines] = useState<Map<number, Set<number>>>(new Map());

  const totalSelected = Array.from(selectedLines.values()).reduce((acc, s) => acc + s.size, 0);

  const handleLineToggle = useCallback((hunkIndex: number, lineIndex: number) => {
    setSelectedLines((prev) => {
      const next = new Map(prev);
      const set = new Set(next.get(hunkIndex) ?? []);
      if (set.has(lineIndex)) {
        set.delete(lineIndex);
      } else {
        set.add(lineIndex);
      }
      if (set.size === 0) {
        next.delete(hunkIndex);
      } else {
        next.set(hunkIndex, set);
      }
      return next;
    });
  }, []);

  const refreshDiff = useCallback(async (iw = ignoreWhitespace) => {
    if (!selectedFilePath) return;
    try {
      const diff = await getFileDiffUseCase(repo, selectedFilePath, selectedFileStaged, iw);
      setCurrentDiff(diff);
    } catch {
      // non-fatal
    }
  }, [repo, selectedFilePath, selectedFileStaged, ignoreWhitespace, setCurrentDiff]);

  const handleOpenExternalDiff = useCallback(async () => {
    if (!selectedFilePath || !currentRepo || !diffToolCommand.trim()) return;
    try {
      await openExternalDiff(diffToolCommand.trim(), currentRepo.path, selectedFilePath, selectedFileStaged);
    } catch (e) {
      toast.error(String(e));
    }
  }, [selectedFilePath, currentRepo, diffToolCommand, selectedFileStaged]);

  const handleToggleIgnoreWhitespace = useCallback(async () => {
    const next = !ignoreWhitespace;
    setIgnoreWhitespace(next);
    await refreshDiff(next);
  }, [ignoreWhitespace, setIgnoreWhitespace, refreshDiff]);

  const handleStageHunk = useCallback(async (hunkIndex: number) => {
    if (!currentDiff || !selectedFilePath) return;
    const hunk = currentDiff.hunks[hunkIndex];
    try {
      if (selectedFileStaged) {
        await unstageHunkUseCase(repo, selectedFilePath, hunk, hunkIndex);
      } else {
        await stageHunkUseCase(repo, selectedFilePath, hunk, hunkIndex);
      }
      setSelectedLines(new Map());
      await refreshDiff();
      onStaged?.();
    } catch (e) {
      toast.error(String(e));
    }
  }, [currentDiff, selectedFilePath, selectedFileStaged, repo, refreshDiff, onStaged]);

  const handleStageSelection = useCallback(async () => {
    if (!currentDiff || !selectedFilePath) return;
    try {
      for (const [hunkIndex, indices] of selectedLines.entries()) {
        const hunk = currentDiff.hunks[hunkIndex];
        if (selectedFileStaged) {
          await unstageSelectionUseCase(repo, selectedFilePath, hunk, hunkIndex, indices);
        } else {
          await stageSelectionUseCase(repo, selectedFilePath, hunk, hunkIndex, indices);
        }
      }
      setSelectedLines(new Map());
      await refreshDiff();
      onStaged?.();
    } catch (e) {
      toast.error(String(e));
    }
  }, [currentDiff, selectedFilePath, selectedFileStaged, selectedLines, repo, refreshDiff, onStaged]);

  // Syntax highlighting — must be declared before any early return (Rules of Hooks)
  const allLines = useMemo(
    () => currentDiff?.hunks.flatMap((h) => h.lines.map((l) => l.content.replace(/\n$/, ""))) ?? [],
    [currentDiff]
  );
  const allTokens = useHighlight(allLines, selectedFilePath ?? "");

  // Map tokens back to each hunk by cumulative offset
  const hunkTokenSlices = useMemo(() => {
    if (!allTokens || !currentDiff) return null;
    const slices: Array<typeof allTokens> = [];
    let offset = 0;
    for (const hunk of currentDiff.hunks) {
      slices.push(allTokens.slice(offset, offset + hunk.lines.length));
      offset += hunk.lines.length;
    }
    return slices;
  }, [allTokens, currentDiff]);

  if (!selectedFilePath) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-text-muted">
        <svg className="w-10 h-10 opacity-30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" width={40} height={40} style={{ display: "block" }}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6M9 16h6M9 8h6M5 3h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2z" />
        </svg>
        <p className="text-sm">{t("diff.selectFile")}</p>
      </div>
    );
  }

  if (!currentDiff) {
    return (
      <div className="flex items-center justify-center h-full gap-2 text-text-secondary text-sm">
        <span className="w-4 h-4 rounded-full border-2 border-text-secondary border-t-transparent animate-spin" />
        {t("diff.loading")}
      </div>
    );
  }

  if (currentDiff.isBinary) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-2 text-text-secondary">
        <svg className="w-8 h-8 opacity-40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width={32} height={32} style={{ display: "block" }}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
        </svg>
        <p className="text-sm">{t("diff.binary")}</p>
      </div>
    );
  }

  if (currentDiff.hunks.length === 0 && !currentDiff.newPath) {
    const messageKey = currentDiff.deletedInConflict ? "diff.fileDeletedInConflict" : "diff.fileDeleted";
    return (
      <div className="flex flex-col items-center justify-center h-full gap-2 text-red-400">
        <svg className="w-8 h-8 opacity-70" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width={32} height={32} style={{ display: "block" }}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
        <p className="text-sm">{t(messageKey)}</p>
      </div>
    );
  }

  if (currentDiff.hunks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-2 text-text-muted">
        <svg className="w-8 h-8 opacity-40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width={32} height={32} style={{ display: "block" }}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
        <p className="text-sm">{t("diff.noChanges")}</p>
      </div>
    );
  }

  const selectionLabel = selectedFileStaged
    ? t("diff.unstageSelection", { count: totalSelected })
    : t("diff.stageSelection", { count: totalSelected });

  const useSplit = diffMode === "split";

  return (
    <div className="flex flex-col h-full overflow-hidden bg-surface-base">
      {/* Header */}
      <div className="shrink-0 px-3 py-2 border-b border-surface-border bg-surface-elevated flex items-center gap-2 flex-wrap">
        <span className="text-xs font-mono text-text-primary truncate flex-1 min-w-0">{selectedFilePath}</span>

        {/* Ignore whitespace */}
        <label className="flex items-center gap-1.5 text-xs text-text-secondary cursor-pointer select-none shrink-0">
          <input
            type="checkbox"
            checked={ignoreWhitespace}
            onChange={handleToggleIgnoreWhitespace}
            className="w-3 h-3 accent-blue-500"
          />
          {t("diff.ignoreWhitespace")}
        </label>

        {/* Unified / Split toggle */}
        <div className="flex shrink-0 rounded border border-surface-border overflow-hidden">
          <button
            onClick={() => setDiffMode("unified")}
            className={[
              "px-2 py-0.5 text-[10px] transition-colors",
              diffMode === "unified"
                ? "bg-blue-600 text-white"
                : "text-text-secondary hover:text-text-primary",
            ].join(" ")}
          >
            {t("diff.unified")}
          </button>
          <button
            onClick={() => setDiffMode("split")}
            className={[
              "px-2 py-0.5 text-[10px] border-l border-surface-border transition-colors",
              diffMode === "split"
                ? "bg-blue-600 text-white"
                : "text-text-secondary hover:text-text-primary",
            ].join(" ")}
          >
            {t("diff.sideBySide")}
          </button>
        </div>

        {/* External diff tool button */}
        {diffToolCommand.trim() && (
          <button
            onClick={handleOpenExternalDiff}
            title={t("diff.openExternal", { tool: diffToolCommand.trim().split(" ")[0] })}
            className="shrink-0 text-xs px-2 py-1 rounded border border-surface-border text-text-secondary hover:text-text-primary hover:border-blue-500 transition-colors font-mono"
          >
            {t("diff.openExternal", { tool: diffToolCommand.trim().split(" ")[0] })}
          </button>
        )}

        {/* Stage selection button */}
        {interactive && totalSelected > 0 && (
          <button
            onClick={handleStageSelection}
            className="shrink-0 text-xs px-2 py-1 rounded border border-blue-500/50 text-blue-400 hover:bg-blue-500/10 transition-colors"
          >
            {selectionLabel}
          </button>
        )}
      </div>

      {/* Diff content */}
      <div className="flex-1 overflow-auto">
        <table className="w-full border-collapse">
          <tbody>
            {currentDiff.hunks.map((hunk, i) =>
              useSplit ? (
                <SplitHunkView key={i} hunk={hunk} />
              ) : (
                <HunkView
                  key={i}
                  hunk={hunk}
                  hunkIndex={i}
                  interactive={interactive}
                  staged={selectedFileStaged}
                  selectedLines={selectedLines.get(i)}
                  onStageHunk={handleStageHunk}
                  onLineToggle={handleLineToggle}
                  tokenLines={hunkTokenSlices?.[i]}
                />
              )
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
