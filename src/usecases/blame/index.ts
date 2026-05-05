import type { IGitRepository } from "../../domain/ports/IGitRepository";
import type { BlameLine } from "../../domain/entities";

export async function getBlameUseCase(
  repo: IGitRepository,
  path: string,
  commitOid?: string,
): Promise<BlameLine[]> {
  return repo.getBlame(path, commitOid);
}
