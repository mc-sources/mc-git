import { useTranslation } from "react-i18next";

interface Props {
  content: string;
  pendingCount: number;
  onChange: (content: string) => void;
}

export function MergeEditorResultPanel({ content, pendingCount, onChange }: Props) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Sub-header */}
      <div className="shrink-0 px-3 py-1.5 border-b border-surface-border bg-surface-elevated flex items-center gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-text-muted">
          {t("mergePanel.resultTitle")}
        </span>
        {pendingCount > 0 ? (
          <span className="text-[10px] text-orange-400">
            {t("mergePanel.pending", { count: pendingCount })}
          </span>
        ) : (
          <span className="text-[10px] text-green-400">{t("mergePanel.readyToApply")}</span>
        )}
      </div>

      {/* Editable textarea */}
      <textarea
        value={content}
        onChange={(e) => onChange(e.target.value)}
        spellCheck={false}
        className="flex-1 resize-none bg-surface-base text-text-primary leading-5 p-2 outline-none font-mono text-xs"
      />
    </div>
  );
}
