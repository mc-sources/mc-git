import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "../../store/toastStore";
import { useGitRepository } from "../../infrastructure/GitRepositoryContext";
import { useRepoStore } from "../../store/repoStore";
import {
  listSubmodulesUseCase,
  initSubmoduleUseCase,
  updateSubmoduleUseCase,
  updateAllSubmodulesUseCase,
  addSubmoduleUseCase,
} from "../../usecases/submodules";
import type { SubmoduleInfo } from "../../domain/entities";

export function SubmodulePanel() {
  const { t } = useTranslation();
  const repo = useGitRepository();
  const { currentRepo } = useRepoStore();
  const [submodules, setSubmodules] = useState<SubmoduleInfo[]>([]);
  const [loading, setLoading] = useState<string | null>(null);
  const [updatingAll, setUpdatingAll] = useState(false);
  const [addUrl, setAddUrl] = useState("");
  const [addPath, setAddPath] = useState("");
  const [adding, setAdding] = useState(false);

  const refresh = async () => {
    try {
      setSubmodules(await listSubmodulesUseCase(repo));
    } catch (e) {
      toast.error(String(e));
    }
  };

  useEffect(() => {
    refresh();
  }, [currentRepo?.path]);

  const handleInit = async (name: string) => {
    setLoading(name);
    try {
      await initSubmoduleUseCase(repo, name);
      toast.success(t("submodules.initDone", { name }));
      await refresh();
    } catch (e) {
      toast.error(t("submodules.initFailed", { error: String(e) }));
    } finally {
      setLoading(null);
    }
  };

  const handleUpdate = async (name: string) => {
    setLoading(name);
    try {
      await updateSubmoduleUseCase(repo, name);
      toast.success(t("submodules.updateDone", { name }));
      await refresh();
    } catch (e) {
      toast.error(t("submodules.updateFailed", { error: String(e) }));
    } finally {
      setLoading(null);
    }
  };

  const handleUpdateAll = async () => {
    setUpdatingAll(true);
    try {
      await updateAllSubmodulesUseCase(repo);
      toast.success(t("submodules.updateAllDone"));
      await refresh();
    } catch (e) {
      toast.error(t("submodules.updateAllFailed", { error: String(e) }));
    } finally {
      setUpdatingAll(false);
    }
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addUrl.trim() || !addPath.trim()) return;
    setAdding(true);
    try {
      await addSubmoduleUseCase(repo, addUrl.trim(), addPath.trim());
      toast.success(t("submodules.addDone", { path: addPath.trim() }));
      setAddUrl("");
      setAddPath("");
      await refresh();
    } catch (e) {
      toast.error(t("submodules.addFailed", { error: String(e) }));
    } finally {
      setAdding(false);
    }
  };

  const statusLabel = (s: SubmoduleInfo["status"]) => {
    if (s === "uninitialized") return t("submodules.statusUninitialized");
    if (s === "modified") return t("submodules.statusModified");
    return t("submodules.statusUpToDate");
  };

  const statusColor = (s: SubmoduleInfo["status"]) => {
    if (s === "uninitialized") return "text-zinc-400";
    if (s === "modified") return "text-yellow-400";
    return "text-green-400";
  };

  return (
    <div className="flex flex-col h-full overflow-hidden p-4 gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-text-primary">{t("submodules.title")}</h2>
        {submodules.length > 0 && (
          <button
            onClick={handleUpdateAll}
            disabled={updatingAll || loading !== null}
            className="text-xs text-text-secondary hover:text-text-primary px-2 py-1 rounded hover:bg-surface-hover transition-colors disabled:opacity-50"
          >
            {updatingAll ? "…" : t("submodules.updateAll")}
          </button>
        )}
      </div>

      <div className="flex flex-col gap-2">
        {submodules.length === 0 && (
          <p className="text-xs text-text-muted">{t("submodules.none")}</p>
        )}
        {submodules.map((sub) => (
          <div
            key={sub.name}
            className="bg-surface-elevated border border-surface-border rounded-md px-3 py-2.5"
          >
            <div className="flex items-center gap-2 mb-1">
              <p className="text-sm font-medium text-text-primary flex-1 truncate">{sub.name}</p>
              <span className={`text-xs ${statusColor(sub.status)}`}>
                {statusLabel(sub.status)}
              </span>
              {sub.status === "uninitialized" ? (
                <button
                  onClick={() => handleInit(sub.name)}
                  disabled={loading === sub.name || updatingAll}
                  className="text-xs text-text-secondary hover:text-text-primary px-2 py-1 rounded hover:bg-surface-hover transition-colors disabled:opacity-50"
                >
                  {loading === sub.name ? "…" : t("submodules.init")}
                </button>
              ) : (
                <button
                  onClick={() => handleUpdate(sub.name)}
                  disabled={loading === sub.name || updatingAll}
                  className="text-xs text-text-secondary hover:text-text-primary px-2 py-1 rounded hover:bg-surface-hover transition-colors disabled:opacity-50"
                >
                  {loading === sub.name ? "…" : t("submodules.update")}
                </button>
              )}
            </div>
            <p className="text-xs text-text-secondary truncate">{sub.path}</p>
            {sub.url && (
              <p className="text-xs text-text-muted truncate">{sub.url}</p>
            )}
          </div>
        ))}
      </div>
      {/* Add submodule */}
      <form onSubmit={handleAdd} className="flex flex-col gap-2 pt-2">
        <div className="relative flex items-center">
          <div className="flex-1 border-t border-surface-border" />
          <span className="px-3 text-xs text-text-secondary">{t("submodules.add")}</span>
          <div className="flex-1 border-t border-surface-border" />
        </div>
        <input
          value={addUrl}
          onChange={(e) => setAddUrl(e.target.value)}
          placeholder={t("submodules.urlPlaceholder")}
          className="bg-surface-elevated text-text-primary text-sm rounded px-2 py-1.5 border border-surface-border focus:outline-none focus:border-blue-500 placeholder:text-text-muted"
        />
        <input
          value={addPath}
          onChange={(e) => setAddPath(e.target.value)}
          placeholder={t("submodules.pathPlaceholder")}
          className="bg-surface-elevated text-text-primary text-sm rounded px-2 py-1.5 border border-surface-border focus:outline-none focus:border-blue-500 placeholder:text-text-muted"
        />
        <button
          type="submit"
          disabled={!addUrl.trim() || !addPath.trim() || adding}
          className="px-4 py-1.5 text-xs font-medium bg-blue-600 hover:bg-blue-500 disabled:bg-surface-overlay disabled:text-text-muted text-white rounded transition-colors self-end"
        >
          {adding ? "…" : t("submodules.addButton")}
        </button>
      </form>
    </div>
  );
}
