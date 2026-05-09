import { useState } from "react";
import { useTranslation } from "react-i18next";

interface Props {
  headOid: string;
  targetOidReadOnly?: boolean;
  onClose: () => void;
  onConfirm: (name: string, targetOid: string, message: string | null) => void;
  loading: boolean;
}

export function TagCreateDialog({ headOid, targetOidReadOnly = false, onClose, onConfirm, loading }: Props) {
  const { t } = useTranslation();
  const [name, setName] = useState("");
  const [targetOid, setTargetOid] = useState(headOid);
  const [annotated, setAnnotated] = useState(true);
  const [message, setMessage] = useState("");

  const canCreate = name.trim().length > 0 && targetOid.trim().length > 0 && (!annotated || message.trim().length > 0);

  const handleSubmit = () => {
    if (!canCreate) return;
    onConfirm(name.trim(), targetOid.trim(), annotated ? message.trim() : null);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={(e) => { if (e.target === e.currentTarget && !loading) onClose(); }}
    >
      <div className="bg-surface-elevated border border-surface-border rounded-xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-surface-border">
          <h2 className="text-sm font-semibold text-text-primary">{t("tagDialog.title")}</h2>
          {!loading && (
            <button onClick={onClose} className="text-text-muted hover:text-text-primary transition-colors text-lg leading-none">
              ✕
            </button>
          )}
        </div>

        <div className="p-5 flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-text-secondary">{t("tagDialog.nameLabel")}</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("tagDialog.namePlaceholder")}
              disabled={loading}
              autoFocus
              className="bg-surface-base text-text-primary text-sm rounded-md px-3 py-2 border border-surface-border focus:outline-none focus:border-blue-500 placeholder:text-text-muted disabled:opacity-50 transition-colors"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-text-secondary">{t("tagDialog.targetLabel")}</label>
            <input
              type="text"
              value={targetOid}
              onChange={(e) => setTargetOid(e.target.value)}
              disabled={loading || targetOidReadOnly}
              className="bg-surface-base text-text-primary text-sm rounded-md px-3 py-2 border border-surface-border focus:outline-none focus:border-blue-500 font-mono placeholder:text-text-muted disabled:opacity-50 transition-colors"
            />
          </div>

          <label className="flex items-center gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={annotated}
              onChange={(e) => setAnnotated(e.target.checked)}
              disabled={loading}
              className="w-3.5 h-3.5 accent-blue-500"
            />
            <span className="text-sm text-text-primary">{t("tagDialog.annotated")}</span>
          </label>

          {annotated && (
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-text-secondary">{t("tagDialog.messageLabel")}</label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                disabled={loading}
                rows={3}
                placeholder={t("tagDialog.messagePlaceholder")}
                className="bg-surface-base text-text-primary text-sm rounded-md px-3 py-2 border border-surface-border focus:outline-none focus:border-blue-500 placeholder:text-text-muted disabled:opacity-50 transition-colors resize-none"
              />
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-surface-border">
          {!loading && (
            <button onClick={onClose} className="px-4 py-2 text-sm text-text-secondary hover:text-text-primary transition-colors">
              {t("common.cancel")}
            </button>
          )}
          <button
            onClick={handleSubmit}
            disabled={!canCreate || loading}
            className="px-5 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white rounded-md transition-colors flex items-center gap-2"
          >
            {loading && <span className="w-3.5 h-3.5 rounded-full border-2 border-white/40 border-t-white animate-spin" />}
            {loading ? t("common.creating") : t("common.create")}
          </button>
        </div>
      </div>
    </div>
  );
}
