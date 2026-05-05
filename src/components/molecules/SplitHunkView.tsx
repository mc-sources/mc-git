import type { DiffHunk, DiffLine } from "../../domain/entities";
import { computeWordDiff, type TextSpan } from "../../utils/wordDiff";

interface Props {
  hunk: DiffHunk;
}

interface SplitRow {
  left: DiffLine | null;
  right: DiffLine | null;
  leftSpans?: TextSpan[];
  rightSpans?: TextSpan[];
}

/** Build aligned split rows from a flat list of diff lines. */
function buildSplitRows(lines: DiffLine[]): SplitRow[] {
  const rows: SplitRow[] = [];
  let i = 0;

  while (i < lines.length) {
    if (lines[i].origin === " ") {
      // Context line: appears on both sides
      rows.push({ left: lines[i], right: lines[i] });
      i++;
    } else if (lines[i].origin === "-") {
      // Collect a run of removes followed by a run of adds
      const removeStart = i;
      while (i < lines.length && lines[i].origin === "-") i++;
      const addStart = i;
      while (i < lines.length && lines[i].origin === "+") i++;
      const addEnd = i;

      const removes = lines.slice(removeStart, addStart);
      const adds = lines.slice(addStart, addEnd);
      const pairCount = Math.max(removes.length, adds.length);

      for (let p = 0; p < pairCount; p++) {
        const left = removes[p] ?? null;
        const right = adds[p] ?? null;

        let leftSpans: TextSpan[] | undefined;
        let rightSpans: TextSpan[] | undefined;

        if (left && right) {
          const { oldSpans, newSpans } = computeWordDiff(
            left.content.replace(/\n$/, ""),
            right.content.replace(/\n$/, "")
          );
          leftSpans = oldSpans;
          rightSpans = newSpans;
        }

        rows.push({ left, right, leftSpans, rightSpans });
      }
    } else {
      // "+" without preceding "-" (addition block without matching removals)
      rows.push({ left: null, right: lines[i] });
      i++;
    }
  }

  return rows;
}

function SplitCell({
  line,
  spans,
  side,
}: {
  line: DiffLine | null;
  spans?: TextSpan[];
  side: "left" | "right";
}) {
  if (!line) {
    return (
      <>
        <td className="select-none text-right px-2 w-10 text-text-muted border-r border-surface-border bg-surface-elevated" />
        <td className="select-none px-1 w-4 border-r border-surface-border bg-surface-elevated" />
        <td className="px-2 whitespace-pre bg-surface-elevated border-r border-surface-border" />
      </>
    );
  }

  const isChanged = line.origin === "+" || line.origin === "-";
  const bg = isChanged
    ? line.origin === "+"
      ? "bg-green-950 text-green-300"
      : "bg-red-950 text-red-300"
    : "text-text-secondary";
  const highlight = line.origin === "+" ? "bg-green-700/70" : "bg-red-700/70";
  const prefix = line.origin === "+" ? "+" : line.origin === "-" ? "-" : " ";
  const lineno = side === "left" ? (line.oldLineno ?? "") : (line.newLineno ?? "");
  const content = line.content.replace(/\n$/, "");
  const borderRight = "border-r border-surface-border";

  return (
    <>
      <td className={`select-none text-right px-2 w-10 text-text-muted ${borderRight} ${bg}`}>
        {lineno}
      </td>
      <td className={`select-none px-1 w-4 text-center ${borderRight} ${bg}`}>
        <span>{prefix}</span>
      </td>
      <td className={`px-2 whitespace-pre ${bg} ${borderRight}`}>
        {spans ? (
          spans.map((span, i) =>
            span.changed ? (
              <span key={i} className={highlight}>{span.text}</span>
            ) : (
              <span key={i}>{span.text}</span>
            )
          )
        ) : (
          content
        )}
      </td>
    </>
  );
}

export function SplitHunkView({ hunk }: Props) {
  const rows = buildSplitRows(hunk.lines);

  return (
    <>
      <tr className="bg-surface-elevated border-y border-surface-border">
        <td colSpan={6} className="px-3 py-0.5 text-xs text-blue-400 font-mono">
          {hunk.header.trim()}
        </td>
      </tr>
      {rows.map((row, i) => (
        <tr key={i} className="font-mono text-xs">
          <SplitCell line={row.left} spans={row.leftSpans} side="left" />
          <SplitCell line={row.right} spans={row.rightSpans} side="right" />
        </tr>
      ))}
    </>
  );
}
