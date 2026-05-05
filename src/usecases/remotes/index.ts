import type { IGitRepository } from "../../domain/ports/IGitRepository";
import type { RemoteFetchResult, RemoteInfo } from "../../domain/entities";

export async function listRemotesUseCase(repo: IGitRepository): Promise<RemoteInfo[]> {
  return repo.listRemotes();
}

export async function addRemoteUseCase(
  repo: IGitRepository,
  name: string,
  url: string
): Promise<RemoteInfo> {
  return repo.addRemote(name, url);
}

export async function removeRemoteUseCase(repo: IGitRepository, name: string): Promise<void> {
  return repo.removeRemote(name);
}

export async function fetchUseCase(repo: IGitRepository, remoteName: string): Promise<void> {
  return repo.fetchRemote(remoteName);
}

export async function fetchAllUseCase(repo: IGitRepository): Promise<RemoteFetchResult[]> {
  return repo.fetchAllRemotes();
}

export async function pushUseCase(
  repo: IGitRepository,
  remoteName: string,
  branch: string
): Promise<void> {
  return repo.pushRemote(remoteName, branch);
}

export async function pullUseCase(
  repo: IGitRepository,
  remoteName: string,
  branch: string
): Promise<void> {
  return repo.pullRemote(remoteName, branch);
}

export async function pushForceWithLeaseUseCase(
  repo: IGitRepository,
  remoteName: string,
  branch: string
): Promise<void> {
  return repo.pushForceWithLease(remoteName, branch);
}

export async function pruneRemoteUseCase(repo: IGitRepository, remoteName: string): Promise<void> {
  return repo.pruneRemote(remoteName);                                                                                                                                                        
}
