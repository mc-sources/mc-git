import { create } from "zustand";
import { useLogStore } from "./logStore";

export type ToastKind = "success" | "error" | "info";

export interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
}

let _id = 0;

interface ToastStore {
  toasts: Toast[];
  push: (kind: ToastKind, message: string) => void;
  dismiss: (id: number) => void;
}

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],

  push: (kind, message) => {
    const id = ++_id;
    set((s) => ({ toasts: [...s.toasts, { id, kind, message }] }));

    // Archive every toast in the LogPanel (REQ-UX-018)
    useLogStore.getState().append({
      level: kind === "error" ? "error" : "info",
      command: kind,
      message,
      timestamp: Date.now(),
    });

    // Error toasts stay until manually dismissed (REQ-UX-019);
    // success and info auto-dismiss after 4 s.
    if (kind !== "error") {
      setTimeout(() => {
        set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
      }, 4000);
    }
  },

  dismiss: (id) =>
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

// Convenience helpers usable outside React components
export const toast = {
  success: (msg: string) => useToastStore.getState().push("success", msg),
  error:   (msg: string) => useToastStore.getState().push("error",   msg),
  info:    (msg: string) => useToastStore.getState().push("info",    msg),
};
