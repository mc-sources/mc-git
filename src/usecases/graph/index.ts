import type { CommitSummary } from "../../domain/entities";

export interface GraphEdge {
  fromLane: number;
  toLane: number;
  /** 'full' = y=0→ROW_H (other lanes continuing through this row)
   *  'in'   = y=0→cy   (incoming to this commit — the line from above)
   *  'out'  = cy→ROW_H (outgoing to a parent — the line going below) */
  span: "full" | "in" | "out";
  color: string;
}

export interface GraphEntry {
  oid: string;
  lane: number;
  maxLanes: number;
  color: string;
  isMerge: boolean;
  edges: GraphEdge[];
}

const PALETTE = [
  "#60a5fa", // blue-400
  "#a78bfa", // violet-400
  "#34d399", // emerald-400
  "#fb923c", // orange-400
  "#f472b6", // pink-400
  "#facc15", // yellow-400
  "#22d3ee", // cyan-400
  "#f87171", // red-400
];

function colorForLane(lane: number): string {
  return PALETTE[lane % PALETTE.length];
}

/**
 * Compute a git-style graph layout.
 *
 * Edges are split at the commit dot (cy = ROW_H / 2):
 *  - 'in'   : drawn from y=0 to cy  — shows the incoming connection from a child above
 *  - 'out'  : drawn from cy to ROW_H — shows the outgoing connection to a parent below
 *  - 'full' : drawn from y=0 to ROW_H — other active lanes continuing through this row
 *
 * This ensures the dot always sits at the junction of its incoming and outgoing lines,
 * and root/leaf commits don't show phantom stubs beyond their actual connections.
 */
export function computeGraphLayout(commits: CommitSummary[]): GraphEntry[] {
  const lanes: (string | null)[] = [];
  // O(1) reverse index: oid → lane index. Kept in sync with `lanes`.
  const laneForOid = new Map<string, number>();
  const result: GraphEntry[] = [];

  for (const commit of commits) {
    // ── 1. Find this commit's lane ──────────────────────────────────────────
    const foundIdx = laneForOid.get(commit.oid) ?? -1;
    const wasReserved = foundIdx !== -1; // a child above reserved this lane for us

    let myLane: number;
    if (foundIdx !== -1) {
      myLane = foundIdx;
    } else {
      // No reservation — use first free slot or open a new one
      const free = lanes.indexOf(null);
      myLane = free !== -1 ? free : lanes.length;
      if (free === -1) lanes.push(null);
    }

    const myColor = colorForLane(myLane);

    // ── 2. Determine parent lane assignments ────────────────────────────────
    const parentLanes: number[] = [];

    for (let k = 0; k < commit.parentOids.length; k++) {
      const parentOid = commit.parentOids[k];
      const existing = laneForOid.get(parentOid) ?? -1;
      if (existing !== -1) {
        parentLanes.push(existing);
        continue;
      }
      if (k === 0) {
        parentLanes.push(myLane); // first parent inherits current lane
      } else {
        const free = lanes.indexOf(null);
        const slot = free !== -1 ? free : lanes.length;
        if (free === -1) lanes.push(null);
        parentLanes.push(slot);
      }
    }

    // ── 3. Build edge list ──────────────────────────────────────────────────
    const edges: GraphEdge[] = [];

    // Incoming half (y=0 → cy): only if a child commit previously reserved this lane
    if (wasReserved) {
      edges.push({ fromLane: myLane, toLane: myLane, span: "in", color: myColor });
    }

    // Full-height continuations for all other active lanes
    for (let i = 0; i < lanes.length; i++) {
      if (i !== myLane && lanes[i] !== null) {
        edges.push({ fromLane: i, toLane: i, span: "full", color: colorForLane(i) });
      }
    }

    // Outgoing half (cy → ROW_H): one edge per parent
    for (let k = 0; k < parentLanes.length; k++) {
      edges.push({
        fromLane: myLane,
        toLane: parentLanes[k],
        span: "out",
        color: k === 0 ? myColor : colorForLane(parentLanes[k]),
      });
    }

    // ── 4. Update lanes ─────────────────────────────────────────────────────
    lanes[myLane] = null;
    laneForOid.delete(commit.oid);
    for (let k = 0; k < parentLanes.length; k++) {
      const pLane = parentLanes[k];
      const pOid = commit.parentOids[k];
      lanes[pLane] = pOid;
      laneForOid.set(pOid, pLane);
    }
    while (lanes.length > 0 && lanes[lanes.length - 1] === null) lanes.pop();

    const maxLanes = Math.max(
      lanes.length,
      myLane + 1,
      ...parentLanes.map((l) => l + 1),
      1,
    );

    result.push({
      oid: commit.oid,
      lane: myLane,
      maxLanes,
      color: myColor,
      isMerge: commit.parentOids.length > 1,
      edges,
    });
  }

  return result;
}
