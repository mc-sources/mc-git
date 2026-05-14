/**
 * Parsing des erreurs typées remontées par les commandes Tauri liées aux tags.
 *
 * Les variants `AppError` côté Rust sont sérialisés en string via `Display`
 * (cf. `mcgit/src-tauri/src/error.rs`). Le frontend reçoit donc des chaînes
 * structurées que les helpers ci-dessous décodent en objets typés exploitables
 * par l'UI (dialog dédié, toast localisé…).
 */

export interface TagRemoteDivergentInfo {
  remote: string;
  tag: string;
  remoteOid: string;
  localOid: string;
}

const TAG_REMOTE_DIVERGENT_RE =
  /^TagRemoteDivergent: remote=(\S+) tag=(\S+) remote_oid=([0-9a-f]+) local_oid=([0-9a-f]+)$/;

export function parseTagRemoteDivergent(err: unknown): TagRemoteDivergentInfo | null {
  const msg = String(err).trim();
  const match = msg.match(TAG_REMOTE_DIVERGENT_RE);
  if (!match) return null;
  return {
    remote: match[1],
    tag: match[2],
    remoteOid: match[3],
    localOid: match[4],
  };
}

export interface TagNotFoundRemoteInfo {
  remote: string;
  tag: string;
}

/**
 * Préfixe émis par `delete_remote_tag` côté Rust quand le tag est absent du
 * remote au moment de la suppression (race avec une autre instance ou
 * `git push` concurrent). Cf. REQ-TAG-H15 / `src-tauri/src/git/tag.rs`.
 *
 * Le tag peut contenir n'importe quel caractère valide pour un nom de ref
 * (`/`, `.`, `-`, etc.), donc on capture jusqu'à la fin de la ligne.
 */
const TAG_NOT_FOUND_REMOTE_RE = /TAG_NOT_FOUND_REMOTE:([^:]+):(.+)$/;

export function parseTagNotFoundRemote(err: unknown): TagNotFoundRemoteInfo | null {
  const msg = String(err).trim();
  const match = msg.match(TAG_NOT_FOUND_REMOTE_RE);
  if (!match) return null;
  return {
    remote: match[1],
    tag: match[2],
  };
}
