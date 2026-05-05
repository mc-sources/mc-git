import { useMemo } from "react";
import type { DiffHunk } from "../../domain/entities";
import { useHighlight } from "../../hooks/useHighlight";

export function MiniDiff({ hunks, filename }: { hunks: DiffHunk[]; filename?: string }) {
  // Collect all lines for batch highlighting
  const allLines = useMemo(
    () => hunks.flatMap((h) => h.lines.map((l) => l.content.replace(/\n$/, ""))),
    [hunks],
  );
  const allTokens = useHighlight(allLines, filename ?? "");

  // Distribute tokens back per hunk by cumulative offset
  const hunkTokenSlices = useMemo(() => {
    if (!allTokens) return null;
    const slices: typeof allTokens[] = [];
    let offset = 0;
    for (const hunk of hunks) {
      slices.push(allTokens.slice(offset, offset + hunk.lines.length));
      offset += hunk.lines.length;
    }
    return slices;
  }, [allTokens, hunks]);

  return (
    <div className="overflow-auto max-h-64 bg-surface-base rounded border border-surface-border mt-2 text-xs font-mono">
      <table className="w-full border-collapse">
        <tbody>
          {hunks.map((hunk, hi) => (
            <>
              <tr key={`h${hi}`} className="bg-surface-elevated">
                <td colSpan={3} className="px-2 py-0.5 text-blue-400">
                  {hunk.header.trim()}
                </td>
              </tr>
              {hunk.lines.map((line, li) => {
                const bg =
                  line.origin === "+"
                    ? "bg-green-950"
                    : line.origin === "-"
                    ? "bg-red-950"
                    : "";
                const tokenLine = hunkTokenSlices?.[hi]?.[li];
                const defaultColor =
                  line.origin === "+" ? "#86efac" : line.origin === "-" ? "#fca5a5" : undefined;
                return (
                  <tr key={`${hi}-${li}`} className={bg}>
                    <td className="w-4 px-2 select-none text-text-muted">{line.origin}</td>
                    <td className="px-2 whitespace-pre">
                      {tokenLine ? (
                        tokenLine.map((tok, ti) => (
                          <span key={ti} style={{ color: tok.color }}>{tok.content}</span>
                        ))
                      ) : (
                        <span style={defaultColor ? { color: defaultColor } : undefined}>
                          {line.content.replace(/\n$/, "")}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </>
          ))}
        </tbody>
      </table>
    </div>
  );
}
