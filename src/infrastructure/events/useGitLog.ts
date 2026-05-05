import { useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import { useLogStore, type LogEntry } from "../../store/logStore";

export function useGitLog() {
  const append = useLogStore((s) => s.append);

  useEffect(() => {
    const unlisten = listen<LogEntry>("git:log", (event) => {
      append(event.payload);
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, [append]);
}
