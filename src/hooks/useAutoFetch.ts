import { useEffect, useRef } from "react";
import { useGitRepository } from "../infrastructure/GitRepositoryContext";
import { useRepoStore } from "../store/repoStore";
import { useGitStore } from "../store/gitStore";
import { useSettingsStore } from "../store/settingsStore";
import { useLogStore } from "../store/logStore";
import { fetchAllUseCase } from "../usecases/remotes";
import { listBranchesUseCase } from "../usecases/branches";

/**
 * Silently fetches all remotes at a configurable interval.
 * No toast is shown — the branches store is updated so push/pull counters refresh.
 * Active only when a repo is open and autoFetch is enabled in settings.
 */
export function useAutoFetch(): void {
  const repo = useGitRepository();
  const { currentRepo } = useRepoStore();
  const { setBranches } = useGitStore();
  const { autoFetch, autoFetchIntervalMinutes } = useSettingsStore();

  // Use a ref to hold the latest values so the interval callback is always current
  // without needing to be recreated on every settings change.
  const stateRef = useRef({ repo, currentRepo, setBranches, autoFetch, autoFetchIntervalMinutes });
  useEffect(() => {
    stateRef.current = { repo, currentRepo, setBranches, autoFetch, autoFetchIntervalMinutes };
  });

  useEffect(() => {
    if (!autoFetch || !currentRepo) return;

    const intervalMs = Math.max(1, autoFetchIntervalMinutes) * 60_000;

    const id = setInterval(async () => {
      const { repo: r, currentRepo: active, setBranches: set } = stateRef.current;
      if (!active) return;
      const log = useLogStore.getState().append;
      try {
        const results = await fetchAllUseCase(r);
        const successes = results.filter((res) => res.ok);
        const failures = results.filter((res) => !res.ok);
        if (successes.length > 0) {
          set(await listBranchesUseCase(r, "all"));
        }
        log({
          level: failures.length > 0 && successes.length === 0 ? "error" : "info",
          command: "auto_fetch",
          message:
            successes.length > 0
              ? `Auto-fetch : ${successes.map((r) => r.remote).join(", ")} — OK`
              : `Auto-fetch : échec (${failures.map((r) => r.error ?? r.remote).join(", ")})`,
          timestamp: Date.now(),
        });
      } catch (err) {
        useLogStore.getState().append({
          level: "error",
          command: "auto_fetch",
          message: `Auto-fetch : erreur inattendue — ${err instanceof Error ? err.message : String(err)}`,
          timestamp: Date.now(),
        });
      }
    }, intervalMs);

    return () => clearInterval(id);
  }, [autoFetch, autoFetchIntervalMinutes, currentRepo]);
}
