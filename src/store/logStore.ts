import { create } from "zustand";

export type LogLevel = "info" | "error";

export interface LogEntry {
  level: LogLevel;
  command: string;
  message: string;
  timestamp: number; // ms
}

const MAX_ENTRIES = 500;

interface LogStore {
  entries: LogEntry[];
  unreadCount: number;
  append: (entry: LogEntry) => void;
  markRead: () => void;
  clear: () => void;
}

export const useLogStore = create<LogStore>((set) => ({
  entries: [],
  unreadCount: 0,

  append: (entry) =>
    set((state) => ({
      entries: [...state.entries, entry].slice(-MAX_ENTRIES),
      unreadCount: state.unreadCount + 1,
    })),

  markRead: () => set({ unreadCount: 0 }),

  clear: () => set({ entries: [], unreadCount: 0 }),
}));
