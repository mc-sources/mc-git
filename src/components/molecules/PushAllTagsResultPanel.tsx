import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { TagPushResult } from "../../domain/entities";

interface PushAllTagsResultPanelProps {
  results: TagPushResult[];
  remote: string;
  onClose: () => void;
  onRetryFailed?: () => Promise<void>;
}

export function PushAllTagsResultPanel({
  results,
  remote,
  onClose,
  onRetryFailed,
}: PushAllTagsResultPanelProps) {
  const { t } = useTranslation();
  const [retrying, setRetrying] = useState(false);

  const successCount = results.filter((r) => r.success).length;
  const failedCount = results.length - successCount;
  const hasFailures = failedCount > 0;

  const handleRetry = async () => {
    if (!onRetryFailed) return;
    setRetrying(true);
    try {
      await onRetryFailed();
    } finally {
      setRetrying(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-surface-elevated border border-surface-border rounded-xl shadow-2xl w-full max-w-md mx-4 overflow-hidden flex flex-col">
        <div className="px-5 py-4 border-b border-surface-border">
          <h2 className="text-sm font-semibold text-text-primary">
            {t("pushAllTags.title", { count: results.length, remote })}
          </h2>
          <p className="text-xs text-text-muted mt-1">
            {t("pushAllTags.summary", {
              success: successCount,
              failed: failedCount,
            })}
          </p>
        </div>

        <div className="max-h-64 overflow-y-auto px-3 py-2 flex flex-col gap-0.5">
          {results.length === 0 ? (
            <p className="text-xs text-text-muted px-2 py-2 text-center">
              {t("pushAllTags.empty")}
            </p>
          ) : (
            results.map((r) => (
              <div
                key={r.tagName}
                className="flex items-center gap-2 px-2 py-1.5 text-xs rounded-md"
              >
                <span
                  className={`font-mono w-3 ${
                    r.success ? "text-emerald-400" : "text-red-400"
                  }`}
                >
                  {r.success ? "✓" : "✗"}
                </span>
                <span className="font-mono text-text-primary truncate flex-1">
                  {r.tagName}
                </span>
                {!r.success && r.error && (
                  <span
                    title={r.error}
                    className="text-text-muted truncate max-w-[200px]"
                  >
                    {r.error}
                  </span>
                )}
              </div>
            ))
          )}
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-surface-border">
          {hasFailures && onRetryFailed && (
            <button
              onClick={handleRetry}
              disabled={retrying}
              className="px-4 py-2 text-sm text-text-primary bg-blue-600 hover:bg-blue-500 rounded-md transition-colors flex items-center gap-2 disabled:opacity-50"
            >
              {retrying && (
                <span className="w-3.5 h-3.5 rounded-full border-2 border-white/40 border-t-white animate-spin" />
              )}
              {t("pushAllTags.retryFailed")}
            </button>
          )}
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-text-secondary hover:text-text-primary transition-colors"
          >
            {t("pushAllTags.close")}
          </button>
        </div>
      </div>
    </div>
  );
}
