import { useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import { useUiStore } from "../../store/uiStore";
import type { ProgressEvent } from "../../domain/entities";

export function useProgress() {
  const setProgress = useUiStore((s) => s.setProgress);

  useEffect(() => {
    const unlisten = listen<ProgressEvent>("git:progress", (event) => {
      const p = event.payload;
      // percent === 100 means the operation is done — clear the indicator
      if (p.percent === 100) {
        setProgress(null);
      } else {
        setProgress(p);
      }
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, [setProgress]);
}
