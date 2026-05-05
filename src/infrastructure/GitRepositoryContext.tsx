import { createContext, useContext } from "react";
import type { IGitRepository } from "../domain/ports/IGitRepository";
import { TauriGitRepository } from "./ipc/TauriGitRepository";

const instance = new TauriGitRepository();

const GitRepositoryContext = createContext<IGitRepository>(instance);

export function GitRepositoryProvider({ children }: { children: React.ReactNode }) {
  return (
    <GitRepositoryContext.Provider value={instance}>
      {children}
    </GitRepositoryContext.Provider>
  );
}

export function useGitRepository(): IGitRepository {
  return useContext(GitRepositoryContext);
}
