import { invoke } from "@tauri-apps/api/core";

export async function readFileUseCase(repoPath: string, filePath: string): Promise<string> {
  return invoke<string>("read_file", { path: `${repoPath}/${filePath}` });
}

export async function writeFileUseCase(repoPath: string, filePath: string, content: string): Promise<void> {
  return invoke("write_file", { path: `${repoPath}/${filePath}`, content });
}
