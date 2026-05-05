import type { IGitRepository } from "../../domain/ports/IGitRepository";
import type { StashEntry } from "../../domain/entities";

export async function saveStashUseCase(
  repo: IGitRepository,
  message: string | null,
  includeUntracked: boolean,
  keepIndex: boolean
): Promise<string> {
  return repo.stashSave(message, includeUntracked, keepIndex);
}

export async function listStashesUseCase(repo: IGitRepository): Promise<StashEntry[]> {
  return repo.stashList();
}

export async function applyStashUseCase(repo: IGitRepository, index: number): Promise<void> {
  return repo.stashApply(index);
}

export async function popStashUseCase(repo: IGitRepository, index: number): Promise<void> {
  return repo.stashPop(index);
}

export async function dropStashUseCase(repo: IGitRepository, index: number): Promise<void> {
  return repo.stashDrop(index);
}
