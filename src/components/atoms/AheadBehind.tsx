export function AheadBehind({ ahead, behind }: { ahead: number; behind: number }) {
  if (ahead === 0 && behind === 0) return null;
  return (
    <span className="flex items-center gap-1 text-[10px] font-mono">
      {behind > 0 && <span className="text-amber-400">↓{behind}</span>}
      {ahead > 0  && <span className="text-emerald-400">↑{ahead}</span>}
    </span>
  );
}
