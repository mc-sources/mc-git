import type { IGitRepository } from "../../domain/ports/IGitRepository";
import type { ReflogEntry } from "../../domain/entities";

export type { ReflogEntry };

export async function getReflogUseCase(
  repo: IGitRepository,
  refname?: string
): Promise<ReflogEntry[]> {
  return repo.getReflog(refname);
}
