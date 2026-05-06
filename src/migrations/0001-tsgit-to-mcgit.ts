// Migration localStorage tsgit → mcgit.
//
// Idempotente. Sera supprimée une fois la base utilisateurs jugée 100 % migrée.
//
// Note : avec le changement d'identifier Tauri (`org.mc.tsgit` → `org.mc.mcgit`),
// le WebView pointe sur un nouveau profil donc localStorage est, en pratique,
// vide au premier démarrage. Ces migrations restent en place par défense
// (elles s'exécutent au cas où des données legacy seraient présentes — ex.
// dev mode ou copie manuelle de profil).

const MIGRATION_PAIRS: ReadonlyArray<readonly [legacy: string, target: string]> = [
  ["tsgit-settings", "mcgit-settings"],
  ["tsgit-repo-store", "mcgit-repo-store"],
  ["tsgit-staging-ignore", "mcgit-staging-ignore"],
] as const;

/**
 * Copie `localStorage[oldName]` vers `localStorage[newName]` puis supprime
 * l'ancienne clé. No-op si la nouvelle clé existe déjà ou si l'ancienne est
 * absente.
 */
export async function migrateLegacyStore(oldName: string, newName: string): Promise<void> {
  if (typeof localStorage === "undefined") return;
  if (localStorage.getItem(newName) !== null) return;
  const oldValue = localStorage.getItem(oldName);
  if (oldValue === null) return;
  localStorage.setItem(newName, oldValue);
  localStorage.removeItem(oldName);
}

// Side-effect : exécute les 3 migrations à l'import du module.
// L'API est synchrone (`localStorage`), donc le travail est terminé avant que
// l'évaluation de tout module dépendant ne commence.
for (const [legacy, target] of MIGRATION_PAIRS) {
  migrateLegacyStore(legacy, target);
}
