import type { IGitRepository } from "../../domain/ports/IGitRepository";
import type { TagInfo } from "../../domain/entities";

export async function listTagsUseCase(repo: IGitRepository): Promise<TagInfo[]> {
  return repo.listTags();
}

export async function createTagUseCase(
  repo: IGitRepository,
  name: string,
  targetOid: string,
  message: string | null
): Promise<TagInfo> {
  return repo.createTag(name, targetOid, message);
}

export async function deleteTagUseCase(repo: IGitRepository, name: string): Promise<void> {
  return repo.deleteTag(name);
}

export async function pushTagUseCase(
  repo: IGitRepository,
  remoteName: string,
  tagName: string
): Promise<void> {
  return repo.pushTag(remoteName, tagName);
}

export async function deleteRemoteTagUseCase(
  repo: IGitRepository,
  remoteName: string,
  tagName: string
): Promise<void> {
  return repo.deleteRemoteTag(remoteName, tagName);
}

export async function listRemoteTagsUseCase(
  repo: IGitRepository,
  remoteName: string
): Promise<string[]> {
  return repo.listRemoteTags(remoteName);
}
