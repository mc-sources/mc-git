// Migration des répertoires utilisateur tsgit → mcgit.
//
// Couvre :
//   - `~/.config/tsgit/`        → `~/.config/mcgit/`        (trusted_hosts)
//   - `~/.local/share/tsgit/`   → `~/.local/share/mcgit/`   (credential_store)
//
// Le localStorage WebKit (sous `~/.local/share/org.mc.tsgit/`) n'est PAS migré
// — décision HU 2026-05-05 : reset accepté.
//
// TODO: supprimer ce module à partir de la version 3.3.0+ une fois la base
// utilisateurs jugée 100 % migrée.

use std::io;
use std::path::Path;

/// Migre `base/legacy_subdir` → `base/new_subdir` si nécessaire.
///
/// - Si `base/new_subdir` existe : no-op (déjà migré ou cible déjà présente).
/// - Si `base/legacy_subdir` n'existe pas : no-op silencieux.
/// - Sinon : `fs::rename`. Si rename échoue (cross-device, permissions partielles…),
///   fallback `copy_dir_recursive + remove_dir_all`.
///
/// Idempotent : appelable plusieurs fois sans effet de bord.
///
/// Retourne `Ok(true)` si la migration a eu lieu, `Ok(false)` sinon.
pub fn migrate_legacy_dir(legacy_subdir: &str, new_subdir: &str, base: &Path) -> io::Result<bool> {
    let legacy = base.join(legacy_subdir);
    let new = base.join(new_subdir);

    if new.exists() {
        return Ok(false);
    }
    if !legacy.exists() {
        return Ok(false);
    }

    if std::fs::rename(&legacy, &new).is_err() {
        copy_dir_recursive(&legacy, &new)?;
        std::fs::remove_dir_all(&legacy)?;
    }

    Ok(true)
}

/// Copie récursive `src` → `dst`. Crée `dst` si absent.
///
/// Exposé `pub(crate)` pour permettre aux tests de couvrir le chemin de fallback
/// indépendamment de `migrate_legacy_dir`.
pub(crate) fn copy_dir_recursive(src: &Path, dst: &Path) -> io::Result<()> {
    std::fs::create_dir_all(dst)?;
    for entry in std::fs::read_dir(src)? {
        let entry = entry?;
        let ty = entry.file_type()?;
        let dst_path = dst.join(entry.file_name());
        if ty.is_dir() {
            copy_dir_recursive(&entry.path(), &dst_path)?;
        } else {
            std::fs::copy(entry.path(), &dst_path)?;
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    fn write(path: &Path, content: &str) {
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent).unwrap();
        }
        std::fs::write(path, content).unwrap();
    }

    #[test]
    fn migrate_when_legacy_present_and_new_absent_returns_true() {
        let tmp = TempDir::new().unwrap();
        let base = tmp.path();
        write(&base.join("tsgit").join("trusted_ssh_hosts.json"), "{}");
        write(&base.join("tsgit").join("nested").join("deep.txt"), "deep");

        let migrated = migrate_legacy_dir("tsgit", "mcgit", base).unwrap();

        assert!(migrated, "migration devrait avoir eu lieu");
        assert!(!base.join("tsgit").exists(), "ancien dossier devrait être supprimé");
        assert!(base.join("mcgit").join("trusted_ssh_hosts.json").exists());
        assert_eq!(
            std::fs::read_to_string(base.join("mcgit").join("nested").join("deep.txt")).unwrap(),
            "deep"
        );
    }

    #[test]
    fn no_op_when_new_already_exists() {
        let tmp = TempDir::new().unwrap();
        let base = tmp.path();
        write(&base.join("tsgit").join("a.txt"), "legacy");
        write(&base.join("mcgit").join("b.txt"), "already-here");

        let migrated = migrate_legacy_dir("tsgit", "mcgit", base).unwrap();

        assert!(!migrated, "ne doit rien faire si la cible existe déjà");
        assert!(base.join("tsgit").join("a.txt").exists(), "legacy doit rester intact");
        assert_eq!(
            std::fs::read_to_string(base.join("mcgit").join("b.txt")).unwrap(),
            "already-here"
        );
    }

    #[test]
    fn no_op_when_nothing_to_migrate() {
        let tmp = TempDir::new().unwrap();
        let base = tmp.path();

        let migrated = migrate_legacy_dir("tsgit", "mcgit", base).unwrap();

        assert!(!migrated);
        assert!(!base.join("tsgit").exists());
        assert!(!base.join("mcgit").exists());
    }

    #[test]
    fn copy_dir_recursive_handles_nested_structure() {
        let tmp = TempDir::new().unwrap();
        let src = tmp.path().join("src");
        let dst = tmp.path().join("dst");

        write(&src.join("root.txt"), "root");
        write(&src.join("a").join("a.txt"), "a-content");
        write(&src.join("a").join("b").join("c.txt"), "deep");

        copy_dir_recursive(&src, &dst).unwrap();

        assert_eq!(std::fs::read_to_string(dst.join("root.txt")).unwrap(), "root");
        assert_eq!(std::fs::read_to_string(dst.join("a").join("a.txt")).unwrap(), "a-content");
        assert_eq!(std::fs::read_to_string(dst.join("a").join("b").join("c.txt")).unwrap(), "deep");
        // Les sources doivent être préservées (la fonction copie, ne déplace pas).
        assert!(src.join("root.txt").exists());
    }

    #[test]
    fn idempotent_on_repeated_calls() {
        let tmp = TempDir::new().unwrap();
        let base = tmp.path();
        write(&base.join("tsgit").join("a.txt"), "data");

        let first = migrate_legacy_dir("tsgit", "mcgit", base).unwrap();
        let second = migrate_legacy_dir("tsgit", "mcgit", base).unwrap();

        assert!(first, "1er appel doit migrer");
        assert!(!second, "2e appel doit être no-op");
        assert_eq!(std::fs::read_to_string(base.join("mcgit").join("a.txt")).unwrap(), "data");
    }
}
