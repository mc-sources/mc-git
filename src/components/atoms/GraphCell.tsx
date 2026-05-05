import { memo } from "react";
import type { GraphEdge, GraphEntry } from "../../usecases/graph";

export const LANE_W = 14; // px per lane column
export const ROW_H = 58;  // px — must match CommitList row height (h-[58px])

const DOT_R = 4;
const cy = ROW_H / 2; // vertical midpoint — where the commit dot sits

interface Props {
  entry: GraphEntry;
  totalLanes: number;
}

function renderEdge(edge: GraphEdge, key: number) {
  const x1 = edge.fromLane * LANE_W + LANE_W / 2;
  const x2 = edge.toLane * LANE_W + LANE_W / 2;

  // y range depends on span type
  const y1 = edge.span === "out" ? cy : 0;
  const y2 = edge.span === "in" ? cy : ROW_H;

  if (x1 === x2) {
    return (
      <line key={key} x1={x1} y1={y1} x2={x2} y2={y2} stroke={edge.color} strokeWidth={1.5} />
    );
  }

  // Diagonal Bézier — only 'out' edges can be diagonal (fromLane → toLane)
  const midY = (y1 + y2) / 2;
  const d = `M ${x1} ${y1} C ${x1} ${midY} ${x2} ${midY} ${x2} ${y2}`;
  return <path key={key} d={d} fill="none" stroke={edge.color} strokeWidth={1.5} />;
}

export const GraphCell = memo(function GraphCell({ entry, totalLanes }: Props) {
  const width = Math.max(totalLanes, entry.maxLanes) * LANE_W;
  const cx = entry.lane * LANE_W + LANE_W / 2;

  return (
    <svg width={width} height={ROW_H} className="overflow-visible">
      {entry.edges.map((edge, i) => renderEdge(edge, i))}

      {/* Commit dot */}
      <circle cx={cx} cy={cy} r={DOT_R} fill={entry.color} />
      {/* Inner ring for merge commits */}
      {entry.isMerge && (
        <circle cx={cx} cy={cy} r={DOT_R - 1.5} fill="#18181b" />
      )}
    </svg>
  );
});
