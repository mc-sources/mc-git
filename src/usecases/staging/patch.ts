import type { DiffHunk } from "../../domain/entities";

function parseHunkHeader(header: string): { oldStart: number; newStart: number } {
  const match = header.match(/@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
  if (!match) return { oldStart: 1, newStart: 1 };
  return { oldStart: parseInt(match[1], 10), newStart: parseInt(match[2], 10) };
}

function diffHeader(filePath: string): string {
  return `diff --git a/${filePath} b/${filePath}\n--- a/${filePath}\n+++ b/${filePath}\n`;
}

function ensureNewline(content: string): string {
  return content.endsWith("\n") ? content : content + "\n";
}

/** Build a patch applying all lines of a single hunk to the index (stage). */
export function buildHunkPatch(filePath: string, hunk: DiffHunk): string {
  let patch = diffHeader(filePath);
  // hunk.header already ends with \n (git2 includes the line terminator)
  patch += hunk.header;
  for (const line of hunk.lines) {
    const prefix = line.origin === "+" ? "+" : line.origin === "-" ? "-" : " ";
    patch += prefix + ensureNewline(line.content);
  }
  return patch;
}

/**
 * Build a patch applying only selected changed lines of a hunk.
 * `selectedIndices` contains the indices (within `hunk.lines`) of changed lines to include.
 * Unselected "-" lines are treated as context (the deletion is skipped).
 * Unselected "+" lines are omitted (the addition is skipped).
 */
export function buildSelectionPatch(
  filePath: string,
  hunk: DiffHunk,
  selectedIndices: Set<number>
): string {
  const { oldStart, newStart } = parseHunkHeader(hunk.header);

  const effective: Array<{ origin: "+" | "-" | " "; content: string }> = [];
  for (let i = 0; i < hunk.lines.length; i++) {
    const line = hunk.lines[i];
    if (line.origin === " ") {
      effective.push({ origin: " ", content: line.content });
    } else if (line.origin === "-") {
      if (selectedIndices.has(i)) {
        effective.push({ origin: "-", content: line.content });
      } else {
        // Unselected deletion: line stays → context
        effective.push({ origin: " ", content: line.content });
      }
    } else {
      // origin === "+"
      if (selectedIndices.has(i)) {
        effective.push({ origin: "+", content: line.content });
      }
      // Unselected addition: omit
    }
  }

  const oldCount = effective.filter((l) => l.origin === " " || l.origin === "-").length;
  const newCount = effective.filter((l) => l.origin === " " || l.origin === "+").length;

  let patch = diffHeader(filePath);
  patch += `@@ -${oldStart},${oldCount} +${newStart},${newCount} @@\n`;
  for (const line of effective) {
    const prefix = line.origin === "+" ? "+" : line.origin === "-" ? "-" : " ";
    patch += prefix + ensureNewline(line.content);
  }
  return patch;
}

/** Build a reversed patch to remove all lines of a hunk from the index (unstage). */
export function buildReversedHunkPatch(filePath: string, hunk: DiffHunk): string {
  const { oldStart, newStart } = parseHunkHeader(hunk.header);
  const oldCount = hunk.lines.filter((l) => l.origin === " " || l.origin === "-").length;
  const newCount = hunk.lines.filter((l) => l.origin === " " || l.origin === "+").length;

  let patch = diffHeader(filePath);
  // Reverse: new (index) becomes old, old (HEAD) becomes new target
  patch += `@@ -${newStart},${newCount} +${oldStart},${oldCount} @@\n`;
  for (const line of hunk.lines) {
    const prefix = line.origin === "+" ? "-" : line.origin === "-" ? "+" : " ";
    patch += prefix + ensureNewline(line.content);
  }
  return patch;
}

/** Build a reversed patch to remove only selected lines from the index (unstage selection). */
export function buildReversedSelectionPatch(
  filePath: string,
  hunk: DiffHunk,
  selectedIndices: Set<number>
): string {
  const { oldStart, newStart } = parseHunkHeader(hunk.header);

  // Reverse view: what was "+" in the staged diff becomes "-" to remove from index.
  // Unselected "+" (staged add) lines become context (stay in index).
  // Unselected "-" (staged delete) lines are omitted (the restore is skipped).
  const effective: Array<{ origin: "+" | "-" | " "; content: string }> = [];
  for (let i = 0; i < hunk.lines.length; i++) {
    const line = hunk.lines[i];
    if (line.origin === " ") {
      effective.push({ origin: " ", content: line.content });
    } else if (line.origin === "+") {
      // In the staged diff, "+" means a line was added to index
      if (selectedIndices.has(i)) {
        // Reverse: remove it from index → "-"
        effective.push({ origin: "-", content: line.content });
      } else {
        // Unselected: keep in index → context
        effective.push({ origin: " ", content: line.content });
      }
    } else {
      // origin === "-": a line was removed from index
      if (selectedIndices.has(i)) {
        // Reverse: restore it to index → "+"
        effective.push({ origin: "+", content: line.content });
      }
      // Unselected: omit (the restoration is skipped)
    }
  }

  const oldCount = effective.filter((l) => l.origin === " " || l.origin === "-").length;
  const newCount = effective.filter((l) => l.origin === " " || l.origin === "+").length;

  let patch = diffHeader(filePath);
  patch += `@@ -${newStart},${oldCount} +${oldStart},${newCount} @@\n`;
  for (const line of effective) {
    const prefix = line.origin === "+" ? "+" : line.origin === "-" ? "-" : " ";
    patch += prefix + ensureNewline(line.content);
  }
  return patch;
}
