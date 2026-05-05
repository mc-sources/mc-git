import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useGitRepository } from "../../infrastructure/GitRepositoryContext";
import { useAuthStore } from "../../store/authStore";
import { saveCredentialsUseCase } from "../../usecases/auth";
import { toast } from "../../store/toastStore";

export function AuthModal() {
  const { t } = useTranslation();
  const repo = useGitRepository();
  const { pendingHost, hideAuthModal } = useAuthStore();
  const [username, setUsername] = useState("");
  const [token, setToken] = useState("");
  const [saving, setSaving] = useState(false);

  if (!pendingHost) return null;

  const handleSave = async () => {
    if (!username.trim() || !token.trim()) {
      toast.error(t("auth.required"));
      return;
    }
    setSaving(true);
    try {
      await saveCredentialsUseCase(repo, pendingHost, username.trim(), token.trim());
      toast.success(t("auth.saved", { host: pendingHost }));
      hideAuthModal();
    } catch (e) {
      toast.error(t("auth.error", { error: String(e) }));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center"
      onClick={(e) => { if (e.target === e.currentTarget) hideAuthModal(); }}
    >
      <div className="bg-surface-elevated border border-surface-border rounded-xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-surface-border">
          <span className="text-sm font-semibold text-text-primary">
            {t("auth.title")}
          </span>
          <button
            onClick={hideAuthModal}
            className="text-text-muted hover:text-text-primary transition-colors text-lg leading-none"
          >
            ✕
          </button>
        </div>

        <div className="p-5 flex flex-col gap-4">
          <p className="text-sm text-text-secondary">
            {t("auth.description", { host: pendingHost })}
          </p>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-text-secondary">{t("auth.hostLabel")}</label>
            <input
              type="text"
              value={pendingHost}
              readOnly
              className="bg-surface-base text-text-muted text-sm rounded-md px-3 py-2 border border-surface-border"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-text-secondary">{t("auth.usernameLabel")}</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder={t("auth.usernamePlaceholder")}
              autoFocus
              className="bg-surface-elevated text-text-primary text-sm rounded-md px-3 py-2 border border-surface-border focus:outline-none focus:border-blue-500 placeholder:text-text-muted transition-colors"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-text-secondary">{t("auth.patLabel")}</label>
            <input
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder={t("auth.patPlaceholder")}
              onKeyDown={(e) => { if (e.key === "Enter") handleSave(); }}
              className="bg-surface-elevated text-text-primary text-sm rounded-md px-3 py-2 border border-surface-border focus:outline-none focus:border-blue-500 placeholder:text-text-muted transition-colors"
            />
          </div>

          <p className="text-xs text-text-muted">
            {t("auth.info")}
          </p>

          <div className="flex justify-end gap-2 pt-1">
            <button
              onClick={hideAuthModal}
              className="px-4 py-2 text-sm text-text-secondary hover:text-text-primary border border-surface-border rounded-md transition-colors"
            >
              {t("common.cancel")}
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-5 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-500 disabled:bg-surface-overlay disabled:text-text-muted text-white rounded-md transition-colors"
            >
              {saving ? t("auth.saving") : t("auth.save")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
