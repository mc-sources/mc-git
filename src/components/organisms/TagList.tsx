import { useTranslation } from "react-i18next";

export function TagList() {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="px-4 py-3 border-b border-surface-border shrink-0">
        <h2 className="text-sm font-semibold text-text-primary">{t("tags.title")}</h2>
      </div>
      <div className="flex-1 min-h-0 overflow-auto flex items-center justify-center">
        <p className="text-sm text-text-muted">{t("tags.placeholder")}</p>
      </div>
    </div>
  );
}
