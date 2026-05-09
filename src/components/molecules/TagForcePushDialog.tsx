import { useState } from "react";
import { useTranslation } from "react-i18next";

interface Props {
  tag: string;
  remote: string;
  remoteOid: string;
  localOid: string;
  loading: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export function TagForcePushDialog({
  tag,
  remote,
  remoteOid,
  localOid,
  loading,
  onClose,
  onConfirm,
}: Props) {
  const { t } = useTranslation();
  const [acknowledged, setAcknowledged] = useState(false);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={(e) => {
        if (e.target === e.currentTarget && !loading) onClose();
      }}
    >
      <div className="bg-surface-elevated border border-red-500/50 rounded-xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-4 border-b border-red-500/40 bg-red-500/10">
          <span className="text-red-400 text-lg" aria-hidden>
            ⚠
          </span>
          <h2 className="text-sm font-semibold text-red-200">
            {t("tags.forcePush.title", { tag, remote })}
          </h2>
        </div>

        <div className="p-5 flex flex-col gap-4">
          <p className="text-xs text-text-secondary whitespace-pre-line">
            {t("tags.forcePush.body", { tag, remote })}
          </p>
          <div className="bg-surface-base border border-surface-border rounded-md px-3 py-2 font-mono text-[11px] flex flex-col gap-1">
            <div className="flex gap-2">
              <span className="text-text-muted shrink-0 w-16">Local</span>
              <span className="text-blue-300">{localOid}</span>
            </div>
            <div className="flex gap-2">
              <span className="text-text-muted shrink-0 w-16">Remote</span>
              <span className="text-amber-300">{remoteOid}</span>
            </div>
          </div>
          <label className="flex items-start gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={acknowledged}
              onChange={(e) => setAcknowledged(e.target.checked)}
              disabled={loading}
              className="w-3.5 h-3.5 mt-0.5 accent-red-500 shrink-0"
            />
            <span className="text-xs text-text-secondary">{t("tags.forcePush.checkbox")}</span>
          </label>
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-surface-border bg-surface-base">
          {!loading && (
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-text-secondary hover:text-text-primary transition-colors"
            >
              {t("tags.forcePush.cancel")}
            </button>
          )}
          <button
            onClick={onConfirm}
            disabled={!acknowledged || loading}
            className="px-4 py-2 text-sm font-semibold bg-red-600 hover:bg-red-500 disabled:opacity-40 text-white rounded-md transition-colors flex items-center gap-2"
          >
            {loading && (
              <span className="w-3.5 h-3.5 rounded-full border-2 border-white/40 border-t-white animate-spin" />
            )}
            {t("tags.forcePush.confirm")}
          </button>
        </div>
      </div>
    </div>
  );
}
