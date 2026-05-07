use git2::{BranchType, Repository};

use crate::error::{AppError, Result};
use crate::git::types::BranchInfo;

fn branch_info(repo: &Repository, branch: &git2::Branch, is_remote: bool) -> Result<BranchInfo> {
    let name = branch.name()?.unwrap_or("").to_string();
    let is_head = branch.is_head();
    let head_oid = branch.get().target().map(|o| o.to_string());

    let (upstream, ahead, behind) = if !is_remote {
        match branch.upstream() {
            Ok(upstream_branch) => {
                let upstream_name = upstream_branch.name()?.unwrap_or("").to_string();
                let local_oid = branch.get().target();
                let remote_oid = upstream_branch.get().target();

                let (ahead, behind) = match (local_oid, remote_oid) {
                    (Some(local), Some(remote)) => {
                        repo.graph_ahead_behind(local, remote).unwrap_or((0, 0))
                    }
                    _ => (0, 0),
                };

                (Some(upstream_name), Some(ahead), Some(behind))
            }
            Err(_) => (None, None, None),
        }
    } else {
        (None, None, None)
    };

    Ok(BranchInfo {
        name,
        is_remote,
        is_head,
        upstream,
        ahead,
        behind,
        head_oid,
    })
}

pub fn list_branches(repo: &Repository, filter: Option<&str>) -> Result<Vec<BranchInfo>> {
    let branch_type = match filter {
        Some("local") => Some(BranchType::Local),
        Some("remote") => Some(BranchType::Remote),
        _ => None,
    };

    let mut branches = Vec::new();
    for branch_result in repo.branches(branch_type)? {
        let (branch, btype) = branch_result?;
        let is_remote = btype == BranchType::Remote;
        if let Ok(info) = branch_info(repo, &branch, is_remote) {
            branches.push(info);
        }
    }
    Ok(branches)
}

pub fn create_branch(repo: &Repository, name: &str, from_ref: &str) -> Result<BranchInfo> {
    let obj = repo.revparse_single(from_ref)?;
    let commit = obj.peel_to_commit()?;
    let mut branch = repo.branch(name, &commit, false)?;
    // REQ-BR-023 — if from_ref resolves to a remote tracking ref, set upstream automatically
    if repo
        .find_reference(&format!("refs/remotes/{from_ref}"))
        .is_ok()
    {
        let _ = branch.set_upstream(Some(from_ref));
    }
    branch_info(repo, &branch, false)
}

pub fn checkout_branch(repo: &Repository, name: &str) -> Result<()> {
    let reference = repo.find_reference(&format!("refs/heads/{name}"))?;
    let obj = reference.peel(git2::ObjectType::Commit)?;

    let mut checkout = git2::build::CheckoutBuilder::new();
    checkout.safe();
    repo.checkout_tree(&obj, Some(&mut checkout))?;
    repo.set_head(&format!("refs/heads/{name}"))?;

    Ok(())
}

pub fn delete_branch(repo: &Repository, name: &str, force: bool) -> Result<()> {
    let mut branch = repo.find_branch(name, BranchType::Local)?;
    if force {
        branch.delete()?;
    } else {
        if branch.is_head() {
            return Err(AppError::Other(
                "Cannot delete the checked-out branch".into(),
            ));
        }
        // Verify branch is fully merged into HEAD before deleting
        let branch_oid = branch
            .get()
            .target()
            .ok_or_else(|| AppError::Other(format!("Branch '{name}' has no direct target")))?;
        let head_oid = repo
            .head()?
            .target()
            .ok_or_else(|| AppError::Other("HEAD has no direct target".into()))?;
        let (ahead, _) = repo.graph_ahead_behind(branch_oid, head_oid)?;
        if ahead > 0 {
            return Err(AppError::BranchNotFullyMerged);
        }
        branch.delete()?;
    }
    Ok(())
}

pub fn rename_branch(repo: &Repository, old_name: &str, new_name: &str) -> Result<BranchInfo> {
    let mut branch = repo.find_branch(old_name, BranchType::Local)?;
    let renamed = branch.rename(new_name, false)?;
    branch_info(repo, &renamed, false)
}

/// REQ-BR-023 — Set (or change) the upstream tracking ref for a local branch.
/// `upstream` is the remote tracking branch name, e.g. `origin/main`.
pub fn set_branch_upstream(
    repo: &Repository,
    branch_name: &str,
    upstream: &str,
) -> Result<BranchInfo> {
    let mut branch = repo.find_branch(branch_name, BranchType::Local)?;
    branch.set_upstream(Some(upstream))?;
    branch_info(repo, &branch, false)
}

/// REQ-BR-024 — Remove the upstream tracking ref from a local branch.
pub fn unset_branch_upstream(repo: &Repository, branch_name: &str) -> Result<BranchInfo> {
    let mut branch = repo.find_branch(branch_name, BranchType::Local)?;
    branch.set_upstream(None)?;
    branch_info(repo, &branch, false)
}

/// Checkout a remote branch by creating a local tracking branch.
/// `remote_branch_name` is the full name as returned by git2, e.g. `origin/feature/login`.
/// The remote prefix is identified by matching against known remotes, so names with
/// multiple slashes (e.g. `origin/feature/a/b`) are handled correctly.
pub fn checkout_remote_branch(repo: &Repository, remote_branch_name: &str) -> Result<BranchInfo> {
    // Identify the remote name by checking all known remotes
    let remotes = repo.remotes()?;
    let remote_name = remotes
        .iter()
        .flatten()
        .find(|r| remote_branch_name.starts_with(&format!("{r}/")))
        .map(|r| r.to_string())
        .ok_or_else(|| {
            AppError::Other(format!("Remote introuvable pour : {remote_branch_name}"))
        })?;

    let local_name = &remote_branch_name[remote_name.len() + 1..];

    if local_name.is_empty() {
        return Err(AppError::Other(format!(
            "Nom de branche invalide : {remote_branch_name}"
        )));
    }

    // If a local branch already exists with that name, just check it out
    if repo.find_branch(local_name, BranchType::Local).is_ok() {
        checkout_branch(repo, local_name)?;
        let existing = repo.find_branch(local_name, BranchType::Local)?;
        return branch_info(repo, &existing, false);
    }

    // Create a local tracking branch from the remote ref
    let refname = format!("refs/remotes/{remote_branch_name}");
    let reference = repo
        .find_reference(&refname)
        .map_err(|_| AppError::Other(format!("Référence remote introuvable : {refname}")))?;
    let commit = reference.peel_to_commit()?;

    let mut new_branch = repo.branch(local_name, &commit, false)?;
    // Set upstream tracking
    let _ = new_branch.set_upstream(Some(remote_branch_name));

    checkout_branch(repo, local_name)?;
    branch_info(repo, &new_branch, false)
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
        // Initial commit so that branches can be created
        let workdir = repo.workdir().unwrap().to_owned();
        std::fs::write(workdir.join("README.md"), "init").unwrap();
        {
            let mut index = repo.index().unwrap();
            index.add_path(std::path::Path::new("README.md")).unwrap();
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
    fn list_branches_after_init_contains_main() {
        let (_tmp, repo) = setup_repo_with_commit();
        let branches = list_branches(&repo, None).unwrap();
        assert!(
            branches.iter().any(|b| !b.is_remote && b.is_head),
            "should have at least one local HEAD branch"
        );
    }

    #[test]
    fn create_and_list_branches() {
        let (_tmp, repo) = setup_repo_with_commit();
        create_branch(&repo, "feature", "HEAD").unwrap();
        let branches = list_branches(&repo, Some("local")).unwrap();
        let names: Vec<_> = branches.iter().map(|b| b.name.as_str()).collect();
        assert!(names.contains(&"feature"), "feature branch should exist");
    }

    #[test]
    fn checkout_branch_changes_head() {
        let (_tmp, repo) = setup_repo_with_commit();
        create_branch(&repo, "dev", "HEAD").unwrap();
        checkout_branch(&repo, "dev").unwrap();
        let head = repo.head().unwrap();
        let name = head.shorthand().unwrap();
        assert_eq!(name, "dev");
    }

    #[test]
    fn rename_branch_changes_name() {
        let (_tmp, repo) = setup_repo_with_commit();
        create_branch(&repo, "old-name", "HEAD").unwrap();
        let renamed = rename_branch(&repo, "old-name", "new-name").unwrap();
        assert_eq!(renamed.name, "new-name");
        let branches = list_branches(&repo, Some("local")).unwrap();
        let names: Vec<_> = branches.iter().map(|b| b.name.as_str()).collect();
        assert!(!names.contains(&"old-name"));
        assert!(names.contains(&"new-name"));
    }

    #[test]
    fn delete_merged_branch_succeeds() {
        let (_tmp, repo) = setup_repo_with_commit();
        create_branch(&repo, "to-delete", "HEAD").unwrap();
        // Branch points to same commit as HEAD → fully merged
        delete_branch(&repo, "to-delete", false).unwrap();
        let branches = list_branches(&repo, Some("local")).unwrap();
        let names: Vec<_> = branches.iter().map(|b| b.name.as_str()).collect();
        assert!(!names.contains(&"to-delete"));
    }

    #[test]
    fn delete_head_branch_fails() {
        let (_tmp, repo) = setup_repo_with_commit();
        let head_name = repo.head().unwrap().shorthand().unwrap().to_string();
        let err = delete_branch(&repo, &head_name, false);
        assert!(err.is_err(), "cannot delete checked-out branch");
    }
}
