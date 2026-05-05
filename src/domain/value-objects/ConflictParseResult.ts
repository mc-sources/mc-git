export type Resolution = "ours" | "theirs" | "both";

export interface NormalSegment {
  type: "normal";
  lines: string[];
}

export interface ConflictSegment {
  type: "conflict";
  index: number;
  oursLabel: string;
  theirsLabel: string;
  ours: string[];
  theirs: string[];
}

export type Segment = NormalSegment | ConflictSegment;

export interface ConflictParseResult {
  segments: Segment[];
  conflictCount: number;
  /** File content with only "ours" kept at each conflict (no markers). */
  oursLines: string[];
  /** File content with only "theirs" kept at each conflict (no markers). */
  theirsLines: string[];
}
