import type { IGitRepository } from "../../domain/ports/IGitRepository";
import type { RebaseStatus } from "../../domain/entities";

export async function rebaseBranchUseCase(
  repo: IGitRepository,
  ontoBranch: string
): Promise<RebaseStatus> {
  return repo.rebaseBranch(ontoBranch);
}

export async function continueRebaseUseCase(repo: IGitRepository): Promise<RebaseStatus> {
  return repo.continueRebase();
}

export async function abortRebaseUseCase(repo: IGitRepository): Promise<void> {
  return repo.abortRebase();
}
