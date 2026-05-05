import type { IGitRepository } from "../../domain/ports/IGitRepository";
import type { SubmoduleInfo } from "../../domain/entities";

export async function listSubmodulesUseCase(repo: IGitRepository): Promise<SubmoduleInfo[]> {
  return repo.listSubmodules();
}

export async function initSubmoduleUseCase(repo: IGitRepository, name: string): Promise<void> {
  return repo.initSubmodule(name);
}

export async function updateSubmoduleUseCase(repo: IGitRepository, name: string): Promise<void> {
  return repo.updateSubmodule(name);
}

export async function updateAllSubmodulesUseCase(repo: IGitRepository): Promise<void> {
  return repo.updateAllSubmodules();
}

export async function addSubmoduleUseCase(
  repo: IGitRepository,
  url: string,
  path: string
): Promise<void> {
  return repo.addSubmodule(url, path);
}
