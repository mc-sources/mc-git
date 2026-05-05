import type { IGitRepository } from "../../domain/ports/IGitRepository";
import type { CommitSummary, FileDiff } from "../../domain/entities";

export async function createCommitUseCase(
  repo: IGitRepository,
  message: string
): Promise<CommitSummary> {
  return repo.createCommit(message);
}

export async function amendCommitUseCase(
  repo: IGitRepository,
  message: string
): Promise<CommitSummary> {
  return repo.amendCommit(message);
}

export async function getCommitDiffUseCase(
  repo: IGitRepository,
  oid: string
): Promise<FileDiff[]> {
  return repo.getCommitDiff(oid);
}
