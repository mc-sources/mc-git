import { useTranslation } from "react-i18next";
import { FileStatusIcon } from "../atoms/FileStatusIcon";
import type { StatusEntry } from "../../domain/entities";

export function FileRow({
  entry,
  staged,
  isSelected,
  isMultiSelected,
  onSelect,
  onToggleStage,
  onDiscard,
  displayName,
  isIgnored,
  onToggleIgnore,
  onContextMenu,
}: {
  entry: StatusEntry;
  staged: boolean;
  isSelected: boolean;
  isMultiSelected?: boolean;
  onSelect: (e: React.MouseEvent) => void;
  onToggleStage: () => void;
  onDiscard?: () => void;
  displayName?: string;
  isIgnored?: boolean;
  onToggleIgnore?: () => void;
  onContextMenu?: (e: React.MouseEvent) => void;
}) {
  const { t } = useTranslation();
  const kind = staged ? entry.staged : entry.unstaged;

  let bg = "hover:bg-surface-hover";
  if (isSelected) bg = "bg-surface-active";
  else if (isMultiSelected) bg = "bg-blue-500/10 border-l-2 border-blue-500";

  return (
    <div
      onClick={onSelect}
      onContextMenu={onContextMenu}
      title={entry.path}
      className={`flex items-center gap-2 px-2 py-1.5 cursor-pointer group ${bg}${isIgnored ? " opacity-60" : ""}`}
    >
      <FileStatusIcon kind={kind} />
      <div className="flex-1 min-w-0">
        <span className="text-sm text-text-primary truncate block font-mono">{displayName ?? entry.path}</span>
      </div>
      <div className="flex items-center gap-1">
        {/* Always-visible ⊘ indicator for ignored files */}
        {!staged && onToggleIgnore && isIgnored && (
          <button
            onClick={(e) => { e.stopPropagation(); onToggleIgnore(); }}
            title={t("fileRow.unignoreTitle")}
            className="text-xs px-1 text-orange-400 shrink-0"
          >
            ⊘
          </button>
        )}
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {/* ⊘ on hover for non-ignored files */}
          {!staged && onToggleIgnore && !isIgnored && (
            <button
              onClick={(e) => { e.stopPropagation(); onToggleIgnore(); }}
              title={t("fileRow.ignoreTitle")}
              className="text-xs px-1 text-text-muted hover:text-orange-400"
            >
              ⊘
            </button>
          )}
          {!staged && onDiscard && (
            <button
              onClick={(e) => { e.stopPropagation(); onDiscard(); }}
              title="Discard changes"
              className="text-xs text-red-400 hover:text-red-300 px-1"
            >
              ✕
            </button>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); onToggleStage(); }}
            title={staged ? "Unstage" : "Stage"}
            className="text-xs text-text-secondary hover:text-text-primary px-1"
          >
            {staged ? "−" : "+"}
          </button>
        </div>
      </div>
    </div>
  );
}
