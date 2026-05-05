import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "../../store/toastStore";
import { useGitRepository } from "../../infrastructure/GitRepositoryContext";
import { useRepoStore } from "../../store/repoStore";
import {
  listRemotesUseCase,
  addRemoteUseCase,
  removeRemoteUseCase,
  fetchUseCase,
  pruneRemoteUseCase
} from "../../usecases/remotes";
import { getDefaultRemoteUseCase, setDefaultRemoteUseCase } from "../../usecases/config";
import { parseAuthRequired, parseUnknownHost, parseMitmDetected } from "../../usecases/auth";
import { useAuthStore } from "../../store/authStore";
import type { RemoteInfo } from "../../domain/entities";

export function RemotePanel() {
  const { t } = useTranslation();
  const repo = useGitRepository();
  const { currentRepo } = useRepoStore();
  const { showAuthModal, showTofuModal } = useAuthStore();
  const [remotes, setRemotes] = useState<RemoteInfo[]>([]);
  const [defaultRemote, setDefaultRemote] = useState<string>("origin");
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [fetching, setFetching] = useState<string | null>(null);
  const [pruning, setPruning] = useState<string | null>(null);

  const refresh = async () => {
    try {
      const [list, def] = await Promise.all([
        listRemotesUseCase(repo),
        getDefaultRemoteUseCase(repo),
      ]);
      setRemotes(list);
      setDefaultRemote(def);
    } catch (e) {
      toast.error(String(e));
    }
  };

  useEffect(() => {
    refresh();
  }, [currentRepo?.path]);

  const handleSetDefault = async (remoteName: string) => {
    try {
      await setDefaultRemoteUseCase(repo, remoteName);
      setDefaultRemote(remoteName);
    } catch (e) {
      toast.error(String(e));
    }
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !url.trim()) return;
    try {
      await addRemoteUseCase(repo, name, url);
      setName("");
      setUrl("");
      await refresh();
    } catch (err) {
      toast.error(t("remotes.addFailed", { error: String(err) }));
    }
  };

  const handleRemove = async (remoteName: string) => {
    if (!confirm(t("remotes.deleteConfirm", { name: remoteName }))) return;
    try {
      await removeRemoteUseCase(repo, remoteName);
      await refresh();
    } catch (e) {
      toast.error(t("remotes.deleteFailed", { error: String(e) }));
    }
  };

  const handleFetch = async (remoteName: string) => {
    setFetching(remoteName);
    try {
      await fetchUseCase(repo, remoteName);
      toast.success(t("remotes.fetchDone", { name: remoteName }));
    } catch (e) {
      const errStr = String(e);
      const authHost = parseAuthRequired(errStr);
      const unknownHost = parseUnknownHost(errStr);
      const mitm = parseMitmDetected(errStr);
      if (authHost) {
        showAuthModal(authHost);
      } else if (unknownHost) {
        showTofuModal(unknownHost.host, unknownHost.fingerprint, () =>
          handleFetch(remoteName)
        );
      } else if (mitm) {
        toast.error(t("sshTofu.mitmWarning", { host: mitm.host, fingerprint: mitm.fingerprint }));
      } else {
        toast.error(t("remotes.fetchFailed", { error: errStr }));
      }
    } finally {
      setFetching(null);
    }
  };

  const handlePrune = async (remoteName: string) => {
    setPruning(remoteName);
    try {
      await pruneRemoteUseCase(repo, remoteName);
      toast.success(t("remotes.pruneDone", { name: remoteName }));
    } catch (e) {
      const errStr = String(e);
      const authHost = parseAuthRequired(errStr);
      const unknownHost = parseUnknownHost(errStr);
      const mitm = parseMitmDetected(errStr);
      if (authHost) {
        showAuthModal(authHost);
      } else if (unknownHost) {
        showTofuModal(unknownHost.host, unknownHost.fingerprint, () =>
          handlePrune(remoteName)
        );
      } else if (mitm) {
        toast.error(t("sshTofu.mitmWarning", { host: mitm.host, fingerprint: mitm.fingerprint }));
      } else {
        toast.error(t("remotes.pruneFailed", { error: errStr }));
      }
    } finally {
      setPruning(null);
    }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden p-4 gap-4">
      <h2 className="text-sm font-semibold text-text-primary">{t("remotes.title")}</h2>

      {/* List */}
      <div className="flex flex-col gap-2">
        {remotes.length === 0 && (
          <p className="text-xs text-text-muted">{t("remotes.none")}</p>
        )}
        {remotes.map((remote) => {
          const isDefault = remote.name === defaultRemote;
          return (
            <div
              key={remote.name}
              className={`bg-surface-elevated border rounded-md px-3 py-2.5 ${isDefault ? "border-blue-500/50" : "border-surface-border"}`}
            >
              <div className="flex items-center gap-2 mb-1">
                <p className="text-sm font-medium text-text-primary flex-1 flex items-center gap-1.5">
                  {remote.name}
                  {isDefault && (
                    <span className="text-[9px] font-bold uppercase tracking-wide px-1 py-0.5 rounded bg-blue-500/20 text-blue-400">
                      {t("remotes.default")}
                    </span>
                  )}
                </p>
                {!isDefault && (
                  <button
                    onClick={() => handleSetDefault(remote.name)}
                    className="text-xs text-text-secondary hover:text-blue-400 px-2 py-1 rounded hover:bg-surface-hover transition-colors"
                  >
                    {t("remotes.setDefault")}
                  </button>
                )}
                <button
                  onClick={() => handleFetch(remote.name)}
                  disabled={fetching === remote.name || pruning !== null}
                  className="text-xs text-text-secondary hover:text-text-primary px-2 py-1 rounded hover:bg-surface-hover transition-colors"
                >
                  {fetching === remote.name ? "…" : t("remotes.fetch")}
                </button>
                <button
                  onClick={() => handlePrune(remote.name)}
                  disabled={pruning === remote.name}
                  className="text-xs text-text-secondary hover:text-text-primary px-2 py-1 rounded hover:bg-surface-hover transition-colors"
                >
                  {pruning === remote.name ? "…" : t("remotes.prune")}
                </button>
                <button
                  onClick={() => handleRemove(remote.name)}
                  className="text-xs text-red-500 hover:text-red-400 px-2 py-1 rounded hover:bg-surface-hover transition-colors"
                >
                  {t("remotes.delete")}
                </button>
              </div>
              <p className="text-xs text-text-secondary truncate">{remote.url}</p>
            </div>
          );
        })}
      </div>

      {/* Add remote */}
      <form onSubmit={handleAdd} className="flex flex-col gap-2 pt-2">
        <div className="relative flex items-center">
          <div className="flex-1 border-t border-surface-border" />
          <span className="px-3 text-xs text-text-secondary">{t("remotes.add")}</span>
          <div className="flex-1 border-t border-surface-border" />
        </div>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t("remotes.namePlaceholder")}
          className="bg-surface-elevated text-text-primary text-sm rounded px-2 py-1.5 border border-surface-border focus:outline-none focus:border-blue-500 placeholder:text-text-muted"
        />
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder={t("remotes.urlPlaceholder")}
          className="bg-surface-elevated text-text-primary text-sm rounded px-2 py-1.5 border border-surface-border focus:outline-none focus:border-blue-500 placeholder:text-text-muted"
        />
        <button
          type="submit"
          disabled={!name.trim() || !url.trim()}
          className="px-4 py-1.5 text-xs font-medium bg-blue-600 hover:bg-blue-500 disabled:bg-surface-overlay disabled:text-text-muted text-white rounded transition-colors self-end"
        >
          {t("remotes.addButton")}
        </button>
      </form>
    </div>
  );
}
