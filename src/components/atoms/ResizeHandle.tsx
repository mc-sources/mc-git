export function ResizeHandle({ onMouseDown }: { onMouseDown: (e: React.MouseEvent) => void }) {
  return (
    <div
      onMouseDown={onMouseDown}
      className="w-1.5 shrink-0 cursor-col-resize bg-surface-elevated hover:bg-blue-500/40 transition-colors duration-150 active:bg-blue-500 flex items-center justify-center group"
    >
      <span className="text-text-muted text-[8px] leading-none select-none opacity-0 group-hover:opacity-100 transition-opacity">⋮</span>
    </div>
  );
}
