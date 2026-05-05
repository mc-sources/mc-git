import { useToastStore, type Toast } from "../../store/toastStore";

const KIND_STYLES = {
  success: "bg-emerald-900/90 border-emerald-700 text-emerald-100",
  error:   "bg-red-900/90 border-red-700 text-red-100",
  info:    "bg-surface-overlay border-surface-border text-text-primary",
};

const KIND_ICON = {
  success: "✓",
  error:   "✕",
  info:    "ℹ",
};

export function ToastItem({ toast }: { toast: Toast }) {
  const { dismiss } = useToastStore();
  return (
    <div
      className={[
        "flex items-start gap-3 px-4 py-3 rounded-lg border shadow-xl backdrop-blur-sm",
        "animate-in slide-in-from-bottom-2 fade-in duration-200",
        KIND_STYLES[toast.kind],
      ].join(" ")}
      style={{ minWidth: 280, maxWidth: 420 }}
    >
      <span className="text-sm font-bold mt-px shrink-0">{KIND_ICON[toast.kind]}</span>
      <p className="flex-1 text-sm leading-snug break-words">{toast.message}</p>
      <button
        onClick={() => dismiss(toast.id)}
        className="shrink-0 opacity-50 hover:opacity-100 transition-opacity text-xs mt-0.5"
      >
        ✕
      </button>
    </div>
  );
}
