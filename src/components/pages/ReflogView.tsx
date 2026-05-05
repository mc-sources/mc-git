import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import i18n from "../../i18n";
import { useGitRepository } from "../../infrastructure/GitRepositoryContext";
import { useRepoStore } from "../../store/repoStore";
import { getReflogUseCase } from "../../usecases/reflog";
import { createBranchUseCase } from "../../usecases/branches";
import { toast } from "../../store/toastStore";
import type { ReflogEntry } from "../../domain/entities";

function formatDate(timestamp: number): string {
  const d = new Date(timestamp * 1000);
  return d.toLocaleDateString(i18n.language, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function actionLabel(message: string): string {
  const colon = message.indexOf(":");
  return colon !== -1 ? message.slice(0, colon) : message;
}

export function ReflogView() {
  const { t } = useTranslation();
  const repo = useGitRepository();
  const { currentRepo } = useRepoStore();
  const [entries, setEntries] = useState<ReflogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [contextMenu, setContextMenu] = useState<{ entry: ReflogEntry; x: number; y: number } | null>(null);
  const [branchDialog, setBranchDialog] = useState<{ entry: ReflogEntry } | null>(null);
  const [branchName, setBranchName] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    setLoading(true);
    getReflogUseCase(repo)
      .then(setEntries)
      .catch((e) => toast.error(String(e)))
      .finally(() => setLoading(false));
  }, [repo, currentRepo?.path]);

  const handleCreateBranch = async () => {
    if (!branchDialog || !branchName.trim()) return;
    setCreating(true);
    try {
      await createBranchUseCase(repo, branchName.trim(), branchDialog.entry.oidNew);
      toast.success(t("branches.created", { name: branchName.trim() }));
      setBranchDialog(null);
      setBranchName("");
    } catch (e) {
      toast.error(String(e));
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden" onClick={() => setContextMenu(null)}>
      {/* Header */}
      <div className="shrink-0 px-3 py-2 border-b border-surface-border bg-surface-elevated flex items-center gap-2">
        <span className="text-xs font-semibold text-text-primary">{t("reflog.title")}</span>
        <span className="text-xs text-text-muted">({t("reflog.entries", { count: entries.length })})</span>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {loading && (
          <div className="flex items-center justify-center py-8">
            <span className="w-4 h-4 rounded-full border-2 border-blue-400/40 border-t-blue-400 animate-spin" />
          </div>
        )}

        {!loading && entries.length === 0 && (
          <p className="text-xs text-text-muted px-3 py-4">{t("reflog.empty")}</p>
        )}

        {!loading && entries.map((entry) => (
          <div
            key={entry.index}
            onContextMenu={(e) => {
              e.preventDefault();
              setContextMenu({ entry, x: e.clientX, y: e.clientY });
            }}
            className="flex items-start gap-2.5 px-3 py-2.5 border-b border-surface-border hover:bg-surface-hover transition-colors cursor-default select-none"
          >
            {/* Index */}
            <span className="text-[10px] text-text-muted font-mono w-6 shrink-0 pt-0.5 text-right">
              {entry.index}
            </span>

            {/* Hash */}
            <span className="font-mono text-xs text-orange-400 shrink-0 w-14">
              {entry.shortOidNew}
            </span>

            {/* Action badge */}
            <span className="text-[10px] bg-surface-overlay border border-surface-border rounded px-1.5 py-0.5 text-text-secondary shrink-0 leading-none self-start mt-0.5">
              {actionLabel(entry.message)}
            </span>

            {/* Message + date */}
            <div className="flex-1 min-w-0">
              <p className="text-xs text-text-primary truncate">{entry.message}</p>
              <p className="text-[10px] text-text-muted mt-0.5">{formatDate(entry.timestamp)}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Context menu */}
      {contextMenu && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setContextMenu(null)} />
          <div
            style={{ top: contextMenu.y, left: contextMenu.x }}
            className="fixed z-50 bg-surface-elevated border border-surface-border rounded-lg shadow-2xl py-1 min-w-44 overflow-hidden"
          >
            <button
              onClick={() => {
                setBranchDialog({ entry: contextMenu.entry });
                setBranchName(`recover-${contextMenu.entry.shortOidNew}`);
                setContextMenu(null);
              }}
              className="w-full text-left px-4 py-2 text-sm text-text-primary hover:bg-surface-hover transition-colors"
            >
              {t("reflog.createBranchHere")}
            </button>
          </div>
        </>
      )}

      {/* Create branch dialog */}
      {branchDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-surface-elevated border border-surface-border rounded-xl shadow-2xl w-full max-w-sm mx-4 p-5 flex flex-col gap-4">
            <div>
              <p className="text-sm font-semibold text-text-primary">{t("reflog.createBranch.title")}</p>
              <p className="text-xs text-text-muted mt-0.5 font-mono">{branchDialog.entry.shortOidNew} — {branchDialog.entry.message}</p>
            </div>
            <input
              value={branchName}
              onChange={(e) => setBranchName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreateBranch();
                if (e.key === "Escape") setBranchDialog(null);
              }}
              autoFocus
              placeholder={t("reflog.createBranch.placeholder")}
              className="bg-surface-overlay text-text-primary text-sm rounded-md px-3 py-2 border border-surface-border focus:outline-none focus:border-blue-500 placeholder:text-text-muted"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setBranchDialog(null)}
                disabled={creating}
                className="px-4 py-2 text-sm text-text-secondary hover:text-text-primary transition-colors disabled:opacity-50"
              >
                {t("common.cancel")}
              </button>
              <button
                onClick={handleCreateBranch}
                disabled={creating || !branchName.trim()}
                className="px-4 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-500 text-white rounded-md transition-colors flex items-center gap-2 disabled:opacity-50"
              >
                {creating && <span className="w-3.5 h-3.5 rounded-full border-2 border-white/40 border-t-white animate-spin" />}
                {t("reflog.createBranch.button")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
