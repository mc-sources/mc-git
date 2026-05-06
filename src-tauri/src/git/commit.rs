use git2::Repository;

use crate::error::{AppError, Result};
use crate::git::gpg::gpg_sign;
use crate::git::types::{CommitSummary, Signature};

pub fn convert_signature(sig: &git2::Signature) -> Signature {
    Signature {
        name: sig.name().unwrap_or("").to_string(),
        email: sig.email().unwrap_or("").to_string(),
        when: sig.when().seconds(),
    }
}

pub fn commit_to_summary(commit: &git2::Commit) -> CommitSummary {
    let oid = commit.id();
    let author = convert_signature(&commit.author());
    let committer = convert_signature(&commit.committer());
    let parent_oids = commit.parent_ids().map(|id| id.to_string()).collect();
    CommitSummary {
        oid: oid.to_string(),
        short_oid: oid.to_string()[..7].to_string(),
        summary: commit.summary().unwrap_or("").to_string(),
        author,
        committer,
        parent_oids,
    }
}

pub fn create_commit(repo: &Repository, message: &str) -> Result<CommitSummary> {
    let mut index = repo.index()?;
    let tree_oid = index.write_tree()?;
    let tree = repo.find_tree(tree_oid)?;

    let sig = repo.signature()?;

    let head_commit = repo.head().ok().and_then(|h| {
        h.target()
            .and_then(|oid| repo.find_commit(oid).ok())
    });

    // Include MERGE_HEAD as second parent for merge commits so that:
    //   (a) a proper two-parent merge commit is created, and
    //   (b) libgit2 cleans up MERGE_HEAD / merge state automatically.
    let merge_head_commit = if repo.state() == git2::RepositoryState::Merge {
        repo.find_reference("MERGE_HEAD")
            .ok()
            .and_then(|r| r.target())
            .and_then(|oid| repo.find_commit(oid).ok())
    } else {
        None
    };

    let mut parents: Vec<&git2::Commit> = head_commit.iter().collect();
    if let Some(ref mc) = merge_head_commit {
        parents.push(mc);
    }

    // GPG signing if commit.gpgsign = true in git config
    let gpg_enabled = repo
        .config()
        .ok()
        .and_then(|c| c.get_bool("commit.gpgsign").ok())
        .unwrap_or(false);

    let oid = if gpg_enabled {
        let signing_key = repo
            .config()
            .ok()
            .and_then(|c| c.get_string("user.signingkey").ok());

        let buf = repo.commit_create_buffer(&sig, &sig, message, &tree, &parents)?;
        let buf_str = std::str::from_utf8(&buf)
            .map_err(|e| AppError::Other(format!("Commit buffer encoding: {e}")))?;

        let signature = gpg_sign(buf_str, signing_key.as_deref())?;
        let signed_oid = repo.commit_signed(buf_str, &signature, Some("gpgsig"))?;

        // commit_signed does not update HEAD — do it manually.
        let head_ref = repo.head()?;
        if head_ref.is_branch() {
            let refname = head_ref
                .name()
                .ok_or_else(|| AppError::Other("Invalid HEAD ref name".into()))?
                .to_string();
            repo.find_reference(&refname)?
                .set_target(signed_oid, "commit: (gpg signed)")?;
        } else {
            repo.set_head_detached(signed_oid)?;
        }

        signed_oid
    } else {
        repo.commit(Some("HEAD"), &sig, &sig, message, &tree, &parents)?
    };

    // Ensure merge state is fully cleaned up (MERGE_HEAD, MERGE_MSG, etc.)
    if merge_head_commit.is_some() {
        let _ = repo.cleanup_state();
    }

    let commit = repo.find_commit(oid)?;
    Ok(commit_to_summary(&commit))
}

pub fn amend_commit(repo: &Repository, message: &str) -> Result<CommitSummary> {
    let head = repo.head()?;
    let oid = head.target().ok_or_else(|| AppError::Other("HEAD has no target".into()))?;
    let head_commit = repo.find_commit(oid)?;

    let mut index = repo.index()?;
    let tree_oid = index.write_tree()?;
    let tree = repo.find_tree(tree_oid)?;

    let sig = repo.signature()?;

    let new_oid = head_commit.amend(
        Some("HEAD"),
        Some(&sig),
        Some(&sig),
        None,
        Some(message),
        Some(&tree),
    )?;
    let commit = repo.find_commit(new_oid)?;
    Ok(commit_to_summary(&commit))
}

pub fn get_head_commit(repo: &Repository) -> Result<CommitSummary> {
    let head = repo.head()?;
    let oid = head.target().ok_or_else(|| AppError::Other("HEAD has no target".into()))?;
    let commit = repo.find_commit(oid)?;
    Ok(commit_to_summary(&commit))
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    /// Minimal inline test fixture. No shared helper across modules: the full
    /// TestRepo lives only in `src-tauri/tests/common/mod.rs` for integration
    /// tests. Unit tests stay self-contained per module with a local
    /// `setup_repo()`.
    fn setup_repo() -> (TempDir, git2::Repository) {
        let tmp = tempfile::tempdir().unwrap();
        let repo = git2::Repository::init(tmp.path()).unwrap();
        let mut config = repo.config().unwrap();
        config.set_str("user.name", "mcgit test").unwrap();
        config.set_str("user.email", "test@mcgit.local").unwrap();
        drop(config);
        (tmp, repo)
    }

    fn write_and_stage(repo: &git2::Repository, filename: &str, content: &str) {
        let workdir = repo.workdir().unwrap();
        std::fs::write(workdir.join(filename), content).unwrap();
        let mut index = repo.index().unwrap();
        index.add_path(std::path::Path::new(filename)).unwrap();
        index.write().unwrap();
    }

    #[test]
    fn create_commit_on_empty_repo_creates_initial_commit() {
        let (_tmp, repo) = setup_repo();
        write_and_stage(&repo, "README.md", "hello");
        let summary = create_commit(&repo, "init").unwrap();
        assert_eq!(summary.summary, "init");
        assert!(
            summary.parent_oids.is_empty(),
            "initial commit should have no parents, got {:?}",
            summary.parent_oids
        );
        assert_eq!(summary.short_oid.len(), 7);
        assert_eq!(summary.author.name, "mcgit test");
        assert_eq!(summary.author.email, "test@mcgit.local");
    }

    #[test]
    fn create_commit_second_has_first_as_parent() {
        let (_tmp, repo) = setup_repo();
        write_and_stage(&repo, "a.txt", "1");
        let first = create_commit(&repo, "first").unwrap();
        write_and_stage(&repo, "b.txt", "2");
        let second = create_commit(&repo, "second").unwrap();
        assert_eq!(second.parent_oids.len(), 1);
        assert_eq!(second.parent_oids[0], first.oid);
        assert_ne!(first.oid, second.oid);
    }

    #[test]
    fn get_head_commit_on_empty_repo_errors() {
        let (_tmp, repo) = setup_repo();
        assert!(
            get_head_commit(&repo).is_err(),
            "empty repo should have no HEAD commit"
        );
    }

    #[test]
    fn get_head_commit_returns_summary_after_commit() {
        let (_tmp, repo) = setup_repo();
        write_and_stage(&repo, "x.txt", "x");
        let committed = create_commit(&repo, "msg").unwrap();
        let fetched = get_head_commit(&repo).unwrap();
        assert_eq!(fetched.oid, committed.oid);
        assert_eq!(fetched.summary, "msg");
    }

    #[test]
    fn amend_commit_updates_message_and_oid() {
        let (_tmp, repo) = setup_repo();
        write_and_stage(&repo, "x.txt", "x");
        let first = create_commit(&repo, "original").unwrap();
        let amended = amend_commit(&repo, "amended").unwrap();
        assert_eq!(amended.summary, "amended");
        assert_ne!(
            amended.oid, first.oid,
            "amended commit should have a different OID"
        );
        assert!(
            amended.parent_oids.is_empty(),
            "amended initial commit should still have no parents"
        );
    }
}
