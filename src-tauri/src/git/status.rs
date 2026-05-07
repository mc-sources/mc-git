use git2::{Repository, Status, StatusOptions};

use crate::error::Result;
use crate::git::types::{FileStatusKind, StatusEntry};

fn status_kind(s: Status, staged: bool) -> FileStatusKind {
    if staged {
        if s.contains(Status::INDEX_NEW) {
            FileStatusKind::Added
        } else if s.contains(Status::INDEX_MODIFIED) {
            FileStatusKind::Modified
        } else if s.contains(Status::INDEX_DELETED) {
            FileStatusKind::Deleted
        } else if s.contains(Status::INDEX_RENAMED) {
            FileStatusKind::Renamed
        } else if s.contains(Status::CONFLICTED) {
            FileStatusKind::Conflicted
        } else {
            FileStatusKind::Modified
        }
    } else if s.contains(Status::WT_NEW) {
        FileStatusKind::Untracked
    } else if s.contains(Status::WT_MODIFIED) {
        FileStatusKind::Modified
    } else if s.contains(Status::WT_DELETED) {
        FileStatusKind::Deleted
    } else if s.contains(Status::WT_RENAMED) {
        FileStatusKind::Renamed
    } else if s.contains(Status::CONFLICTED) {
        FileStatusKind::Conflicted
    } else if s.contains(Status::IGNORED) {
        FileStatusKind::Ignored
    } else {
        FileStatusKind::Modified
    }
}

fn is_staged(s: Status) -> bool {
    s.intersects(
        Status::INDEX_NEW
            | Status::INDEX_MODIFIED
            | Status::INDEX_DELETED
            | Status::INDEX_RENAMED
            | Status::INDEX_TYPECHANGE,
    )
}

fn is_unstaged(s: Status) -> bool {
    s.intersects(
        Status::WT_NEW
            | Status::WT_MODIFIED
            | Status::WT_DELETED
            | Status::WT_RENAMED
            | Status::WT_TYPECHANGE
            | Status::CONFLICTED,
    )
}

pub fn list_tracked_files(repo: &Repository) -> Result<Vec<String>> {
    let index = repo.index()?;
    let paths = index
        .iter()
        .map(|e| String::from_utf8_lossy(&e.path).to_string())
        .collect();
    Ok(paths)
}

pub fn get_status(repo: &Repository) -> Result<Vec<StatusEntry>> {
    let mut opts = StatusOptions::new();
    opts.include_untracked(true)
        .recurse_untracked_dirs(true)
        .include_ignored(false)
        .renames_head_to_index(true)
        .renames_index_to_workdir(true);

    let statuses = repo.statuses(Some(&mut opts))?;
    let mut entries = Vec::new();

    for entry in statuses.iter() {
        let s = entry.status();
        let path = entry.path().unwrap_or("").to_string();

        let old_path = entry
            .head_to_index()
            .and_then(|d| d.old_file().path())
            .map(|p| p.to_string_lossy().to_string())
            .filter(|p| p != &path);

        if is_staged(s) || is_unstaged(s) {
            entries.push(StatusEntry {
                path,
                old_path,
                staged: if is_staged(s) {
                    status_kind(s, true)
                } else {
                    FileStatusKind::Clean
                },
                unstaged: if is_unstaged(s) {
                    status_kind(s, false)
                } else {
                    FileStatusKind::Clean
                },
            });
        }
    }

    Ok(entries)
}

pub fn stage_file(repo: &Repository, path: &str) -> Result<()> {
    let mut index = repo.index()?;
    index.add_path(std::path::Path::new(path))?;
    index.write()?;
    Ok(())
}

pub fn unstage_file(repo: &Repository, path: &str) -> Result<()> {
    // Reset the index entry to HEAD (or remove if new file)
    let head = repo.head().ok().and_then(|h| h.target());
    if let Some(oid) = head {
        let obj = repo.find_object(oid, None)?;
        repo.reset_default(Some(&obj), [path])?;
    } else {
        // No HEAD yet — just remove from index
        let mut index = repo.index()?;
        index.remove_path(std::path::Path::new(path))?;
        index.write()?;
    }
    Ok(())
}

pub fn stage_paths(repo: &Repository, paths: &[&str]) -> Result<()> {
    let mut index = repo.index()?;
    for path in paths {
        index.add_path(std::path::Path::new(path))?;
    }
    index.write()?;
    Ok(())
}

pub fn unstage_paths(repo: &Repository, paths: &[&str]) -> Result<()> {
    let head = repo.head().ok().and_then(|h| h.target());
    if let Some(oid) = head {
        let obj = repo.find_object(oid, None)?;
        repo.reset_default(Some(&obj), paths.iter().copied())?;
    } else {
        let mut index = repo.index()?;
        for path in paths {
            index.remove_path(std::path::Path::new(path))?;
        }
        index.write()?;
    }
    Ok(())
}

pub fn stage_all(repo: &Repository) -> Result<()> {
    let mut index = repo.index()?;
    index.add_all(["*"].iter(), git2::IndexAddOption::DEFAULT, None)?;
    index.write()?;
    Ok(())
}

pub fn unstage_all(repo: &Repository) -> Result<()> {
    let head = repo.head().ok().and_then(|h| h.target());
    if let Some(oid) = head {
        let obj = repo.find_object(oid, None)?;
        repo.reset(&obj, git2::ResetType::Mixed, None)?;
    } else {
        let mut index = repo.index()?;
        index.clear()?;
        index.write()?;
    }
    Ok(())
}

pub fn write_and_stage_file(repo: &Repository, path: &str, content: &str) -> Result<()> {
    let workdir = repo
        .workdir()
        .ok_or_else(|| crate::error::AppError::Other("No working directory".into()))?;
    let full_path = workdir.join(path);
    std::fs::write(&full_path, content)
        .map_err(|e| crate::error::AppError::Other(e.to_string()))?;

    // Clean up any ~HEAD / ~BRANCH files left by an "added by both" (AA) conflict.
    if let (Some(parent), Some(filename)) = (
        full_path.parent(),
        std::path::Path::new(path)
            .file_name()
            .map(|n| n.to_string_lossy().to_string()),
    ) {
        let prefix = format!("{filename}~");
        if let Ok(entries) = std::fs::read_dir(parent) {
            for entry in entries.flatten() {
                if entry.file_name().to_string_lossy().starts_with(&prefix) {
                    let _ = std::fs::remove_file(entry.path());
                }
            }
        }
    }

    stage_file(repo, path)
}

pub fn discard_changes(repo: &Repository, path: &str) -> Result<()> {
    let workdir = repo
        .workdir()
        .ok_or_else(|| crate::error::AppError::Other("Pas de répertoire de travail".into()))?;

    // Check if the file is untracked (no index entry at any stage).
    // If repo.index() fails (e.g. corrupt NAME extension in conflict state), assume tracked.
    let is_untracked = match repo.index() {
        Ok(index) => {
            let p = std::path::Path::new(path);
            index.get_path(p, 0).is_none()
                && index.get_path(p, 1).is_none()
                && index.get_path(p, 2).is_none()
                && index.get_path(p, 3).is_none()
        }
        Err(_) => false,
    };

    if is_untracked {
        // Untracked file — discard = delete from disk
        std::fs::remove_file(workdir.join(path)).map_err(crate::error::AppError::Io)?;
        return Ok(());
    }

    // Try libgit2 first; fall back to git CLI on the corrupt-NAME-extension failure
    // that can occur in certain conflict states.
    let mut cb = git2::build::CheckoutBuilder::new();
    cb.path(path).force().update_index(true);
    if repo.checkout_index(None, Some(&mut cb)).is_ok() {
        return Ok(());
    }

    // libgit2 fallback: git CLI
    if !crate::git::git_available() {
        return Err(crate::error::AppError::Other(format!(
            "Impossible d'annuler les modifications de « {path} » : git n'est pas installé sur ce système et libgit2 n'a pas pu effectuer l'opération (état d'index corrompu)."
        )));
    }
    let output = std::process::Command::new("git")
        .args(["checkout", "--", path])
        .current_dir(workdir)
        .output()
        .map_err(crate::error::AppError::Io)?;
    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(crate::error::AppError::Other(format!(
            "Impossible d'annuler les modifications de {path} : {stderr}"
        )));
    }
    Ok(())
}

/// Discard all unstaged changes in the working directory:
/// - Tracked modified/deleted files restored to their index state (`git checkout -- .`)
/// - Untracked files and directories removed (`git clean -fd`)
pub fn discard_all(repo: &Repository) -> Result<()> {
    let workdir = repo
        .workdir()
        .ok_or_else(|| crate::error::AppError::Other("Pas de répertoire de travail".into()))?;

    // Restore all tracked modified/deleted files to their index state.
    let mut cb = git2::build::CheckoutBuilder::new();
    cb.force().update_index(true);
    repo.checkout_index(None, Some(&mut cb)).map_err(|e| {
        crate::error::AppError::Other(format!("Impossible d'annuler les modifications : {e}"))
    })?;

    // Remove untracked files and directories.
    let statuses = repo
        .statuses(None)
        .map_err(|e| crate::error::AppError::Other(e.to_string()))?;
    for entry in statuses.iter() {
        if entry.status().contains(git2::Status::WT_NEW) {
            if let Some(rel) = entry.path() {
                let full = workdir.join(rel);
                if full.is_dir() {
                    let _ = std::fs::remove_dir_all(&full);
                } else {
                    let _ = std::fs::remove_file(&full);
                }
            }
        }
    }

    Ok(())
}

/// Resolve a "deleted by them" (UD) conflict by accepting their deletion.
/// Removes the file from disk and from the index (`git rm -- <path>`).
pub fn resolve_deletion_accept_theirs(repo: &Repository, path: &str) -> Result<()> {
    let workdir = repo
        .workdir()
        .ok_or_else(|| crate::error::AppError::Other("Pas de répertoire de travail".into()))?;
    // Remove all stage entries (0/1/2/3) from the index then delete from disk.
    let mut index = repo.index()?;
    let p = std::path::Path::new(path);
    for stage in 0i32..=3 {
        let _ = index.remove(p, stage);
    }
    index.write()?;
    let _ = std::fs::remove_file(workdir.join(path));
    Ok(())
}

/// Resolve a "deleted by them" (UD) conflict by keeping our version.
/// Stages the file as-is (`git add -- <path>`), which clears the conflict stages.
pub fn resolve_deletion_keep_ours(repo: &Repository, path: &str) -> Result<()> {
    stage_file(repo, path)
}

/// Restore conflict markers for a single file (equivalent to `git checkout --conflict=merge -- <path>`).
pub fn reset_conflict_file(repo: &Repository, path: &str) -> Result<()> {
    if !crate::git::git_available() {
        return Err(crate::error::AppError::Other(
            "La réinitialisation des marqueurs de conflit nécessite git installé sur ce système."
                .into(),
        ));
    }
    let workdir = repo
        .workdir()
        .ok_or_else(|| crate::error::AppError::Other("Pas de répertoire de travail".into()))?;
    let output = std::process::Command::new("git")
        .args(["checkout", "--conflict=merge", "--", path])
        .current_dir(workdir)
        .output()
        .map_err(crate::error::AppError::Io)?;
    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(crate::error::AppError::Other(format!(
            "Impossible de réinitialiser {path} : {stderr}"
        )));
    }
    Ok(())
}

/// Restore conflict markers for every currently-conflicted file, without aborting the merge.
///
/// Strategy: enumerate files with stage 1/2/3 entries via `git ls-files --unmerged`, then
/// call `git checkout --conflict=merge -- <path>` for each. This preserves the original index
/// stage entries and MERGE_HEAD untouched — the result is identical to the post-pull state.
///
/// Previous approaches (abort + re-merge) failed because re-merging a rename conflict produces
/// a different result than the original merge (the NAME index extension is not reproduced).
pub fn reset_all_conflict_files(repo: &Repository) -> Result<()> {
    if !crate::git::git_available() {
        return Err(crate::error::AppError::Other(
            "La réinitialisation des marqueurs de conflit nécessite git installé sur ce système."
                .into(),
        ));
    }
    let workdir = repo
        .workdir()
        .ok_or_else(|| crate::error::AppError::Other("Pas de répertoire de travail".into()))?;

    // Collect unique paths that have unmerged stage entries (1/2/3).
    // Output format: "<mode> <hash> <stage>\t<path>\n"  — tab before path, safe for spaces.
    let ls = std::process::Command::new("git")
        .args(["ls-files", "--unmerged"])
        .current_dir(workdir)
        .output()
        .map_err(crate::error::AppError::Io)?;

    let content = String::from_utf8_lossy(&ls.stdout);
    let mut paths: std::collections::BTreeSet<String> = std::collections::BTreeSet::new();
    for line in content.lines() {
        // "<mode> <hash> <stage>\t<path>"
        if let Some(path) = line.split('\t').nth(1) {
            paths.insert(path.to_string());
        }
    }

    if paths.is_empty() {
        return Err(crate::error::AppError::Other(
            "Aucun fichier en conflit trouvé".into(),
        ));
    }

    // Restore conflict markers for each file. Individual failures are ignored so that
    // "deleted by us/them" files (no content to mark up) don't abort the whole reset.
    for path in &paths {
        let _ = std::process::Command::new("git")
            .args(["checkout", "--conflict=merge", "--", path.as_str()])
            .current_dir(workdir)
            .output();
    }

    Ok(())
}

/// Resolve a "deleted by us" conflict by accepting our deletion.
/// Equivalent to `git rm --cached -- <path>`.
pub fn resolve_deletion_accept(repo: &Repository, path: &str) -> Result<()> {
    // Remove all stage entries from the index only (keep file on disk).
    let mut index = repo.index()?;
    let p = std::path::Path::new(path);
    for stage in 0i32..=3 {
        let _ = index.remove(p, stage);
    }
    index.write()?;
    Ok(())
}

/// Restore conflict markers for a file that was already staged (resolved) during a merge.
///
/// Reconstructs index stages 1/2/3 from the ancestor (merge-base), HEAD, and MERGE_HEAD, then
/// calls `git checkout --conflict=merge -- <path>`. This is the inverse of "mark as resolved":
/// it lets the user go back to the conflict-marker state to redo their resolution.
pub fn reset_staged_conflict_file(repo: &Repository, path: &str) -> Result<()> {
    if !crate::git::git_available() {
        return Err(crate::error::AppError::Other(
            "La réinitialisation d'un conflit déjà résolu nécessite git installé sur ce système."
                .into(),
        ));
    }
    use std::io::Write;

    let workdir = repo
        .workdir()
        .ok_or_else(|| crate::error::AppError::Other("Pas de répertoire de travail".into()))?;

    // Require an active merge
    if !repo.path().join("MERGE_HEAD").exists() {
        return Err(crate::error::AppError::Other("Aucun merge en cours".into()));
    }

    // Compute merge base
    let mb = std::process::Command::new("git")
        .args(["merge-base", "HEAD", "MERGE_HEAD"])
        .current_dir(workdir)
        .output()
        .map_err(crate::error::AppError::Io)?;
    if !mb.status.success() {
        return Err(crate::error::AppError::Other(
            "Impossible de trouver la base de fusion".into(),
        ));
    }
    let merge_base = String::from_utf8_lossy(&mb.stdout).trim().to_string();

    // Helper: get (mode, blob-hash) for a path in a given tree ref.
    // Output format: "<mode> blob <hash>\t<name>"
    let tree_entry = |tree_ref: &str| -> Option<(String, String)> {
        let out = std::process::Command::new("git")
            .args(["ls-tree", tree_ref, "--", path])
            .current_dir(workdir)
            .output()
            .ok()?;
        if !out.status.success() || out.stdout.is_empty() {
            return None;
        }
        let line = String::from_utf8_lossy(&out.stdout);
        let line = line.trim();
        let mut parts = line.splitn(3, ' ');
        let mode = parts.next()?.to_string();
        let _type = parts.next()?; // "blob"
        let rest = parts.next()?; // "<hash>\t<name>"
        let hash = rest.split('\t').next()?.trim().to_string();
        Some((mode, hash))
    };

    // Build index-info: stage 1 = ancestor, 2 = ours (HEAD), 3 = theirs (MERGE_HEAD)
    let mut index_info = String::new();
    if let Some((mode, hash)) = tree_entry(&merge_base) {
        index_info.push_str(&format!("{mode} {hash} 1\t{path}\n"));
    }
    if let Some((mode, hash)) = tree_entry("HEAD") {
        index_info.push_str(&format!("{mode} {hash} 2\t{path}\n"));
    }
    if let Some((mode, hash)) = tree_entry("MERGE_HEAD") {
        index_info.push_str(&format!("{mode} {hash} 3\t{path}\n"));
    }

    if index_info.is_empty() {
        return Err(crate::error::AppError::Other(format!(
            "Impossible de reconstruire les étapes de conflit pour {path}"
        )));
    }

    // Remove the resolved (stage 0) entry from the index
    std::process::Command::new("git")
        .args(["rm", "--cached", "--force", "--quiet", "--", path])
        .current_dir(workdir)
        .output()
        .map_err(crate::error::AppError::Io)?;

    // Restore stages 1/2/3 via git update-index --index-info
    let mut child = std::process::Command::new("git")
        .args(["update-index", "--index-info"])
        .current_dir(workdir)
        .stdin(std::process::Stdio::piped())
        .spawn()
        .map_err(crate::error::AppError::Io)?;
    if let Some(mut stdin) = child.stdin.take() {
        stdin
            .write_all(index_info.as_bytes())
            .map_err(crate::error::AppError::Io)?;
    }
    child.wait().map_err(crate::error::AppError::Io)?;

    // Rewrite working-tree file with conflict markers
    let out = std::process::Command::new("git")
        .args(["checkout", "--conflict=merge", "--", path])
        .current_dir(workdir)
        .output()
        .map_err(crate::error::AppError::Io)?;
    if !out.status.success() {
        let stderr = String::from_utf8_lossy(&out.stderr);
        return Err(crate::error::AppError::Other(format!(
            "Impossible de réinitialiser {path} : {stderr}"
        )));
    }

    Ok(())
}

/// Resolve a "deleted by us" conflict by restoring the remote version.
/// Equivalent to `git checkout MERGE_HEAD -- <path>` (restores file and stages it).
pub fn resolve_deletion_restore(repo: &Repository, path: &str) -> Result<()> {
    let workdir = repo
        .workdir()
        .ok_or_else(|| crate::error::AppError::Other("Pas de répertoire de travail".into()))?;

    // Read MERGE_HEAD OID from the .git/MERGE_HEAD file.
    let merge_head_file = repo.path().join("MERGE_HEAD");
    let merge_head_str = std::fs::read_to_string(&merge_head_file).map_err(|_| {
        crate::error::AppError::Other("Aucun merge en cours (MERGE_HEAD absent)".into())
    })?;
    let merge_head_oid = merge_head_str
        .trim()
        .parse::<git2::Oid>()
        .map_err(|_| crate::error::AppError::Other("OID MERGE_HEAD invalide".into()))?;

    // Get the file's blob from the MERGE_HEAD tree.
    let merge_commit = repo.find_commit(merge_head_oid)?;
    let tree = merge_commit.tree()?;
    let entry = tree.get_path(std::path::Path::new(path)).map_err(|_| {
        crate::error::AppError::Other(format!("Fichier « {path} » introuvable dans MERGE_HEAD"))
    })?;
    let blob = repo.find_blob(entry.id())?;

    // Write to disk and stage.
    let full = workdir.join(path);
    if let Some(parent) = full.parent() {
        std::fs::create_dir_all(parent).map_err(crate::error::AppError::Io)?;
    }
    std::fs::write(&full, blob.content()).map_err(crate::error::AppError::Io)?;
    stage_file(repo, path)
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    fn setup_repo_with_commit() -> (TempDir, git2::Repository) {
        let tmp = tempfile::tempdir().unwrap();
        let repo = git2::Repository::init(tmp.path()).unwrap();
        let mut config = repo.config().unwrap();
        config.set_str("user.name", "mcgit test").unwrap();
        config.set_str("user.email", "test@mcgit.local").unwrap();
        drop(config);
        // Initial commit
        let workdir = repo.workdir().unwrap().to_owned();
        std::fs::write(workdir.join("init.txt"), "init").unwrap();
        {
            let mut index = repo.index().unwrap();
            index.add_path(std::path::Path::new("init.txt")).unwrap();
            index.write().unwrap();
            let tree_oid = index.write_tree().unwrap();
            let tree = repo.find_tree(tree_oid).unwrap();
            let sig = repo.signature().unwrap();
            repo.commit(Some("HEAD"), &sig, &sig, "init", &tree, &[])
                .unwrap();
        }
        (tmp, repo)
    }

    #[test]
    fn clean_repo_has_empty_status() {
        let (_tmp, repo) = setup_repo_with_commit();
        let entries = get_status(&repo).unwrap();
        assert!(
            entries.is_empty(),
            "clean repo should have no status entries"
        );
    }

    #[test]
    fn untracked_file_appears_in_status() {
        let (_tmp, repo) = setup_repo_with_commit();
        let workdir = repo.workdir().unwrap();
        std::fs::write(workdir.join("new.txt"), "hello").unwrap();
        let entries = get_status(&repo).unwrap();
        assert_eq!(entries.len(), 1);
        assert_eq!(entries[0].path, "new.txt");
        assert_eq!(entries[0].unstaged, FileStatusKind::Untracked);
        assert_eq!(entries[0].staged, FileStatusKind::Clean);
    }

    #[test]
    fn stage_file_moves_to_staged() {
        let (_tmp, repo) = setup_repo_with_commit();
        let workdir = repo.workdir().unwrap();
        std::fs::write(workdir.join("new.txt"), "hello").unwrap();
        stage_file(&repo, "new.txt").unwrap();
        let entries = get_status(&repo).unwrap();
        assert_eq!(entries.len(), 1);
        assert_eq!(entries[0].staged, FileStatusKind::Added);
    }

    #[test]
    fn unstage_file_reverts_to_unstaged() {
        let (_tmp, repo) = setup_repo_with_commit();
        let workdir = repo.workdir().unwrap();
        std::fs::write(workdir.join("new.txt"), "hello").unwrap();
        stage_file(&repo, "new.txt").unwrap();
        unstage_file(&repo, "new.txt").unwrap();
        let entries = get_status(&repo).unwrap();
        assert_eq!(entries.len(), 1);
        assert_eq!(entries[0].staged, FileStatusKind::Clean);
        assert_eq!(entries[0].unstaged, FileStatusKind::Untracked);
    }

    #[test]
    fn modified_committed_file_shows_modified() {
        let (_tmp, repo) = setup_repo_with_commit();
        let workdir = repo.workdir().unwrap();
        std::fs::write(workdir.join("init.txt"), "changed").unwrap();
        let entries = get_status(&repo).unwrap();
        assert_eq!(entries.len(), 1);
        assert_eq!(entries[0].path, "init.txt");
        assert_eq!(entries[0].unstaged, FileStatusKind::Modified);
    }

    #[test]
    fn discard_changes_restores_file() {
        let (_tmp, repo) = setup_repo_with_commit();
        let workdir = repo.workdir().unwrap().to_owned();
        std::fs::write(workdir.join("init.txt"), "changed").unwrap();
        discard_changes(&repo, "init.txt").unwrap();
        let content = std::fs::read_to_string(workdir.join("init.txt")).unwrap();
        assert_eq!(
            content, "init",
            "file should be restored to committed content"
        );
        let entries = get_status(&repo).unwrap();
        assert!(entries.is_empty(), "status should be clean after discard");
    }

    #[test]
    fn list_tracked_files_returns_committed_files() {
        let (_tmp, repo) = setup_repo_with_commit();
        let files = list_tracked_files(&repo).unwrap();
        assert_eq!(files, vec!["init.txt"]);
    }
}
