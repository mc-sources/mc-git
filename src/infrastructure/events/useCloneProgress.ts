import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import type { CloneProgress } from "../../domain/entities";

export function useCloneProgress() {
  const [progress, setProgress] = useState<CloneProgress | null>(null);

  useEffect(() => {
    const unlisten = listen<CloneProgress>("git:clone-progress", (event) => {
      setProgress(event.payload);
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  const reset = () => setProgress(null);

  return { progress, reset };
}
