import { useUiStore } from "../../store/uiStore";

export function ProgressBar() {
  const progress = useUiStore((s) => s.progress);

  if (!progress) return null;

  return (
    <div className="h-0.5 bg-surface-overlay relative overflow-hidden shrink-0">
      {progress.percent != null ? (
        <div
          className="absolute inset-y-0 left-0 bg-blue-500 transition-[width] duration-300"
          style={{ width: `${progress.percent}%` }}
        />
      ) : (
        <div className="absolute inset-y-0 left-0 right-0 bg-blue-500/40 animate-pulse" />
      )}
    </div>
  );
}
