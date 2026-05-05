import type { IGitRepository } from "../../domain/ports/IGitRepository";
import type { CommitDetail, CommitFilters, CommitSummary, FileDiff } from "../../domain/entities";

export type ResetMode = "soft" | "mixed" | "hard";
export type { CommitFilters };

export async function getLogUseCase(
  repo: IGitRepository,
  limit: number,
  offset: number,
  branch?: string,
  filters?: CommitFilters
): Promise<CommitSummary[]> {
  return repo.getLog(limit, offset, branch, filters);
}

export async function getGraphLogUseCase(
  repo: IGitRepository,
  limit: number,
  showAll = false
): Promise<CommitSummary[]> {
  return repo.getGraphLog(limit, showAll);
}

export async function getCommitDetailUseCase(
  repo: IGitRepository,
  oid: string
): Promise<CommitDetail> {
  return repo.getCommitDetail(oid);
}

export async function getCommitDiffUseCase(
  repo: IGitRepository,
  oid: string,
  ignoreWhitespace = false
): Promise<FileDiff[]> {
  return repo.getCommitDiff(oid, ignoreWhitespace);
}

export async function getCommitFileDiffUseCase(
  repo: IGitRepository,
  commitOid: string,
  path: string,
  ignoreWhitespace = false
): Promise<FileDiff> {
  return repo.getCommitFileDiff(commitOid, path, ignoreWhitespace);
}

export async function getFileHistoryUseCase(
  repo: IGitRepository,
  filePath: string,
  limit = 100
): Promise<CommitSummary[]> {
  return repo.getLog(limit, 0, undefined, { path: filePath });
}

export async function resetToCommitUseCase(
  repo: IGitRepository,
  oid: string,
  mode: ResetMode
): Promise<void> {
  return repo.resetToCommit(oid, mode);
}

export async function revertCommitUseCase(
  repo: IGitRepository,
  oid: string
): Promise<CommitSummary> {
  return repo.revertCommit(oid);
}
