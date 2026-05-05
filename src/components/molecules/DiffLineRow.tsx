import type { DiffLine } from "../../domain/entities";
import type { TextSpan } from "../../utils/wordDiff";
import type { TokenSpan } from "../../utils/highlight";

function conflictStyle(content: string): string | null {
  if (content.startsWith("<<<<<<<")) return "bg-red-900/60 text-red-300 font-semibold";
  if (content.startsWith("=======")) return "bg-surface-overlay text-text-muted font-semibold";
  if (content.startsWith(">>>>>>>")) return "bg-blue-900/60 text-blue-300 font-semibold";
  return null;
}

interface Props {
  line: DiffLine;
  interactive?: boolean;
  lineIndex?: number;
  isSelected?: boolean;
  onToggle?: (lineIndex: number) => void;
  wordSpans?: TextSpan[];
  tokenLine?: TokenSpan[];
}

export function DiffLineRow({ line, interactive, lineIndex, isSelected, onToggle, wordSpans, tokenLine }: Props) {
  const conflict = conflictStyle(line.content);
  const isChangedLine = line.origin === "+" || line.origin === "-";
  const showCheckbox = interactive && !conflict && isChangedLine;

  const bg = conflict ?? (
    line.origin === "+"
      ? isSelected ? "bg-green-800 text-green-200" : "bg-green-950 text-green-300"
      : line.origin === "-"
      ? isSelected ? "bg-red-800 text-red-200" : "bg-red-950 text-red-300"
      : "text-text-secondary"
  );

  const prefix = line.origin === "+" ? "+" : line.origin === "-" ? "-" : " ";

  const highlightBg = line.origin === "+" ? "bg-green-700/70" : "bg-red-700/70";

  const content = line.content.replace(/\n$/, "");

  return (
    <tr
      className={`${bg} font-mono text-xs ${showCheckbox ? "cursor-pointer" : ""}`}
      onClick={showCheckbox ? () => onToggle?.(lineIndex!) : undefined}
    >
      <td className="select-none text-right px-2 w-10 text-text-muted border-r border-surface-border">
        {line.oldLineno ?? ""}
      </td>
      <td className="select-none text-right px-2 w-10 text-text-muted border-r border-surface-border">
        {line.newLineno ?? ""}
      </td>
      <td className="select-none px-1 w-6 text-center">
        {showCheckbox ? (
          <input
            type="checkbox"
            checked={isSelected ?? false}
            onChange={() => onToggle?.(lineIndex!)}
            onClick={(e) => e.stopPropagation()}
            className="w-3 h-3 accent-blue-500 cursor-pointer"
          />
        ) : (
          <span>{conflict ? " " : prefix}</span>
        )}
      </td>
      <td className="px-2 whitespace-pre">
        {tokenLine && !conflict ? (
          tokenLine.map((tok, i) => (
            <span key={i} style={{ color: tok.color }}>{tok.content}</span>
          ))
        ) : wordSpans && !conflict ? (
          wordSpans.map((span, i) =>
            span.changed ? (
              <span key={i} className={highlightBg}>{span.text}</span>
            ) : (
              <span key={i}>{span.text}</span>
            )
          )
        ) : (
          content
        )}
      </td>
    </tr>
  );
}
