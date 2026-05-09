import type { IGitRepository } from "../../domain/ports/IGitRepository";
import type { RemoteFetchResult, RemoteInfo } from "../../domain/entities";
import { useGitStore } from "../../store/gitStore";
import { listRemoteTagsUseCase } from "../tags";

/**
 * Rafraîchit la présence des tags sur un remote dans le cache `gitStore.remoteTagPresence`.
 * Échec silencieux : si `list_remote_tags` retourne une erreur (réseau, auth, etc.), on
 * laisse l'entrée du cache inchangée — l'indicateur multi-remotes restera à `?<remote>`
 * pour ce remote (cf. ANA-0007 T-0003 §1).
 */
async function refreshRemoteTagPresence(
  repo: IGitRepository,
  remoteName: string
): Promise<void> {
  try {
    const tagNames = await listRemoteTagsUseCase(repo, remoteName);
    useGitStore.getState().setRemoteTagPresenceForRemote(remoteName, tagNames);
  } catch {
    // Silent degradation — see comment above.
  }
}

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
  await repo.fetchRemote(remoteName);
  await refreshRemoteTagPresence(repo, remoteName);
}

export async function fetchAllUseCase(repo: IGitRepository): Promise<RemoteFetchResult[]> {
  const results = await repo.fetchAllRemotes();
  for (const r of results) {
    if (r.ok) {
      await refreshRemoteTagPresence(repo, r.remote);
    }
  }
  return results;
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
  await repo.pullRemote(remoteName, branch);
  await refreshRemoteTagPresence(repo, remoteName);
}

export async function pushForceWithLeaseUseCase(
  repo: IGitRepository,
  remoteName: string,
  branch: string
): Promise<void> {
  return repo.pushForceWithLease(remoteName, branch);
}

export async function pruneRemoteUseCase(repo: IGitRepository, remoteName: string): Promise<void> {
  await repo.pruneRemote(remoteName);
  await refreshRemoteTagPresence(repo, remoteName);
}
