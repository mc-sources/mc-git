import { useEffect, useRef, useState } from "react";
import { useLogStore } from "../../store/logStore";
import { EntryRow } from "../molecules/EntryRow";

const COLLAPSED_HEIGHT = 28;
const OPEN_HEIGHT = 160;

export function LogPanel() {
  const { entries, unreadCount, markRead, clear } = useLogStore();
  const [open, setOpen] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const hasErrors = entries.some((e) => e.level === "error");
  const lastEntry = entries[entries.length - 1];

  // Auto-open on first error
  useEffect(() => {
    if (hasErrors) setOpen(true);
  }, [hasErrors]);

  // Auto-scroll to bottom when new entries arrive
  useEffect(() => {
    if (autoScroll && open) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [entries, autoScroll, open]);

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 8;
    setAutoScroll(atBottom);
  };

  return (
    <div
      style={{ height: open ? OPEN_HEIGHT : COLLAPSED_HEIGHT }}
      className="shrink-0 flex flex-col border-t border-surface-border bg-surface-base transition-all duration-150 overflow-hidden"
    >
      {/* Header bar */}
      <div
        className="flex items-center gap-2 px-3 h-7 shrink-0 cursor-pointer select-none hover:bg-surface-hover transition-colors"
        onClick={() => setOpen((v) => { if (!v) markRead(); return !v; })}
      >
        <span className="text-xs text-text-secondary font-medium">Logs</span>
        {entries.length > 0 && (
          <span className="text-xs text-text-muted">({entries.length})</span>
        )}
        {!open && unreadCount > 0 && (
          <span className="flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full bg-blue-600 text-[10px] font-semibold text-white leading-none">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
        {hasErrors && (
          <span className="text-xs text-red-400 font-semibold ml-1">
            ● erreur
          </span>
        )}
        {!open && lastEntry && (
          <span
            className={`text-xs ml-2 truncate max-w-sm ${
              lastEntry.level === "error" ? "text-red-300" : "text-text-secondary"
            }`}
          >
            {lastEntry.command}
            {lastEntry.message !== "OK" ? ` — ${lastEntry.message}` : ""}
          </span>
        )}
        <div className="flex-1" />
        {entries.length > 0 && (
          <button
            onClick={(e) => { e.stopPropagation(); clear(); }}
            className="text-xs text-text-muted hover:text-text-secondary transition-colors"
          >
            Effacer
          </button>
        )}
        <span className="text-text-muted text-xs ml-2">{open ? "▼" : "▲"}</span>
      </div>

      {/* Scrollable log entries */}
      {open && (
        <>
          <div className="border-b border-surface-border shrink-0" />
          <div
            ref={scrollRef}
            onScroll={handleScroll}
            className="flex-1 overflow-y-auto"
          >
            {entries.length === 0 && (
              <p className="text-xs text-text-muted px-3 py-2 font-mono">Aucun log</p>
            )}
            {entries.map((entry, i) => (
              <EntryRow key={i} entry={entry} />
            ))}
            <div ref={bottomRef} />
          </div>
        </>
      )}
    </div>
  );
}
