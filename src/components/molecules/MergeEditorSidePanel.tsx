import type React from "react";
import { useTranslation } from "react-i18next";
import type { Resolution, Segment, ConflictSegment } from "../../domain/value-objects/ConflictParseResult";

interface Props {
  side: "ours" | "theirs";
  segments: Segment[];
  resolutions: Map<number, Resolution>;
  activeConflict: number | null;
  scrollRef: React.RefObject<HTMLDivElement | null>;
  onScroll: () => void;
  onResolve: (index: number, resolution: Resolution) => void;
}

export function MergeEditorSidePanel({
  side,
  segments,
  resolutions,
  activeConflict,
  scrollRef,
  onScroll,
  onResolve,
}: Props) {
  const { t } = useTranslation();
  const isOurs = side === "ours";
  const panelTitle = isOurs ? t("mergePanel.ours") : t("mergePanel.theirs");
  const hdrBorder = isOurs ? "border-green-500/30" : "border-blue-500/30";
  const hdrBg = isOurs ? "bg-green-900/10" : "bg-blue-900/10";
  const hdrText = isOurs ? "text-green-700 dark:text-green-400" : "text-blue-700 dark:text-blue-400";
  const blockBg = isOurs ? "bg-green-900/15" : "bg-blue-900/15";
  const blockBorder = isOurs ? "border-green-500/25" : "border-blue-500/25";
  const acceptedBtn = isOurs
    ? "bg-green-600/30 border-green-500/60 text-green-700 dark:text-green-300"
    : "bg-blue-600/30 border-blue-500/60 text-blue-700 dark:text-blue-300";
  const defaultBtn = isOurs
    ? "border-surface-border text-green-700/70 hover:text-green-700 dark:text-green-400/70 dark:hover:text-green-300 hover:border-green-500/40"
    : "border-surface-border text-blue-700/70 hover:text-blue-700 dark:text-blue-400/70 dark:hover:text-blue-300 hover:border-blue-500/40";

  return (
    <div className="flex flex-col flex-1 overflow-hidden min-w-0 border-r border-surface-border last:border-r-0">
      {/* Column header */}
      <div className={`shrink-0 px-3 py-1.5 border-b ${hdrBorder} ${hdrBg}`}>
        <span className={`text-[10px] font-semibold uppercase tracking-wide ${hdrText}`}>
          {panelTitle}
        </span>
      </div>

      {/* Content */}
      <div ref={scrollRef} onScroll={onScroll} className="flex-1 overflow-auto font-mono text-xs leading-5">
        {segments.map((seg, si) => {
          if (seg.type === "normal") {
            return (
              <div key={si}>
                {seg.lines.map((line, li) => (
                  <div key={li} className="px-3 text-text-secondary whitespace-pre">
                    {line}
                  </div>
                ))}
              </div>
            );
          }

          const cs = seg as ConflictSegment;
          const lines = isOurs ? cs.ours : cs.theirs;
          const label = isOurs ? cs.oursLabel : cs.theirsLabel;
          const res = resolutions.get(cs.index);
          const sideRes = isOurs ? "ours" : "theirs";
          const isAccepted = res === sideRes || res === "both";
          const isBoth = res === "both";
          const isActive = activeConflict === cs.index;

          return (
            <div
              key={si}
              className={`border-y ${blockBorder} my-px ${
                isActive ? "ring-1 ring-inset ring-orange-500/50" : ""
              }`}
            >
              {/* Branch label */}
              <div className={`px-3 py-0.5 ${blockBg} ${hdrText} text-[10px] font-semibold truncate`}>
                {label || (isOurs ? "HEAD" : t("mergePanel.incomingLabel"))}
              </div>

              {/* Lines */}
              {lines.length === 0 ? (
                <div className={`px-3 py-1 ${blockBg} text-text-muted italic`}>{t("mergePanel.empty")}</div>
              ) : (
                lines.map((line, li) => (
                  <div key={li} className={`px-3 ${blockBg} text-text-primary whitespace-pre`}>
                    {line}
                  </div>
                ))
              )}

              {/* Action buttons */}
              <div className={`flex items-center gap-1.5 px-3 py-1.5 ${hdrBg} border-t ${blockBorder}`}>
                <button
                  onClick={() => onResolve(cs.index, sideRes)}
                  className={`text-[10px] px-2 py-0.5 rounded border transition-colors ${
                    isAccepted && !isBoth ? acceptedBtn : defaultBtn
                  }`}
                >
                  {isAccepted && !isBoth ? t("mergePanel.accepted") : t("mergePanel.accept")}
                </button>
                <button
                  onClick={() => onResolve(cs.index, "both")}
                  className={`text-[10px] px-2 py-0.5 rounded border transition-colors ${
                    isBoth
                      ? "bg-purple-600/30 border-purple-500/60 text-purple-300"
                      : "border-surface-border text-text-muted hover:text-purple-300 hover:border-purple-500/40"
                  }`}
                >
                  {isBoth ? t("mergePanel.bothAccepted") : t("mergePanel.both")}
                </button>
                {res !== undefined && (
                  <button
                    onClick={() => onResolve(cs.index, sideRes)}
                    className="ml-auto text-[10px] text-text-muted hover:text-text-secondary"
                    title={t("mergePanel.reset")}
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
