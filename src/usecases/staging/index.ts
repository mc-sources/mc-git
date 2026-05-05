import type { IGitRepository } from "../../domain/ports/IGitRepository";
import type { DiffHunk, FileDiff, StatusEntry } from "../../domain/entities";

export async function getStatusUseCase(repo: IGitRepository): Promise<StatusEntry[]> {
  return repo.getStatus();
}

export async function listTrackedFilesUseCase(repo: IGitRepository): Promise<string[]> {
  return repo.listTrackedFiles();
}

export async function stageFileUseCase(repo: IGitRepository, path: string): Promise<void> {
  return repo.stageFile(path);
}

export async function stagePathsUseCase(repo: IGitRepository, paths: string[]): Promise<void> {
  if (paths.length === 0) return;
  return repo.stagePaths(paths);
}

export async function unstageFileUseCase(repo: IGitRepository, path: string): Promise<void> {
  return repo.unstageFile(path);
}

export async function unstagePathsUseCase(repo: IGitRepository, paths: string[]): Promise<void> {
  if (paths.length === 0) return;
  return repo.unstagePaths(paths);
}

export async function discardChangesUseCase(repo: IGitRepository, path: string): Promise<void> {
  return repo.discardChanges(path);
}

export async function discardAllUseCase(repo: IGitRepository): Promise<void> {
  return repo.discardAll();
}

export async function stageAllUseCase(repo: IGitRepository): Promise<void> {
  return repo.stageAll();
}

export async function unstageAllUseCase(repo: IGitRepository): Promise<void> {
  return repo.unstageAll();
}

export async function getFileDiffUseCase(
  repo: IGitRepository,
  path: string,
  staged: boolean,
  ignoreWhitespace = false
): Promise<FileDiff> {
  return repo.getFileDiff(path, staged, ignoreWhitespace);
}

export async function writeAndStageFileUseCase(
  repo: IGitRepository,
  path: string,
  content: string
): Promise<void> {
  return repo.writeAndStageFile(path, content);
}

export async function stageHunkUseCase(
  repo: IGitRepository,
  filePath: string,
  _hunk: DiffHunk,
  hunkIndex: number
): Promise<void> {
  return repo.stageHunk(filePath, hunkIndex);
}

export async function unstageHunkUseCase(
  repo: IGitRepository,
  filePath: string,
  _hunk: DiffHunk,
  hunkIndex: number
): Promise<void> {
  return repo.unstageHunk(filePath, hunkIndex);
}

export async function stageSelectionUseCase(
  repo: IGitRepository,
  filePath: string,
  _hunk: DiffHunk,
  hunkIndex: number,
  selectedIndices: Set<number>
): Promise<void> {
  return repo.stageHunk(filePath, hunkIndex, Array.from(selectedIndices));
}

export async function resetConflictFileUseCase(repo: IGitRepository, path: string): Promise<void> {
  return repo.resetConflictFile(path);
}

export async function resetStagedConflictFileUseCase(repo: IGitRepository, path: string): Promise<void> {
  return repo.resetStagedConflictFile(path);
}

export async function resetAllConflictFilesUseCase(repo: IGitRepository): Promise<void> {
  return repo.resetAllConflictFiles();
}

export async function resolveDeletionAcceptUseCase(repo: IGitRepository, path: string): Promise<void> {
  return repo.resolveDeletionAccept(path);
}

export async function resolveDeletionRestoreUseCase(repo: IGitRepository, path: string): Promise<void> {
  return repo.resolveDeletionRestore(path);
}

export async function resolveDeletionAcceptTheirsUseCase(repo: IGitRepository, path: string): Promise<void> {
  return repo.resolveDeletionAcceptTheirs(path);
}

export async function resolveDeletionKeepOursUseCase(repo: IGitRepository, path: string): Promise<void> {
  return repo.resolveDeletionKeepOurs(path);
}

export async function unstageSelectionUseCase(
  repo: IGitRepository,
  filePath: string,
  _hunk: DiffHunk,
  hunkIndex: number,
  selectedIndices: Set<number>
): Promise<void> {
  return repo.unstageHunk(filePath, hunkIndex, Array.from(selectedIndices));
}
