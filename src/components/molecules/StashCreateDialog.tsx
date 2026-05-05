import { useState } from "react";
import { useTranslation } from "react-i18next";

interface Props {
  onClose: () => void;
  onConfirm: (message: string | null, includeUntracked: boolean, keepIndex: boolean) => void;
  loading: boolean;
}

export function StashCreateDialog({ onClose, onConfirm, loading }: Props) {
  const { t } = useTranslation();
  const [message, setMessage] = useState("");
  const [includeUntracked, setIncludeUntracked] = useState(false);
  const [keepIndex, setKeepIndex] = useState(false);

  const handleSubmit = () => {
    onConfirm(message.trim() || null, includeUntracked, keepIndex);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={(e) => { if (e.target === e.currentTarget && !loading) onClose(); }}
    >
      <div className="bg-surface-elevated border border-surface-border rounded-xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-surface-border">
          <h2 className="text-sm font-semibold text-text-primary">{t("stashDialog.title")}</h2>
          {!loading && (
            <button
              onClick={onClose}
              className="text-text-muted hover:text-text-primary transition-colors text-lg leading-none"
            >
              ✕
            </button>
          )}
        </div>

        <div className="p-5 flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-text-secondary">{t("stashDialog.messageLabel")}</label>
            <input
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={t("stashDialog.messagePlaceholder")}
              disabled={loading}
              autoFocus
              className="bg-surface-base text-text-primary text-sm rounded-md px-3 py-2 border border-surface-border focus:outline-none focus:border-blue-500 placeholder:text-text-muted disabled:opacity-50 transition-colors"
            />
          </div>

          <div className="flex flex-col gap-2">
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={includeUntracked}
                onChange={(e) => setIncludeUntracked(e.target.checked)}
                disabled={loading}
                className="w-3.5 h-3.5 accent-blue-500"
              />
              <span className="text-sm text-text-primary">{t("stashDialog.includeUntracked")}</span>
            </label>
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={keepIndex}
                onChange={(e) => setKeepIndex(e.target.checked)}
                disabled={loading}
                className="w-3.5 h-3.5 accent-blue-500"
              />
              <span className="text-sm text-text-primary">{t("stashDialog.keepIndex")}</span>
            </label>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-surface-border">
          {!loading && (
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-text-secondary hover:text-text-primary transition-colors"
            >
              {t("common.cancel")}
            </button>
          )}
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="px-5 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white rounded-md transition-colors flex items-center gap-2"
          >
            {loading && (
              <span className="w-3.5 h-3.5 rounded-full border-2 border-white/40 border-t-white animate-spin" />
            )}
            {loading ? t("common.creating") : t("common.create")}
          </button>
        </div>
      </div>
    </div>
  );
}
