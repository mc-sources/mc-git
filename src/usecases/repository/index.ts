import type { IGitRepository, GitBackend } from "../../domain/ports/IGitRepository";
import type { RepoInfo } from "../../domain/entities";

export async function openRepositoryUseCase(
  repo: IGitRepository,
  path: string,
  tabId: string,
  backend?: GitBackend
): Promise<RepoInfo> {
  return repo.openRepository(path, tabId, backend);
}

export async function initRepositoryUseCase(
  repo: IGitRepository,
  path: string,
  tabId: string,
  backend?: GitBackend
): Promise<RepoInfo> {
  return repo.initRepository(path, tabId, backend);
}

export async function closeRepositoryUseCase(repo: IGitRepository): Promise<void> {
  return repo.closeRepository();
}

export async function cloneRepositoryUseCase(
  repo: IGitRepository,
  url: string,
  path: string,
  tabId: string
): Promise<RepoInfo> {
  return repo.cloneRepository(url, path, tabId);
}

export async function getRepoInfoUseCase(repo: IGitRepository): Promise<RepoInfo> {
  return repo.getRepoInfo();
}

export async function switchActiveTabUseCase(
  repo: IGitRepository,
  tabId: string
): Promise<void> {
  return repo.switchActiveTab(tabId);
}

export async function closeTabUseCase(
  repo: IGitRepository,
  tabId: string
): Promise<void> {
  return repo.closeTab(tabId);
}
