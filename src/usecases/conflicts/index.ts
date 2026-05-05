import type { FileDiff } from "../../domain/entities";
import type {
  ConflictParseResult,
  ConflictSegment,
  Resolution,
  Segment,
} from "../../domain/value-objects/ConflictParseResult";

/**
 * Placeholder inserted into the merged content for each unresolved conflict.
 * Uses guillemets + unique tag — cannot appear in normal source code.
 */
export const conflictPlaceholder = (i: number) => `«CONFLIT:${i}»\n`;

export function parseThreeWayConflict(diff: FileDiff): ConflictParseResult {
  const raw = diff.hunks.flatMap((h) => h.lines.map((l) => l.content));
  const segments: Segment[] = [];
  let normalLines: string[] = [];
  let conflictIndex = 0;
  let i = 0;

  while (i < raw.length) {
    const line = raw[i];

    if (line.startsWith("<<<<<<<")) {
      if (normalLines.length > 0) {
        segments.push({ type: "normal", lines: normalLines });
        normalLines = [];
      }

      const oursLabel = line.replace(/^<{7}\s*/, "").trimEnd();
      const ours: string[] = [];
      i++;

      // Collect ours lines (stop at ======= or ||||||| for diff3 style)
      while (i < raw.length && !raw[i].startsWith("=======") && !raw[i].startsWith("|||||||")) {
        ours.push(raw[i]);
        i++;
      }

      // Skip diff3-style base section (||||||| … =======)
      if (i < raw.length && raw[i].startsWith("|||||||")) {
        i++;
        while (i < raw.length && !raw[i].startsWith("=======")) i++;
      }

      i++; // skip =======

      const theirs: string[] = [];
      while (i < raw.length && !raw[i].startsWith(">>>>>>>")) {
        theirs.push(raw[i]);
        i++;
      }

      const theirsLabel = (raw[i] ?? ">>>>>>>").replace(/^>{7}\s*/, "").trimEnd();
      i++; // skip >>>>>>>

      segments.push({
        type: "conflict",
        index: conflictIndex++,
        oursLabel,
        theirsLabel,
        ours,
        theirs,
      });
    } else {
      normalLines.push(line);
      i++;
    }
  }

  if (normalLines.length > 0) {
    segments.push({ type: "normal", lines: normalLines });
  }

  // Build side views (no conflict markers)
  const oursLines: string[] = [];
  const theirsLines: string[] = [];
  for (const seg of segments) {
    if (seg.type === "normal") {
      oursLines.push(...seg.lines);
      theirsLines.push(...seg.lines);
    } else {
      oursLines.push(...seg.ours);
      theirsLines.push(...seg.theirs);
    }
  }

  return { segments, conflictCount: conflictIndex, oursLines, theirsLines };
}

/** Initialize the merged panel: normal lines as-is, conflicts as placeholders. */
export function buildInitialMergedContent(segments: Segment[]): string {
  return segments
    .map((seg) =>
      seg.type === "normal" ? seg.lines.join("") : conflictPlaceholder(seg.index)
    )
    .join("");
}

/**
 * Replace the placeholder for a given conflict with the resolved content.
 * If the placeholder is gone (user manually edited that zone), returns content unchanged.
 */
export function applyResolutionToMerged(
  content: string,
  conflictIndex: number,
  resolution: Resolution,
  segment: ConflictSegment
): string {
  const placeholder = conflictPlaceholder(conflictIndex);
  const idx = content.indexOf(placeholder);
  if (idx === -1) return content;

  let replacement = "";
  if (resolution === "ours" || resolution === "both") replacement += segment.ours.join("");
  if (resolution === "theirs" || resolution === "both") replacement += segment.theirs.join("");

  return content.slice(0, idx) + replacement + content.slice(idx + placeholder.length);
}
