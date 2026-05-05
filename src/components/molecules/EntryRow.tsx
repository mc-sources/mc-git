import type { LogEntry } from "../../store/logStore";

function formatTime(ms: number): string {
  const d = new Date(ms);
  return [
    d.getHours().toString().padStart(2, "0"),
    d.getMinutes().toString().padStart(2, "0"),
    d.getSeconds().toString().padStart(2, "0"),
  ].join(":") + "." + d.getMilliseconds().toString().padStart(3, "0");
}

export function EntryRow({ entry }: { entry: LogEntry }) {
  const isError = entry.level === "error";
  return (
    <div
      className={[
        "flex gap-2 px-3 py-0.5 font-mono text-xs leading-5 border-l-2",
        isError
          ? "bg-red-950/40 border-red-500 text-red-300"
          : "bg-transparent border-transparent text-text-secondary",
      ].join(" ")}
    >
      <span className="shrink-0 text-text-muted">{formatTime(entry.timestamp)}</span>
      <span
        className={[
          "shrink-0 font-semibold uppercase tracking-wide",
          isError ? "text-red-400" : "text-text-secondary",
        ].join(" ")}
      >
        {isError ? "ERR" : " OK"}
      </span>
      <span className={`shrink-0 ${isError ? "text-red-300" : "text-text-secondary"}`}>
        {entry.command}
      </span>
      {entry.message !== "OK" && (
        <span className={isError ? "text-red-200" : "text-text-secondary"}>
          — {entry.message}
        </span>
      )}
    </div>
  );
}
