import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useGitStore } from "../../store/gitStore";
import { useGitRepository } from "../../infrastructure/GitRepositoryContext";
import { useRepoStore } from "../../store/repoStore";
import { useUiStore } from "../../store/uiStore";
import { toast } from "../../store/toastStore";
import { FileStatusIcon } from "../atoms/FileStatusIcon";
import type { FileDiff, FileStatusKind } from "../../domain/entities";
import {
  applyStashUseCase,
  dropStashUseCase,
  listStashesUseCase,
  popStashUseCase,
} from "../../usecases/stash";
import { getCommitDiffUseCase } from "../../usecases/history";

interface Props {
  onStatusChanged: () => void;
}

function diffStatusKind(f: FileDiff): FileStatusKind {
  if (!f.oldPath && f.newPath) return "added";
  if (f.oldPath && !f.newPath) return "deleted";
  if (f.oldPath && f.newPath && f.oldPath !== f.newPath) return "renamed";
  return "modified";
}

export function StashPanel({ onStatusChanged }: Props) {
  const { t } = useTranslation();
  const repo = useGitRepository();
  const { currentRepo } = useRepoStore();
  const { stashes, setStashes, bumpLogVersion } = useGitStore();
  const { setCurrentDiff, setSelectedFile } = useUiStore();
  const [confirmDrop, setConfirmDrop] = useState<number | null>(null);
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const [expandedFiles, setExpandedFiles] = useState<FileDiff[]>([]);
  const [loadingExpand, setLoadingExpand] = useState(false);

  const refreshStashes = async () => {
    try {
      setStashes(await listStashesUseCase(repo));
    } catch {
      // non-fatal
    }
  };

  const handleToggleExpand = async (index: number, oid: string) => {
    if (expandedIndex === index) {
      setExpandedIndex(null);
      setExpandedFiles([]);
      return;
    }
    setExpandedIndex(index);
    setExpandedFiles([]);
    setLoadingExpand(true);
    try {
      setExpandedFiles(await getCommitDiffUseCase(repo, oid));
    } catch (e) {
      toast.error(String(e));
      setExpandedIndex(null);
    } finally {
      setLoadingExpand(false);
    }
  };

  const handleSelectFile = (f: FileDiff) => {
    const path = f.newPath ?? f.oldPath ?? "";
    setSelectedFile(path, false);
    setCurrentDiff(f);
  };

  const handleApply = async (index: number) => {
    try {
      await applyStashUseCase(repo, index);
      onStatusChanged();
      bumpLogVersion();
      toast.success(t("stash.applied"));
    } catch (e) {
      toast.error(t("stash.applyFailed", { error: String(e) }));
    }
  };

  const handlePop = async (index: number) => {
    try {
      await popStashUseCase(repo, index);
      await refreshStashes();
      onStatusChanged();
      bumpLogVersion();
      toast.success(t("stash.popped"));
    } catch (e) {
      toast.error(t("stash.popFailed", { error: String(e) }));
    }
  };

  const handleDrop = async (index: number) => {
    try {
      await dropStashUseCase(repo, index);
      await refreshStashes();
      if (expandedIndex === index) {
        setExpandedIndex(null);
        setExpandedFiles([]);
      }
      toast.success(t("stash.dropped"));
    } catch (e) {
      toast.error(t("stash.dropFailed", { error: String(e) }));
    } finally {
      setConfirmDrop(null);
    }
  };

  if (!currentRepo) return null;

  if (stashes.length === 0) {
    return (
      <div className="px-4 py-3 text-xs text-text-muted">
        {t("stash.none")}
      </div>
    );
  }

  return (
    <ul className="divide-y divide-surface-border">
      {stashes.map((entry) => {
        const isExpanded = expandedIndex === entry.index;
        return (
          <li key={entry.oid} className="flex flex-col">
            {/* Header */}
            <button
              onClick={() => handleToggleExpand(entry.index, entry.oid)}
              className="flex items-center gap-2 px-3 py-2 hover:bg-surface-hover transition-colors text-left w-full"
            >
              <span className="text-text-muted text-[10px] shrink-0">
                {isExpanded ? "▼" : "▶"}
              </span>
              <span className="text-xs text-text-muted font-mono shrink-0">
                stash@{"{" + entry.index + "}"}
              </span>
              <span className="text-xs text-text-primary truncate flex-1">{entry.message}</span>
            </button>

            {/* Expanded: file list */}
            {isExpanded && (
              <div className="border-t border-surface-border bg-surface-base">
                {loadingExpand ? (
                  <div className="px-4 py-2 text-xs text-text-muted">{t("stash.loading")}</div>
                ) : expandedFiles.length === 0 ? (
                  <div className="px-4 py-2 text-xs text-text-muted">{t("stash.noFiles")}</div>
                ) : (
                  <ul>
                    {expandedFiles.map((f, i) => {
                      const displayPath = f.newPath ?? f.oldPath ?? "";
                      return (
                        <li key={i}>
                          <button
                            onClick={() => handleSelectFile(f)}
                            className="flex items-center gap-2 w-full px-4 py-1.5 hover:bg-surface-hover transition-colors text-left"
                          >
                            <FileStatusIcon kind={diffStatusKind(f)} />
                            <span className="text-xs text-text-primary truncate">{displayPath}</span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}

                {/* Actions */}
                <div className="px-3 py-2 border-t border-surface-border">
                  {confirmDrop === entry.index ? (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-text-secondary flex-1">Supprimer ce stash ?</span>
                      <button
                        onClick={() => handleDrop(entry.index)}
                        className="text-xs px-2 py-1 bg-red-600 hover:bg-red-500 text-white rounded transition-colors"
                      >
                        Confirmer
                      </button>
                      <button
                        onClick={() => setConfirmDrop(null)}
                        className="text-xs px-2 py-1 text-text-secondary hover:text-text-primary transition-colors"
                      >
                        Annuler
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleApply(entry.index)}
                        className="text-xs px-2 py-1 bg-surface-overlay hover:bg-surface-active text-text-primary rounded border border-surface-border transition-colors"
                      >
                        Apply
                      </button>
                      <button
                        onClick={() => handlePop(entry.index)}
                        className="text-xs px-2 py-1 bg-surface-overlay hover:bg-surface-active text-text-primary rounded border border-surface-border transition-colors"
                      >
                        Pop
                      </button>
                      <button
                        onClick={() => setConfirmDrop(entry.index)}
                        className="text-xs px-2 py-1 text-text-secondary hover:text-red-400 transition-colors"
                      >
                        Drop
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Collapsed: actions inline */}
            {!isExpanded && (
              <div className="px-3 pb-2">
                {confirmDrop === entry.index ? (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-text-secondary flex-1">{t("stash.deleteConfirm")}</span>
                    <button
                      onClick={() => handleDrop(entry.index)}
                      className="text-xs px-2 py-1 bg-red-600 hover:bg-red-500 text-white rounded transition-colors"
                    >
                      {t("common.confirm")}
                    </button>
                    <button
                      onClick={() => setConfirmDrop(null)}
                      className="text-xs px-2 py-1 text-text-secondary hover:text-text-primary transition-colors"
                    >
                      {t("common.cancel")}
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleApply(entry.index)}
                      className="text-xs px-2 py-1 bg-surface-overlay hover:bg-surface-active text-text-primary rounded border border-surface-border transition-colors"
                    >
                      Apply
                    </button>
                    <button
                      onClick={() => handlePop(entry.index)}
                      className="text-xs px-2 py-1 bg-surface-overlay hover:bg-surface-active text-text-primary rounded border border-surface-border transition-colors"
                    >
                      Pop
                    </button>
                    <button
                      onClick={() => setConfirmDrop(entry.index)}
                      className="text-xs px-2 py-1 text-text-secondary hover:text-red-400 transition-colors"
                    >
                      Drop
                    </button>
                  </div>
                )}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
