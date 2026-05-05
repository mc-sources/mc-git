import type { IGitRepository } from "../../domain/ports/IGitRepository";

export async function getGitConfigUseCase(
  repo: IGitRepository,
  key: string,
  global: boolean
): Promise<string | null> {
  return repo.getGitConfig(key, global);
}

export async function setGitConfigUseCase(
  repo: IGitRepository,
  key: string,
  value: string,
  global: boolean
): Promise<void> {
  return repo.setGitConfig(key, value, global);
}

export async function getDefaultRemoteUseCase(repo: IGitRepository): Promise<string> {
  return (await getGitConfigUseCase(repo, "remote.default", false)) ?? "origin";
}

export async function setDefaultRemoteUseCase(repo: IGitRepository, name: string): Promise<void> {
  return setGitConfigUseCase(repo, "remote.default", name, false);
}
