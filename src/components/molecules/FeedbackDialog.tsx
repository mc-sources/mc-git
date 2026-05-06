import { useState } from "react";
import { useTranslation } from "react-i18next";
import { openUrl } from "@tauri-apps/plugin-opener";
import { FEEDBACK_EMAIL } from "../../config";
import { useUiStore } from "../../store/uiStore";

type FeedbackType = "bug" | "suggestion" | "other";

interface Props {
  version: string;
  onClose: () => void;
}

export function FeedbackDialog({ version, onClose }: Props) {
  const { t } = useTranslation();
  const { setActiveView, setSettingsRequest } = useUiStore();
  const [feedbackType, setFeedbackType] = useState<FeedbackType>("bug");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  const openPrivacyPolicy = () => {
    setSettingsRequest({ tab: "about", anchor: "privacy" });
    setActiveView("settings");
    onClose();
  };

  const handleSend = async () => {
    if (!message.trim()) return;
    setSending(true);
    try {
      const typeLabel = t(`feedback.type.${feedbackType}`);
      const subject = encodeURIComponent(`[Mc-Git v${version}] ${typeLabel}`);
      const body = encodeURIComponent(
        `${message.trim()}\n\n---\n${t("feedback.versionLabel")}: ${version}`
      );
      await openUrl(`mailto:${encodeURIComponent(FEEDBACK_EMAIL)}?subject=${subject}&body=${body}`);
      onClose();
    } catch {
      // If opener fails, fall through — user still has the copy option
    } finally {
      setSending(false);
    }
  };

  const handleCopy = async () => {
    const typeLabel = t(`feedback.type.${feedbackType}`);
    const text = `[Mc-Git v${version}] ${typeLabel}\n\n${message.trim()}\n\n---\n${t("feedback.versionLabel")}: ${version}`;
    await navigator.clipboard.writeText(text);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-surface-elevated border border-surface-border rounded-xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-surface-border">
          <h2 className="text-sm font-semibold text-text-primary">{t("feedback.title")}</h2>
          <button
            onClick={onClose}
            className="text-text-muted hover:text-text-primary transition-colors text-lg leading-none"
          >
            ✕
          </button>
        </div>

        <div className="p-5 flex flex-col gap-4">
          {/* Type selector */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-text-secondary">{t("feedback.typeLabel")}</label>
            <div className="flex gap-2">
              {(["bug", "suggestion", "other"] as FeedbackType[]).map((type) => (
                <button
                  key={type}
                  onClick={() => setFeedbackType(type)}
                  className={[
                    "px-3 py-1.5 text-xs rounded-md border transition-colors",
                    feedbackType === type
                      ? "bg-blue-600 border-blue-500 text-white"
                      : "border-surface-border text-text-secondary hover:text-text-primary",
                  ].join(" ")}
                >
                  {t(`feedback.type.${type}`)}
                </button>
              ))}
            </div>
          </div>

          {/* Message */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-text-secondary">{t("feedback.messageLabel")}</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={t("feedback.messagePlaceholder")}
              rows={5}
              className="w-full bg-surface-base text-text-primary text-sm rounded-md px-3 py-2 border border-surface-border focus:outline-none focus:border-blue-500 placeholder:text-text-muted resize-none"
            />
          </div>

          {/* Version info */}
          <p className="text-xs text-text-muted">
            {t("feedback.versionInfo", { version })}
          </p>

          {/* Privacy notice */}
          <p className="text-xs text-text-muted">
            {t("feedback.privacyNotice")}{" "}
            <button
              type="button"
              onClick={openPrivacyPolicy}
              className="underline text-text-secondary hover:text-text-primary transition-colors"
            >
              {t("feedback.privacyLink")}
            </button>
            .
          </p>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-4 border-t border-surface-border">
          <button
            onClick={handleCopy}
            disabled={!message.trim()}
            className="px-4 py-2 text-sm text-text-secondary hover:text-text-primary border border-surface-border hover:border-blue-500 rounded-md transition-colors disabled:opacity-40"
          >
            {t("feedback.copy")}
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-text-secondary hover:text-text-primary transition-colors"
            >
              {t("common.cancel")}
            </button>
            <button
              onClick={handleSend}
              disabled={!message.trim() || sending}
              className="px-5 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white rounded-md transition-colors flex items-center gap-2"
            >
              {sending && <span className="w-3.5 h-3.5 rounded-full border-2 border-white/40 border-t-white animate-spin" />}
              {t("feedback.send")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
