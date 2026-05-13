import { useTranslation } from "react-i18next";
import type { TagInfo } from "../../domain/entities";

export type TagDeleteMode = "local" | "remote";

interface TagDeleteDialogProps {
  mode: TagDeleteMode;
  tag: TagInfo;
  presentOnRemotes: string[];
  loading: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export function TagDeleteDialog({
  mode,
  tag,
  presentOnRemotes,
  loading,
  onClose,
  onConfirm,
}: TagDeleteDialogProps) {
  const { t } = useTranslation();
  const showRemoteBanner = mode === "local" && presentOnRemotes.length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-surface-elevated border border-surface-border rounded-xl shadow-2xl w-full max-w-md mx-4 p-5 flex flex-col gap-4">
        <div>
          <p className="text-sm font-semibold text-text-primary">
            {t("tags.delete.title", { name: tag.name })}
          </p>
          <p className="text-xs text-text-muted mt-0.5 font-mono">
            {tag.targetOid.slice(0, 7)}
          </p>
        </div>

        {showRemoteBanner && (
          <p className="text-xs text-blue-300 bg-blue-500/10 border border-blue-500/30 rounded-md px-3 py-2">
            {t("tags.delete.bannerPresentOnRemotes", {
              remotes: presentOnRemotes.join(", "),
            })}
          </p>
        )}

        <p className="text-xs text-text-secondary whitespace-pre-line">
          {t("tags.delete.body")}
        </p>

        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 text-sm text-text-secondary hover:text-text-primary transition-colors disabled:opacity-50"
          >
            {t("tags.delete.cancel")}
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="px-4 py-2 text-sm font-medium bg-red-600 hover:bg-red-500 text-white rounded-md transition-colors flex items-center gap-2 disabled:opacity-50"
          >
            {loading && (
              <span className="w-3.5 h-3.5 rounded-full border-2 border-white/40 border-t-white animate-spin" />
            )}
            {t("tags.delete.confirm")}
          </button>
        </div>
      </div>
    </div>
  );
}
