import type { IGitRepository } from "../../domain/ports/IGitRepository";
import type { BranchInfo, MergeStatus, RebaseEntry, RebaseStatus, RebaseStep, RepositoryState } from "../../domain/entities";

export async function listBranchesUseCase(
  repo: IGitRepository,
  filter?: "local" | "remote" | "all"
): Promise<BranchInfo[]> {
  return repo.listBranches(filter);
}

export async function checkoutBranchUseCase(
  repo: IGitRepository,
  name: string
): Promise<void> {
  return repo.checkoutBranch(name);
}

export async function createBranchUseCase(
  repo: IGitRepository,
  name: string,
  fromRef: string
): Promise<BranchInfo> {
  return repo.createBranch(name, fromRef);
}

export async function deleteBranchUseCase(
  repo: IGitRepository,
  name: string,
  force: boolean
): Promise<void> {
  return repo.deleteBranch(name, force);
}

export async function renameBranchUseCase(
  repo: IGitRepository,
  oldName: string,
  newName: string
): Promise<BranchInfo> {
  return repo.renameBranch(oldName, newName);
}

export async function mergeBranchUseCase(
  repo: IGitRepository,
  branchName: string,
  noFf: boolean
): Promise<MergeStatus> {
  return repo.mergeBranch(branchName, noFf);
}

export async function checkoutRemoteBranchUseCase(
  repo: IGitRepository,
  remoteBranchName: string
): Promise<BranchInfo> {
  return repo.checkoutRemoteBranch(remoteBranchName);
}

export async function setBranchUpstreamUseCase(
  repo: IGitRepository,
  branchName: string,
  upstream: string
): Promise<BranchInfo> {
  return repo.setBranchUpstream(branchName, upstream);
}

export async function unsetBranchUpstreamUseCase(
  repo: IGitRepository,
  branchName: string
): Promise<BranchInfo> {
  return repo.unsetBranchUpstream(branchName);
}

export async function abortMergeUseCase(repo: IGitRepository): Promise<void> {
  return repo.abortMerge();
}

export async function getRepositoryStateUseCase(repo: IGitRepository): Promise<RepositoryState> {
  return repo.getRepositoryState();
}

export async function getInteractiveRebaseCommitsUseCase(
  repo: IGitRepository,
  upstreamOid: string
): Promise<RebaseEntry[]> {
  return repo.getInteractiveRebaseCommits(upstreamOid);
}

export async function applyInteractiveRebaseUseCase(
  repo: IGitRepository,
  upstreamOid: string,
  steps: RebaseStep[]
): Promise<RebaseStatus> {
  return repo.applyInteractiveRebase(upstreamOid, steps);
}
