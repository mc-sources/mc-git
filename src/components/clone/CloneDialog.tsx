import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { open } from "@tauri-apps/plugin-dialog";
import { useGitRepository } from "../../infrastructure/GitRepositoryContext";
import { useCloneProgress } from "../../infrastructure/events/useCloneProgress";
import { cloneRepositoryUseCase } from "../../usecases/repository";
import { parseAuthRequired, parseUnknownHost, parseMitmDetected } from "../../usecases/auth";
import { useAuthStore } from "../../store/authStore";
import { toast } from "../../store/toastStore";
import type { RepoInfo } from "../../domain/entities";

function inferRepoName(url: string): string {
  const parts = url.replace(/\.git$/, "").split("/");
  return parts[parts.length - 1] || "";
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

type State = "idle" | "cloning" | "error";

export function CloneDialog({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: (repoInfo: RepoInfo, tabId: string) => void;
}) {
  const { t } = useTranslation();
  const repo = useGitRepository();
  const { progress, reset } = useCloneProgress();
  const { showAuthModal, showTofuModal } = useAuthStore();
  const [state, setState] = useState<State>("idle");
  const [url, setUrl] = useState("");
  const [targetDir, setTargetDir] = useState("");
  const [folderName, setFolderName] = useState("");
  const [error, setError] = useState("");
  const prevInferred = useRef("");

  useEffect(() => {
    const inferred = inferRepoName(url);
    if (folderName === prevInferred.current) {
      setFolderName(inferred);
    }
    prevInferred.current = inferred;
  }, [url]);

  const targetPath = targetDir && folderName ? `${targetDir}/${folderName}` : "";

  const handlePickDir = async () => {
    const selected = await open({ directory: true, multiple: false });
    if (selected && typeof selected === "string") {
      setTargetDir(selected);
    }
  };

  const handleClone = async () => {
    if (!url.trim() || !targetPath) return;
    setState("cloning");
    setError("");
    reset();
    const tabId = crypto.randomUUID();
    try {
      const repoInfo = await cloneRepositoryUseCase(repo, url.trim(), targetPath, tabId);
      onSuccess(repoInfo, tabId);
    } catch (e) {
      const errStr = String(e);
      const authHost = parseAuthRequired(errStr);
      const unknownHost = parseUnknownHost(errStr);
      const mitm = parseMitmDetected(errStr);
      if (authHost) {
        setState("idle");
        showAuthModal(authHost);
      } else if (unknownHost) {
        setState("idle");
        showTofuModal(unknownHost.host, unknownHost.fingerprint, handleClone);
      } else if (mitm) {
        setState("error");
        setError(t("sshTofu.mitmWarning", { host: mitm.host, fingerprint: mitm.fingerprint }));
        toast.error(t("sshTofu.mitmWarning", { host: mitm.host, fingerprint: mitm.fingerprint }));
      } else {
        setState("error");
        setError(errStr);
      }
    }
  };

  const canClone = url.trim().length > 0 && targetDir.length > 0 && folderName.trim().length > 0 && state !== "cloning";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={(e) => { if (e.target === e.currentTarget && state !== "cloning") onClose(); }}
    >
      <div className="bg-surface-elevated border border-surface-border rounded-xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-surface-border">
          <h2 className="text-sm font-semibold text-text-primary">{t("clone.title")}</h2>
          {state !== "cloning" && (
            <button
              onClick={onClose}
              className="text-text-muted hover:text-text-primary transition-colors text-lg leading-none"
            >
              ✕
            </button>
          )}
        </div>

        <div className="p-5 flex flex-col gap-4">
          {/* URL */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-text-secondary">{t("clone.urlLabel")}</label>
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder={t("clone.urlPlaceholder")}
              disabled={state === "cloning"}
              className="bg-surface-base text-text-primary text-sm rounded-md px-3 py-2 border border-surface-border focus:outline-none focus:border-blue-500 placeholder:text-text-muted disabled:opacity-50 transition-colors"
            />
          </div>

          {/* Directory */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-text-secondary">{t("clone.parentDirLabel")}</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={targetDir}
                readOnly
                placeholder={t("clone.chooseDirButton")}
                disabled={state === "cloning"}
                className="flex-1 bg-surface-base text-text-primary text-sm rounded-md px-3 py-2 border border-surface-border focus:outline-none cursor-default placeholder:text-text-muted disabled:opacity-50"
              />
              <button
                onClick={handlePickDir}
                disabled={state === "cloning"}
                className="px-3 py-2 text-xs bg-surface-overlay hover:bg-surface-active text-text-primary rounded-md border border-surface-border transition-colors disabled:opacity-50"
              >
                {t("clone.browse")}
              </button>
            </div>
          </div>

          {/* Folder name */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-text-secondary">{t("clone.folderNameLabel")}</label>
            <input
              type="text"
              value={folderName}
              onChange={(e) => setFolderName(e.target.value)}
              placeholder={t("clone.folderNamePlaceholder")}
              disabled={state === "cloning"}
              className="bg-surface-base text-text-primary text-sm rounded-md px-3 py-2 border border-surface-border focus:outline-none focus:border-blue-500 placeholder:text-text-muted disabled:opacity-50 transition-colors"
            />
            {targetPath && (
              <p className="text-xs text-text-muted font-mono truncate">→ {targetPath}</p>
            )}
          </div>

          {/* Progress */}
          {state === "cloning" && (
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between text-xs text-text-secondary">
                <span>{t("clone.cloning")}</span>
                {progress && (
                  <span className="font-mono">
                    {progress.receivedObjects}/{progress.totalObjects} objets
                    {" · "}{formatBytes(progress.receivedBytes)}
                  </span>
                )}
              </div>
              <div className="h-1.5 bg-surface-border rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 transition-all duration-200 rounded-full"
                  style={{ width: `${progress?.percent ?? 0}%` }}
                />
              </div>
            </div>
          )}

          {/* Error */}
          {state === "error" && (
            <div className="bg-red-950/30 border border-red-500/30 rounded-md px-3 py-2">
              <p className="text-xs text-red-400 break-words">{error}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-surface-border">
          {state !== "cloning" && (
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-text-secondary hover:text-text-primary transition-colors"
            >
              {t("common.cancel")}
            </button>
          )}
          <button
            onClick={handleClone}
            disabled={!canClone}
            className="px-5 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white rounded-md transition-colors flex items-center gap-2"
          >
            {state === "cloning" && (
              <span className="w-3.5 h-3.5 rounded-full border-2 border-white/40 border-t-white animate-spin" />
            )}
            {state === "cloning" ? t("clone.cloningButton") : t("clone.clone")}
          </button>
        </div>
      </div>
    </div>
  );
}
