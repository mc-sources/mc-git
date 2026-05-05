import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useGitRepository } from "../../infrastructure/GitRepositoryContext";
import { toast } from "../../store/toastStore";
import { getFileHistoryUseCase, getCommitFileDiffUseCase } from "../../usecases/history";
import type { CommitSummary, FileDiff } from "../../domain/entities";
import { MiniDiff } from "../molecules/MiniDiff";

function formatDate(timestamp: number): string {
  return new Date(timestamp * 1000).toLocaleDateString(undefined, {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  });
}

export function FileHistoryPanel({ filePath }: { filePath: string }) {
  const { t } = useTranslation();
  const repo = useGitRepository();

  const [commits, setCommits] = useState<CommitSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOid, setSelectedOid] = useState<string | null>(null);
  const [diffMap, setDiffMap] = useState<Map<string, FileDiff | "loading" | "error">>(new Map());

  useEffect(() => {
    setLoading(true);
    setCommits([]);
    setSelectedOid(null);
    setDiffMap(new Map());
    getFileHistoryUseCase(repo, filePath)
      .then(setCommits)
      .catch((e) => toast.error(String(e)))
      .finally(() => setLoading(false));
  }, [repo, filePath]);

  const handleSelect = async (oid: string) => {
    if (selectedOid === oid) {
      setSelectedOid(null);
      return;
    }
    setSelectedOid(oid);
    if (diffMap.has(oid)) return;
    setDiffMap((prev) => new Map(prev).set(oid, "loading"));
    try {
      const d = await getCommitFileDiffUseCase(repo, oid, filePath);
      setDiffMap((prev) => new Map(prev).set(oid, d));
    } catch {
      setDiffMap((prev) => new Map(prev).set(oid, "error"));
    }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden text-sm">
      <div className="px-3 py-1.5 border-b border-surface-border bg-surface-elevated shrink-0 flex items-center gap-2">
        <span className="font-mono text-xs text-text-muted truncate flex-1">{filePath}</span>
        {!loading && (
          <span className="text-[10px] text-text-muted shrink-0">
            {t("fileHistory.count", { count: commits.length })}
          </span>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading && (
          <p className="text-xs text-text-muted px-3 py-4 text-center">{t("fileHistory.loading")}</p>
        )}
        {!loading && commits.length === 0 && (
          <p className="text-xs text-text-muted px-3 py-4 text-center">{t("fileHistory.empty")}</p>
        )}
        {commits.map((commit) => {
          const diffState = diffMap.get(commit.oid);
          const isSelected = selectedOid === commit.oid;
          return (
            <div key={commit.oid}>
              <button
                onClick={() => handleSelect(commit.oid)}
                className={`w-full text-left px-3 py-2 flex items-start gap-2 border-b border-surface-border transition-colors ${
                  isSelected ? "bg-surface-active" : "hover:bg-surface-hover"
                }`}
              >
                <span className="font-mono text-[10px] text-text-muted shrink-0 w-14 pt-px">
                  {commit.shortOid}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-text-primary truncate">{commit.summary}</p>
                  <p className="text-[10px] text-text-muted mt-0.5">
                    {commit.author.name} · {formatDate(commit.author.when)}
                  </p>
                </div>
                <span className="text-[10px] text-text-muted shrink-0 pt-px">{isSelected ? "▴" : "▾"}</span>
              </button>
              {isSelected && (
                <div className="border-b border-surface-border px-2 py-1">
                  {diffState === "loading" && (
                    <p className="text-xs text-text-muted py-2 text-center">{t("fileHistory.loadingDiff")}</p>
                  )}
                  {diffState === "error" && (
                    <p className="text-xs text-red-400 py-2 text-center">{t("fileHistory.diffError")}</p>
                  )}
                  {diffState && diffState !== "loading" && diffState !== "error" && (
                    diffState.hunks.length > 0
                      ? <MiniDiff hunks={diffState.hunks} filename={filePath} />
                      : <p className="text-xs text-text-muted py-2 text-center">{t("diff.noChanges")}</p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
