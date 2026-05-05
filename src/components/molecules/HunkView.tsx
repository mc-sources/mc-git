import { useTranslation } from "react-i18next";
import type { DiffHunk, DiffLine } from "../../domain/entities";
import { DiffLineRow } from "./DiffLineRow";
import { computeWordDiff, type TextSpan } from "../../utils/wordDiff";
import type { TokenSpan } from "../../utils/highlight";

interface Props {
  hunk: DiffHunk;
  hunkIndex: number;
  interactive?: boolean;
  staged?: boolean;
  selectedLines?: Set<number>;
  onStageHunk?: (hunkIndex: number) => void;
  onLineToggle?: (hunkIndex: number, lineIndex: number) => void;
  tokenLines?: TokenSpan[][];
}

/** Pre-compute word diff spans for all adjacent -/+ pairs in a hunk. */
function computeHunkWordDiffs(lines: DiffLine[]): Map<number, TextSpan[]> {
  const spans = new Map<number, TextSpan[]>();
  let i = 0;
  while (i < lines.length) {
    if (lines[i].origin === "-") {
      // Collect a run of removed lines followed by a run of added lines
      const removeStart = i;
      while (i < lines.length && lines[i].origin === "-") i++;
      const addStart = i;
      while (i < lines.length && lines[i].origin === "+") i++;
      const addEnd = i;

      const removeCount = addStart - removeStart;
      const addCount = addEnd - addStart;
      const pairCount = Math.min(removeCount, addCount);

      for (let p = 0; p < pairCount; p++) {
        const oldContent = lines[removeStart + p].content.replace(/\n$/, "");
        const newContent = lines[addStart + p].content.replace(/\n$/, "");
        const { oldSpans, newSpans } = computeWordDiff(oldContent, newContent);
        spans.set(removeStart + p, oldSpans);
        spans.set(addStart + p, newSpans);
      }
    } else {
      i++;
    }
  }
  return spans;
}

export function HunkView({
  hunk,
  hunkIndex,
  interactive,
  staged,
  selectedLines,
  onStageHunk,
  onLineToggle,
  tokenLines,
}: Props) {
  const { t } = useTranslation();
  const hasChangedLines = hunk.lines.some((l) => l.origin === "+" || l.origin === "-");
  const stageLabel = staged ? t("diff.unstageHunk") : t("diff.stageHunk");
  const wordDiffSpans = computeHunkWordDiffs(hunk.lines);

  return (
    <>
      <tr className="bg-surface-elevated border-y border-surface-border">
        <td colSpan={4} className="px-3 py-0.5 text-xs text-blue-400 font-mono">
          <div className="flex items-center justify-between gap-2">
            <span>{hunk.header.trim()}</span>
            {interactive && hasChangedLines && (
              <button
                onClick={() => onStageHunk?.(hunkIndex)}
                className="shrink-0 text-[10px] px-1.5 py-0.5 rounded border border-blue-500/40 text-blue-400 hover:bg-blue-500/10 transition-colors"
              >
                {stageLabel}
              </button>
            )}
          </div>
        </td>
      </tr>
      {hunk.lines.map((line, i) => (
        <DiffLineRow
          key={i}
          line={line}
          interactive={interactive}
          lineIndex={i}
          isSelected={selectedLines?.has(i) ?? false}
          onToggle={(lineIndex) => onLineToggle?.(hunkIndex, lineIndex)}
          wordSpans={tokenLines ? undefined : wordDiffSpans.get(i)}
          tokenLine={tokenLines?.[i]}
        />
      ))}
    </>
  );
}
