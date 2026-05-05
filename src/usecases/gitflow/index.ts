import type { IGitRepository } from "../../domain/ports/IGitRepository";
import type { BranchInfo, GitFlowBranchKind, GitFlowConfig } from "../../domain/entities";

export async function getGitflowConfigUseCase(repo: IGitRepository): Promise<GitFlowConfig | null> {
  return repo.getGitflowConfig();
}

export async function initGitflowUseCase(repo: IGitRepository, config: GitFlowConfig): Promise<void> {
  return repo.initGitflow(config);
}

export async function startGitflowBranchUseCase(
  repo: IGitRepository,
  kind: GitFlowBranchKind,
  name: string
): Promise<BranchInfo> {
  return repo.startGitflowBranch(kind, name);
}

export async function finishGitflowBranchUseCase(
  repo: IGitRepository,
  kind: GitFlowBranchKind,
  name: string
): Promise<void> {
  return repo.finishGitflowBranch(kind, name);
}
