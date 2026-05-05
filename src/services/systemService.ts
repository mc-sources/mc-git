import { invoke } from "@tauri-apps/api/core";
import { openPath } from "@tauri-apps/plugin-opener";
import type { GpgKeyInfo } from "../domain/entities";

export async function openTerminal(path: string): Promise<void> {
  return invoke<void>("open_terminal", { path });
}

export async function openInEditor(path: string, editorCmd: string): Promise<void> {
  return invoke<void>("open_in_editor", { path, editorCmd });
}

export async function openFolder(path: string): Promise<void> {
  return openPath(path);
}

export async function openExternalDiff(
  tool: string,
  repoPath: string,
  filePath: string,
  staged: boolean
): Promise<void> {
  return invoke<void>("open_external_diff", { tool, repoPath, filePath, staged });
}

export async function copyToClipboard(text: string): Promise<void> {
  return invoke<void>("copy_to_clipboard", { text });
}

export async function saveReport(path: string, content: string): Promise<void> {
  return invoke<void>("save_report", { path, content });
}

export async function listGpgKeys(): Promise<GpgKeyInfo[]> {
  const raw = await invoke<Array<{ key_id: string; uid: string }>>("list_gpg_keys");
  return raw.map((k) => ({ keyId: k.key_id, uid: k.uid }));
}
