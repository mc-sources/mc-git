import { useState, useEffect, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useUiStore } from "../../../store/uiStore";
import { useGitStore } from "../../../store/gitStore";
import { useGitRepository } from "../../../infrastructure/GitRepositoryContext";
import { getCommitFileDiffUseCase } from "../../../usecases/history";
import { toast } from "../../../store/toastStore";
import type { ChangedFileSummary, FileDiff } from "../../../domain/entities";
import { MiniDiff } from "../../molecules/MiniDiff";
import { CommitList } from "../../organisms/CommitList";

// ─── Simplified commit detail (read-only, no reset/revert/blame/file history) ─

type DiffState = "collapsed" | "loading" | FileDiff | "error";

function fileStatusClass(status: string): string | null {
  if (status === "added")    return "text-green-400";
  if (status === "deleted")  return "text-red-400";
  if (status === "renamed")  return "text-yellow-400";
  if (status === "copied")   return "text-blue-400";
  return null;
}

function EasyCommitDetailPanel() {
  const { t } = useTranslation();
  const { currentCommitDetail, ignoreWhitespace } = useUiStore();
  const { branches, tags } = useGitStore();
  const repo = useGitRepository();
  const [diffs, setDiffs] = useState<Map<string, DiffState>>(new Map());

  useEffect(() => {
    setDiffs(new Map());
  }, [currentCommitDetail?.oid]);

  const getPath = (f: ChangedFileSummary) => f.newPath ?? f.oldPath ?? "";

  const toggleDiff = useCallback(async (file: ChangedFileSummary) => {
    const path = getPath(file);
    if (!currentCommitDetail || !path) return;
    const current = diffs.get(path) ?? "collapsed";
    if (current !== "collapsed" && current !== "error") {
      setDiffs((prev) => new Map(prev).set(path, "collapsed"));
      return;
    }
    setDiffs((prev) => new Map(prev).set(path, "loading"));
    try {
      const fileDiff = await getCommitFileDiffUseCase(repo, currentCommitDetail.oid, path, ignoreWhitespace);
      setDiffs((prev) => new Map(prev).set(path, fileDiff));
    } catch (e) {
      setDiffs((prev) => new Map(prev).set(path, "error"));
      toast.error(String(e));
    }
  }, [currentCommitDetail, diffs, ignoreWhitespace, repo]);

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
        <dd className="font-mono text-text-primary">{d.shortOid}</dd>
        <dt className="text-text-muted">{t("commitDetail.author")}</dt>
        <dd>{d.author.name} &lt;{d.author.email}&gt;</dd>
        <dt className="text-text-muted">{t("commitDetail.date")}</dt>
        <dd>{new Date(d.author.when * 1000).toLocaleString()}</dd>
      </dl>

      {/* Changed files */}
      <div>
        <span className="text-xs text-text-secondary uppercase tracking-wide font-medium">
          {t("commitDetail.filesChanged", { count: d.changedFiles.length })}
        </span>
        <div className="flex flex-col gap-1 mt-2">
          {d.changedFiles.map((file) => {
            const path = getPath(file);
            const diffState = diffs.get(path) ?? "collapsed";
            const isOpen = diffState !== "collapsed" && diffState !== "loading";
            const isLoading = diffState === "loading";
            const statusClass = fileStatusClass(file.status);
            return (
              <div key={path} className="border border-surface-border rounded overflow-hidden">
                <div className="flex items-center gap-2 px-3 py-1.5 bg-surface-overlay">
                  {!file.isBinary && (
                    <button
                      onClick={() => toggleDiff(file)}
                      className="text-text-muted hover:text-text-primary transition-colors shrink-0 w-3.5 text-center"
                    >
                      {isLoading ? (
                        <span className="w-3 h-3 rounded-full border border-text-muted border-t-transparent animate-spin inline-block" />
                      ) : (
                        <span>{isOpen ? "▼" : "▶"}</span>
                      )}
                    </button>
                  )}
                  <p className="text-sm text-text-primary font-mono flex-1 min-w-0 truncate" title={path}>
                    {path}
                    {statusClass && (
                      <span className={`${statusClass} ml-1.5 font-sans text-xs`}>
                        ({t(`commitDetail.status.${file.status}`)})
                      </span>
                    )}
                    {file.isBinary && (
                      <span className="text-text-muted ml-1.5 font-sans text-xs">
                        ({t("commitDetail.binary")})
                      </span>
                    )}
                  </p>
                </div>
                {isOpen && typeof diffState === "object" && (
                  <div className="border-t border-surface-border">
                    <MiniDiff hunks={diffState.hunks} filename={path} />
                  </div>
                )}
                {diffState === "error" && (
                  <p className="text-xs text-red-400 px-3 py-2 border-t border-surface-border">
                    {t("commitDetail.diffError")}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Easy History View ────────────────────────────────────────────────────────

export function EasyHistoryView() {
  const { t } = useTranslation();
  const { currentCommitDetail, setCurrentCommitDetail } = useUiStore();

  const [detailWidth, setDetailWidth] = useState<number>(() => {
    try { return parseInt(localStorage.getItem("historyDetailWidth") ?? "480"); } catch { return 480; }
  });
  const resizeRef = useRef({ dragging: false, startX: 0, startW: 0 });

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!resizeRef.current.dragging) return;
      const next = Math.min(900, Math.max(280, resizeRef.current.startW - (e.clientX - resizeRef.current.startX)));
      setDetailWidth(next);
      localStorage.setItem("historyDetailWidth", String(next));
    };
    const onUp = () => {
      resizeRef.current.dragging = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
  }, []);

  const handleResizeDown = (e: React.MouseEvent) => {
    resizeRef.current = { dragging: true, startX: e.clientX, startW: detailWidth };
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  };

  return (
    <div className="relative h-full overflow-hidden">
      <CommitList />

      {currentCommitDetail && (
        <div
          className="absolute right-0 top-0 bottom-0 bg-surface-base border-l border-surface-border shadow-2xl flex flex-col z-20"
          style={{ width: detailWidth }}
        >
          {/* Left resize handle */}
          <div
            onMouseDown={handleResizeDown}
            className="absolute left-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-blue-500/40 active:bg-blue-500 transition-colors z-10"
          />

          {/* Header */}
          <div className="flex items-center justify-end px-3 py-1.5 border-b border-surface-border shrink-0">
            <button
              onClick={() => setCurrentCommitDetail(null)}
              title={t("common.close")}
              className="text-text-muted hover:text-text-primary transition-colors text-sm px-1"
            >
              ✕
            </button>
          </div>

          <div className="flex-1 overflow-hidden">
            <EasyCommitDetailPanel />
          </div>
        </div>
      )}
    </div>
  );
}
