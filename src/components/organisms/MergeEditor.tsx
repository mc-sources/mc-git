import { useCallback, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useGitRepository } from "../../infrastructure/GitRepositoryContext";
import {
  applyResolutionToMerged,
  buildInitialMergedContent,
  conflictPlaceholder,
  parseThreeWayConflict,
} from "../../usecases/conflicts";
import { writeAndStageFileUseCase } from "../../usecases/staging";
import { toast } from "../../store/toastStore";
import type { FileDiff } from "../../domain/entities";
import type { ConflictSegment, Resolution } from "../../domain/value-objects/ConflictParseResult";
import { MergeEditorSidePanel } from "../molecules/MergeEditorSidePanel";
import { MergeEditorResultPanel } from "../molecules/MergeEditorResultPanel";

interface Props {
  filePath: string;
  diff: FileDiff;
  onResolved: () => void;
}

export function MergeEditor({ filePath, diff, onResolved }: Props) {
  const { t } = useTranslation();
  const repo = useGitRepository();
  const result = useMemo(() => parseThreeWayConflict(diff), [diff]);

  const [resolutions, setResolutions] = useState<Map<number, Resolution>>(() => new Map());
  const [mergedContent, setMergedContent] = useState(() =>
    buildInitialMergedContent(result.segments)
  );
  const [activeConflict, setActiveConflict] = useState<number | null>(
    result.conflictCount > 0 ? 0 : null
  );
  const [applying, setApplying] = useState(false);

  // Scroll synchronization between ours/theirs panels
  const oursScrollRef = useRef<HTMLDivElement>(null);
  const theirsScrollRef = useRef<HTMLDivElement>(null);
  const isSyncing = useRef(false);

  const handleOursScroll = useCallback(() => {
    if (isSyncing.current) return;
    isSyncing.current = true;
    if (theirsScrollRef.current && oursScrollRef.current) {
      theirsScrollRef.current.scrollTop = oursScrollRef.current.scrollTop;
    }
    requestAnimationFrame(() => {
      isSyncing.current = false;
    });
  }, []);

  const handleTheirsScroll = useCallback(() => {
    if (isSyncing.current) return;
    isSyncing.current = true;
    if (oursScrollRef.current && theirsScrollRef.current) {
      oursScrollRef.current.scrollTop = theirsScrollRef.current.scrollTop;
    }
    requestAnimationFrame(() => {
      isSyncing.current = false;
    });
  }, []);

  const handleResolve = useCallback(
    (index: number, resolution: Resolution) => {
      const segment = result.segments.find(
        (s): s is ConflictSegment => s.type === "conflict" && s.index === index
      );
      if (!segment) return;

      const nextResolutions = new Map(resolutions);
      nextResolutions.set(index, resolution);
      setResolutions(nextResolutions);

      // Recompute from the initial placeholder state so changing a resolution
      // always replaces the previous one (placeholder may already be gone).
      const base = buildInitialMergedContent(result.segments);
      const newContent = Array.from(nextResolutions.entries()).reduce(
        (content, [conflictIdx, res]) => {
          const seg = result.segments.find(
            (s): s is ConflictSegment => s.type === "conflict" && s.index === conflictIdx
          );
          return seg ? applyResolutionToMerged(content, conflictIdx, res, seg) : content;
        },
        base
      );
      setMergedContent(newContent);

      // Advance active conflict to next unresolved one
      const conflicts = result.segments.filter(
        (s): s is ConflictSegment => s.type === "conflict"
      );
      const nextUnresolved = conflicts.find(
        (s) => s.index > index && !nextResolutions.has(s.index)
      );
      if (nextUnresolved) setActiveConflict(nextUnresolved.index);
    },
    [result.segments, resolutions]
  );

  const handleNavigate = (direction: "prev" | "next") => {
    const conflicts = result.segments.filter(
      (s): s is ConflictSegment => s.type === "conflict"
    );
    if (conflicts.length === 0) return;
    const currentIdx = conflicts.findIndex((s) => s.index === activeConflict);
    const clamp = (v: number) => Math.max(0, Math.min(conflicts.length - 1, v));
    setActiveConflict(conflicts[clamp(direction === "prev" ? currentIdx - 1 : currentIdx + 1)].index);
  };

  const handleApply = async () => {
    setApplying(true);
    try {
      await writeAndStageFileUseCase(repo, filePath, mergedContent);
      toast.success(t("conflict.fileStagedResolved", { path: filePath }));
      onResolved();
    } catch (e) {
      toast.error(String(e));
    } finally {
      setApplying(false);
    }
  };

  // Conflicts whose placeholder is still present in the textarea
  const pendingConflicts = result.segments
    .filter((s): s is ConflictSegment => s.type === "conflict")
    .filter((s) => mergedContent.includes(conflictPlaceholder(s.index)));

  const resolvedCount = result.conflictCount - pendingConflicts.length;
  const allResolved = pendingConflicts.length === 0;

  return (
    <div className="flex flex-col h-full overflow-hidden bg-surface-base">
      {/* ── Header ────────────────────────────────────────────────────── */}
      <div className="shrink-0 px-3 py-2 border-b border-surface-border bg-surface-elevated flex items-center gap-2">
        <span className="text-xs font-mono text-text-primary truncate min-w-0">{filePath}</span>

        <div className="flex items-center gap-2 shrink-0 ml-auto">
          {/* Conflict counter */}
          <span
            className={`text-xs tabular-nums ${
              allResolved ? "text-green-400" : "text-orange-400"
            }`}
          >
            {t("conflict.resolved", { resolved: resolvedCount, count: result.conflictCount })}
          </span>

          {/* Navigation prev/next */}
          {result.conflictCount > 1 && (
            <div className="flex items-center">
              <button
                onClick={() => handleNavigate("prev")}
                className="text-[10px] px-1.5 py-0.5 text-text-muted hover:text-text-primary border border-surface-border rounded-l transition-colors"
                title={t("conflict.prevConflict")}
              >
                ▲
              </button>
              <button
                onClick={() => handleNavigate("next")}
                className="text-[10px] px-1.5 py-0.5 text-text-muted hover:text-text-primary border-y border-r border-surface-border rounded-r transition-colors"
                title={t("conflict.nextConflict")}
              >
                ▼
              </button>
            </div>
          )}

          {/* Apply */}
          <button
            onClick={handleApply}
            disabled={!allResolved || applying}
            className="text-xs px-3 py-1 bg-green-700 hover:bg-green-600 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded transition-colors"
          >
            {applying ? "…" : t("common.apply")}
          </button>
        </div>
      </div>

      {/* ── Main area ─────────────────────────────────────────────────── */}
      <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
        {/* Top 60%: ours + theirs side by side */}
        <div className="flex overflow-hidden" style={{ flex: "3 3 0", minHeight: 0 }}>
          <MergeEditorSidePanel
            side="ours"
            segments={result.segments}
            resolutions={resolutions}
            activeConflict={activeConflict}
            scrollRef={oursScrollRef}
            onScroll={handleOursScroll}
            onResolve={handleResolve}
          />
          <MergeEditorSidePanel
            side="theirs"
            segments={result.segments}
            resolutions={resolutions}
            activeConflict={activeConflict}
            scrollRef={theirsScrollRef}
            onScroll={handleTheirsScroll}
            onResolve={handleResolve}
          />
        </div>

        {/* Divider */}
        <div className="shrink-0 h-px bg-surface-border" />

        {/* Bottom 40%: editable result */}
        <div className="overflow-hidden border-t border-surface-border" style={{ flex: "2 2 0", minHeight: 0 }}>
          <MergeEditorResultPanel
            content={mergedContent}
            pendingCount={pendingConflicts.length}
            onChange={setMergedContent}
          />
        </div>
      </div>
    </div>
  );
}
