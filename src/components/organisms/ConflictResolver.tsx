import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useGitRepository } from "../../infrastructure/GitRepositoryContext";
import { writeAndStageFileUseCase } from "../../usecases/staging";
import { toast } from "../../store/toastStore";
import type { FileDiff } from "../../domain/entities";

// ─── Block types ─────────────────────────────────────────────────────────────

interface NormalBlock {
  type: "normal";
  lines: string[];
}

interface ConflictBlock {
  type: "conflict";
  markerOurs: string;
  ours: string[];
  markerTheirs: string;
  theirs: string[];
}

type Block = NormalBlock | ConflictBlock;
type Resolution = "ours" | "theirs" | "both" | null;

// ─── Parser ───────────────────────────────────────────────────────────────────

function parseConflictBlocks(diff: FileDiff): Block[] {
  const raw = diff.hunks.flatMap((h) => h.lines.map((l) => l.content));
  const blocks: Block[] = [];
  let normalLines: string[] = [];
  let i = 0;

  while (i < raw.length) {
    const line = raw[i];
    if (line.startsWith("<<<<<<<")) {
      if (normalLines.length > 0) {
        blocks.push({ type: "normal", lines: normalLines });
        normalLines = [];
      }
      const markerOurs = line;
      const ours: string[] = [];
      i++;
      while (i < raw.length && !raw[i].startsWith("=======")) {
        ours.push(raw[i]);
        i++;
      }
      i++; // skip =======
      const theirs: string[] = [];
      while (i < raw.length && !raw[i].startsWith(">>>>>>>")) {
        theirs.push(raw[i]);
        i++;
      }
      const markerTheirs = raw[i] ?? ">>>>>>>";
      i++; // skip >>>>>>>
      blocks.push({ type: "conflict", markerOurs, ours, markerTheirs, theirs });
    } else {
      normalLines.push(line);
      i++;
    }
  }

  if (normalLines.length > 0) {
    blocks.push({ type: "normal", lines: normalLines });
  }

  return blocks;
}

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  filePath: string;
  diff: FileDiff;
  onResolved: () => void;
}

export function ConflictResolver({ filePath, diff, onResolved }: Props) {
  const { t } = useTranslation();
  const repo = useGitRepository();
  const blocks = useMemo(() => parseConflictBlocks(diff), [diff]);

  const conflictIndices = blocks
    .map((b, i) => (b.type === "conflict" ? i : -1))
    .filter((i) => i >= 0);
  const conflictCount = conflictIndices.length;

  const [resolutions, setResolutions] = useState<Resolution[]>(() =>
    conflictIndices.map(() => null)
  );
  const [applying, setApplying] = useState(false);

  const resolvedCount = resolutions.filter((r) => r !== null).length;
  const allResolved = resolvedCount === conflictCount;

  const setResolution = (idx: number, res: Resolution) =>
    setResolutions((prev) => {
      const next = [...prev];
      next[idx] = res;
      return next;
    });

  const handleApply = async () => {
    setApplying(true);
    try {
      const lines: string[] = [];
      let ci = 0;
      for (const block of blocks) {
        if (block.type === "normal") {
          lines.push(...block.lines);
        } else {
          const res = resolutions[ci++];
          if (res === "ours" || res === "both") lines.push(...block.ours);
          if (res === "theirs" || res === "both") lines.push(...block.theirs);
        }
      }
      // Lines from git2 already include trailing \n
      const content = lines.join("");
      await writeAndStageFileUseCase(repo, filePath, content);
      toast.success(t("conflict.fileStagedResolved", { path: filePath }));
      onResolved();
    } catch (e) {
      toast.error(String(e));
    } finally {
      setApplying(false);
    }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden bg-surface-base">
      {/* Header */}
      <div className="shrink-0 px-3 py-2 border-b border-surface-border bg-surface-elevated flex items-center justify-between gap-3">
        <span className="text-xs font-mono text-text-primary truncate">{filePath}</span>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs text-orange-400">
            {t("conflict.resolved", { resolved: resolvedCount, count: conflictCount })}
          </span>
          <button
            onClick={handleApply}
            disabled={!allResolved || applying}
            className="text-xs px-3 py-1 bg-green-700 hover:bg-green-600 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded transition-colors"
          >
            {applying ? "…" : t("common.apply")}
          </button>
        </div>
      </div>

      {/* Blocks */}
      <div className="flex-1 overflow-auto font-mono text-xs leading-5">
        {blocks.map((block, blockIdx) => {
          if (block.type === "normal") {
            return (
              <div key={blockIdx}>
                {block.lines.map((line, li) => (
                  <div key={li} className="px-4 text-text-secondary whitespace-pre">
                    {line}
                  </div>
                ))}
              </div>
            );
          }

          const ci = conflictIndices.indexOf(blockIdx);
          const res = resolutions[ci];

          return (
            <div key={blockIdx} className="border-y border-orange-500/40 my-1">
              {/* <<<<<<< */}
              <div className="px-4 py-0.5 bg-red-900/40 text-red-300 font-semibold whitespace-pre">
                {block.markerOurs}
              </div>
              {/* Ours */}
              <div className={res === "theirs" ? "opacity-30" : undefined}>
                {block.ours.map((line, li) => (
                  <div key={li} className="px-4 bg-green-900/20 text-green-200 whitespace-pre">
                    {line}
                  </div>
                ))}
              </div>
              {/* ======= */}
              <div className="px-4 py-0.5 bg-surface-overlay text-text-muted font-semibold">
                =======
              </div>
              {/* Theirs */}
              <div className={res === "ours" ? "opacity-30" : undefined}>
                {block.theirs.map((line, li) => (
                  <div key={li} className="px-4 bg-blue-900/20 text-blue-200 whitespace-pre">
                    {line}
                  </div>
                ))}
              </div>
              {/* >>>>>>> */}
              <div className="px-4 py-0.5 bg-blue-900/40 text-blue-700 dark:text-blue-300 font-semibold whitespace-pre">
                {block.markerTheirs}
              </div>
              {/* Resolution buttons */}
              <div className="flex items-center gap-2 px-4 py-2 bg-surface-elevated border-t border-surface-border">
                <button
                  onClick={() => setResolution(ci, "ours")}
                  className={`text-[10px] px-2 py-1 rounded border transition-colors ${
                    res === "ours"
                      ? "bg-green-600/30 border-green-500/60 text-green-700 dark:text-green-300"
                      : "border-surface-border text-text-secondary hover:text-green-700 dark:hover:text-green-300 hover:border-green-500/40"
                  }`}
                >
                  {t("conflict.keepOurs")}
                </button>
                <button
                  onClick={() => setResolution(ci, "theirs")}
                  className={`text-[10px] px-2 py-1 rounded border transition-colors ${
                    res === "theirs"
                      ? "bg-blue-600/30 border-blue-500/60 text-blue-700 dark:text-blue-300"
                      : "border-surface-border text-text-secondary hover:text-blue-700 dark:hover:text-blue-300 hover:border-blue-500/40"
                  }`}
                >
                  {t("conflict.keepTheirs")}
                </button>
                <button
                  onClick={() => setResolution(ci, "both")}
                  className={`text-[10px] px-2 py-1 rounded border transition-colors ${
                    res === "both"
                      ? "bg-purple-600/30 border-purple-500/60 text-purple-300"
                      : "border-surface-border text-text-secondary hover:text-purple-300 hover:border-purple-500/40"
                  }`}
                >
                  {t("conflict.keepBoth")}
                </button>
                {res !== null && (
                  <button
                    onClick={() => setResolution(ci, null)}
                    className="text-[10px] px-2 py-1 text-text-muted hover:text-text-secondary ml-auto"
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
