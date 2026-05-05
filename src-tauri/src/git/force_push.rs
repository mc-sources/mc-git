use std::path::Path;

use crate::error::{AppError, Result};

/// Executes `git push --force-with-lease` via the system `git` binary.
///
/// Both `Git2Repository` and `CliGitRepository` delegate here, since
/// libgit2 does not support the `--force-with-lease` flag natively.
///
/// Guarded by `crate::git::git_available()` per the CLI git policy
/// documented in `docs/specifications/techniques/conventions-codage.md`:
/// if `git` is not installed on the system, returns an explicit
/// `AppError::Other` rather than producing an obscure IO error.
pub fn push_force_with_lease(workdir: &Path, remote: &str, branch: &str) -> Result<()> {
    if !crate::git::git_available() {
        return Err(AppError::Other(
            "Le push avec --force-with-lease nécessite git installé sur ce système : libgit2 ne supporte pas ce flag nativement.".into(),
        ));
    }
    let output = std::process::Command::new("git")
        .args(["push", "--force-with-lease", remote, branch])
        .current_dir(workdir)
        .env("LC_ALL", "C")
        .env("GIT_TERMINAL_PROMPT", "0")
        .output()
        .map_err(|e| AppError::Other(format!("git introuvable : {e}")))?;
    if output.status.success() {
        Ok(())
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr);
        Err(AppError::Other(stderr.trim().to_string()))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn force_push_to_nonexistent_remote_errors_cleanly() {
        // Skip if git binary is not available
        if !crate::git::git_available() {
            eprintln!("git not available, skipping force_push test");
            return;
        }
        let tmp = tempfile::tempdir().unwrap();
        let repo = git2::Repository::init(tmp.path()).unwrap();
        let mut config = repo.config().unwrap();
        config.set_str("user.name", "mcgit test").unwrap();
        config.set_str("user.email", "test@mcgit.local").unwrap();
        drop(config);
        let workdir = repo.workdir().unwrap().to_owned();
        std::fs::write(workdir.join("file.txt"), "x").unwrap();
        let mut index = repo.index().unwrap();
        index.add_path(std::path::Path::new("file.txt")).unwrap();
        index.write().unwrap();
        let tree_oid = index.write_tree().unwrap();
        let tree = repo.find_tree(tree_oid).unwrap();
        let sig = repo.signature().unwrap();
        repo.commit(Some("HEAD"), &sig, &sig, "init", &tree, &[]).unwrap();

        let err = push_force_with_lease(tmp.path(), "nonexistent", "main");
        assert!(
            err.is_err(),
            "push to nonexistent remote should fail"
        );
    }
}
