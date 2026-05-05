import { useToastStore } from "../../store/toastStore";
import { ToastItem } from "../atoms/ToastItem";

export function Toaster() {
  const { toasts } = useToastStore();
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-10 right-4 z-50 flex flex-col gap-2 items-end pointer-events-none">
      {toasts.map((t) => (
        <div key={t.id} className="pointer-events-auto">
          <ToastItem toast={t} />
        </div>
      ))}
    </div>
  );
}
