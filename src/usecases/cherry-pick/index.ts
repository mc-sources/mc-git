import type { IGitRepository } from "../../domain/ports/IGitRepository";
import type { CherryPickStatus, CommitSummary } from "../../domain/entities";

export async function cherryPickUseCase(
  repo: IGitRepository,
  oid: string
): Promise<CherryPickStatus> {
  return repo.cherryPick(oid);
}

export async function continueCherryPickUseCase(
  repo: IGitRepository
): Promise<CommitSummary> {
  return repo.continueCherryPick();
}

export async function abortCherryPickUseCase(repo: IGitRepository): Promise<void> {
  return repo.abortCherryPick();
}
