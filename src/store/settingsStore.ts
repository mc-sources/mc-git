import { create } from "zustand";
import { persist } from "zustand/middleware";
import i18n from "../i18n";

export type Theme = "dark" | "light" | "system";
export type Lang = "fr" | "en" | "es";
export type GitBackend = "git2" | "cli";

interface SettingsStore {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  lang: Lang;
  setLang: (lang: Lang) => void;
  editorCommand: string;
  setEditorCommand: (cmd: string) => void;
  diffToolCommand: string;
  setDiffToolCommand: (cmd: string) => void;
  backend: GitBackend;
  setBackend: (backend: GitBackend) => void;
  easyMode: boolean;
  setEasyMode: (easyMode: boolean) => void;
  autoFetch: boolean;
  setAutoFetch: (autoFetch: boolean) => void;
  autoFetchIntervalMinutes: number;
  setAutoFetchIntervalMinutes: (minutes: number) => void;
}

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      theme: "dark",
      setTheme: (theme) => set({ theme }),
      lang: "fr",
      setLang: (lang) => {
        i18n.changeLanguage(lang);
        set({ lang });
      },
      editorCommand: "",
      setEditorCommand: (editorCommand) => set({ editorCommand }),
      diffToolCommand: "",
      setDiffToolCommand: (diffToolCommand) => set({ diffToolCommand }),
      backend: "git2",
      setBackend: (backend) => set({ backend }),
      easyMode: false,
      setEasyMode: (easyMode) => set({ easyMode }),
      autoFetch: false,
      setAutoFetch: (autoFetch) => set({ autoFetch }),
      autoFetchIntervalMinutes: 5,
      setAutoFetchIntervalMinutes: (autoFetchIntervalMinutes) => set({ autoFetchIntervalMinutes }),
    }),
    { name: "mcgit-settings" }
  )
);
