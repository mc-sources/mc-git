/**
 * Validation côté frontend du nom d'un tag git.
 *
 * Règles tirées de T-0004 §"Caractères spéciaux" — l'ordre des checks est
 * significatif : on signale la première raison rencontrée. Le backend libgit2
 * agit en filet de sécurité pour les cas non couverts ici.
 *
 * `reason` est une clé i18n suffixée (ex. "spaces") consommée côté UI sous la
 * forme `tags.create.invalidName.<reason>`.
 */
export type TagNameInvalidReason =
  | "empty"
  | "spaces"
  | "dots"
  | "special"
  | "startDash"
  | "endLock";

export interface TagNameValidation {
  ok: boolean;
  reason?: TagNameInvalidReason;
}

const SPECIAL_CHARS_RE = /[~:^?*[\\]/;

export function validateTagName(name: string): TagNameValidation {
  if (name.length === 0) return { ok: false, reason: "empty" };
  if (/\s/.test(name)) return { ok: false, reason: "spaces" };
  if (name.startsWith("-")) return { ok: false, reason: "startDash" };
  if (name.endsWith(".lock")) return { ok: false, reason: "endLock" };
  if (
    name.includes("..") ||
    name.includes("//") ||
    name.includes("/.") ||
    name.includes("@{")
  ) {
    return { ok: false, reason: "dots" };
  }
  if (SPECIAL_CHARS_RE.test(name)) return { ok: false, reason: "special" };
  return { ok: true };
}
