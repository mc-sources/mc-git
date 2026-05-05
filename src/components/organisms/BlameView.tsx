import { useEffect, useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useUiStore } from "../../store/uiStore";
import { useGitRepository } from "../../infrastructure/GitRepositoryContext";
import { getBlameUseCase } from "../../usecases/blame";
import { toast } from "../../store/toastStore";
import type { BlameLine } from "../../domain/entities";
import { useHighlight } from "../../hooks/useHighlight";

function formatDate(timestamp: number): string {
  return new Date(timestamp * 1000).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function BlameView() {
  const { t } = useTranslation();
  const { blameTarget, setBlameTarget, setActiveView } = useUiStore();
  const repo = useGitRepository();
  const [lines, setLines] = useState<BlameLine[]>([]);
  const [loading, setLoading] = useState(false);

  const codeLines = useMemo(() => lines.map((l) => l.content.replace(/\n$/, "")), [lines]);
  const tokens = useHighlight(codeLines, blameTarget?.path ?? "");

  useEffect(() => {
    if (!blameTarget) return;
    setLoading(true);
    getBlameUseCase(repo, blameTarget.path, blameTarget.commitOid ?? undefined)
      .then(setLines)
      .catch((e) => toast.error(String(e)))
      .finally(() => setLoading(false));
  }, [repo, blameTarget]);

  // Group consecutive lines with same commit
  const groups = useMemo(() => {
    const result: { oid: string; shortOid: string; authorName: string; date: string; startLine: number; lines: BlameLine[] }[] = [];
    for (const line of lines) {
      const last = result[result.length - 1];
      if (last && last.oid === line.commitOid) {
        last.lines.push(line);
      } else {
        result.push({
          oid: line.commitOid,
          shortOid: line.shortOid,
          authorName: line.authorName,
          date: formatDate(line.timestamp),
          startLine: line.lineNo,
          lines: [line],
        });
      }
    }
    return result;
  }, [lines]);

  const handleBack = () => {
    setBlameTarget(null);
    setActiveView("history");
  };

  if (!blameTarget) return null;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-2 border-b border-surface-border shrink-0">
        <button
          onClick={handleBack}
          className="text-xs px-2 py-1 text-text-muted hover:text-text-primary transition-colors"
        >
          {t("common.back")}
        </button>
        <span className="text-sm font-mono text-text-primary truncate flex-1">
          {blameTarget.path}
        </span>
        {blameTarget.commitOid && (
          <span className="text-xs font-mono text-text-muted">{blameTarget.commitOid.slice(0, 7)}</span>
        )}
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center text-text-muted text-sm">
          {t("common.loading")}
        </div>
      ) : (
        <div className="flex-1 overflow-auto">
          <table className="w-full text-xs font-mono border-collapse">
            <tbody>
              {groups.map((group) =>
                group.lines.map((line, i) => (
                  <tr
                    key={line.lineNo}
                    className="hover:bg-surface-overlay group"
                  >
                    {/* Commit info — shown only on first line of group */}
                    <td className="w-[200px] align-top px-3 py-0 border-r border-surface-border select-none whitespace-nowrap">
                      {i === 0 ? (
                        <div className="flex flex-col py-0.5">
                          <span className="text-blue-400">{group.shortOid}</span>
                          <span className="text-text-secondary truncate max-w-[160px]">{group.authorName}</span>
                          <span className="text-text-muted">{group.date}</span>
                        </div>
                      ) : null}
                    </td>
                    {/* Line number */}
                    <td className="w-12 text-right pr-3 py-0.5 text-text-muted select-none">
                      {line.lineNo}
                    </td>
                    {/* Code */}
                    <td className="pl-3 py-0.5 text-text-primary whitespace-pre">
                      {tokens?.[line.lineNo - 1]
                        ? tokens[line.lineNo - 1].map((tok, ti) => (
                            <span key={ti} style={{ color: tok.color }}>{tok.content}</span>
                          ))
                        : line.content.replace(/\n$/, "")}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
