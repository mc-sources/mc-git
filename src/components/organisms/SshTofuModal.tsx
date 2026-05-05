import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useGitRepository } from "../../infrastructure/GitRepositoryContext";
import { useAuthStore } from "../../store/authStore";
import { trustSshHostUseCase } from "../../usecases/auth";
import { toast } from "../../store/toastStore";

export function SshTofuModal() {
  const { t } = useTranslation();
  const repo = useGitRepository();
  const {
    pendingTofuHost,
    pendingTofuFingerprint,
    pendingTofuRetry,
    hideTofuModal,
  } = useAuthStore();
  const [trusting, setTrusting] = useState(false);

  if (!pendingTofuHost || !pendingTofuFingerprint) return null;

  const handleTrust = async () => {
    setTrusting(true);
    try {
      await trustSshHostUseCase(repo, pendingTofuHost, pendingTofuFingerprint);
      hideTofuModal();
      if (pendingTofuRetry) {
        await pendingTofuRetry();
      }
    } catch (e) {
      toast.error(t("sshTofu.error", { error: String(e) }));
    } finally {
      setTrusting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center"
      onClick={(e) => { if (e.target === e.currentTarget) hideTofuModal(); }}
    >
      <div className="bg-surface-elevated border border-surface-border rounded-xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-surface-border">
          <span className="text-sm font-semibold text-text-primary">
            {t("sshTofu.title")}
          </span>
          <button
            onClick={hideTofuModal}
            className="text-text-muted hover:text-text-primary transition-colors text-lg leading-none"
          >
            ✕
          </button>
        </div>

        <div className="p-5 flex flex-col gap-4">
          <p className="text-sm text-text-secondary">
            {t("sshTofu.description", { host: pendingTofuHost })}
          </p>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-text-secondary">{t("sshTofu.hostLabel")}</label>
            <input
              type="text"
              value={pendingTofuHost}
              readOnly
              className="bg-surface-base text-text-muted text-sm rounded-md px-3 py-2 border border-surface-border"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-text-secondary">{t("sshTofu.fingerprintLabel")}</label>
            <code className="bg-surface-base text-text-secondary text-xs font-mono rounded-md px-3 py-2 border border-surface-border break-all">
              {pendingTofuFingerprint}
            </code>
          </div>

          <p className="text-xs text-text-muted">
            {t("sshTofu.info")}
          </p>

          <div className="flex justify-end gap-2 pt-1">
            <button
              onClick={hideTofuModal}
              className="px-4 py-2 text-sm text-text-secondary hover:text-text-primary border border-surface-border rounded-md transition-colors"
            >
              {t("common.cancel")}
            </button>
            <button
              onClick={handleTrust}
              disabled={trusting}
              className="px-5 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-500 disabled:bg-surface-overlay disabled:text-text-muted text-white rounded-md transition-colors"
            >
              {trusting ? t("sshTofu.trusting") : t("sshTofu.trust")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
