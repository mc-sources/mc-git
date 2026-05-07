use git2::{build::CheckoutBuilder, MergeAnalysis, Repository};

use crate::error::{AppError, Result};
use crate::git::commit::create_commit;
use crate::git::types::MergeStatus;

pub fn merge_branch(repo: &Repository, branch_name: &str, no_ff: bool) -> Result<MergeStatus> {
    // Resolve the branch reference to an annotated commit
    let reference = repo
        .find_reference(&format!("refs/heads/{branch_name}"))
        .or_else(|_| repo.find_reference(&format!("refs/remotes/{branch_name}")))?;
    let annotated = repo.reference_to_annotated_commit(&reference)?;

    let (analysis, _) = repo.merge_analysis(&[&annotated])?;

    if analysis.contains(MergeAnalysis::ANALYSIS_UP_TO_DATE) {
        return Err(AppError::Other(format!(
            "La branche '{branch_name}' est déjà fusionnée dans HEAD"
        )));
    }

    if analysis.contains(MergeAnalysis::ANALYSIS_FASTFORWARD) && !no_ff {
        // Fast-forward: move HEAD to the target commit
        let target_oid = annotated.id();
        let target_commit = repo.find_commit(target_oid)?;
        let refname = repo.head()?.name().unwrap_or("HEAD").to_string();
        repo.find_reference(&refname)?.set_target(
            target_oid,
            &format!("Fast-forward merge of branch '{branch_name}'"),
        )?;
        repo.checkout_tree(target_commit.as_object(), None)?;
        repo.set_head(&refname)?;
        return Ok(MergeStatus {
            has_conflicts: false,
            conflict_count: 0,
        });
    }

    // Normal merge (or forced no-ff)
    repo.merge(&[&annotated], None, None)?;

    let mut index = repo.index()?;
    index.read(true)?; // refresh from disk

    if index.has_conflicts() {
        let conflict_count = index.conflicts()?.count();
        return Ok(MergeStatus {
            has_conflicts: true,
            conflict_count,
        });
    }

    // No conflicts — create merge commit automatically
    let head_name = repo.head()?.shorthand().unwrap_or("HEAD").to_string();
    let message = format!("Merge branch '{branch_name}' into {head_name}");
    create_commit(repo, &message)?;

    Ok(MergeStatus {
        has_conflicts: false,
        conflict_count: 0,
    })
}

pub fn abort_merge(repo: &Repository) -> Result<()> {
    let state = repo.state();
    if state != git2::RepositoryState::Merge {
        return Err(AppError::Other("Aucune fusion en cours".into()));
    }
    repo.checkout_head(Some(CheckoutBuilder::new().force()))?;
    repo.cleanup_state()?;
    Ok(())
}

pub fn get_repository_state(repo: &Repository) -> &'static str {
    match repo.state() {
        git2::RepositoryState::Merge => "merge",
        git2::RepositoryState::CherryPick | git2::RepositoryState::CherryPickSequence => {
            "cherry_pick"
        }
        git2::RepositoryState::Rebase
        | git2::RepositoryState::RebaseInteractive
        | git2::RepositoryState::RebaseMerge => "rebase",
        _ => "clean",
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn setup_repo_with_commit() -> (tempfile::TempDir, git2::Repository) {
        let tmp = tempfile::tempdir().unwrap();
        let repo = git2::Repository::init(tmp.path()).unwrap();
        let mut config = repo.config().unwrap();
        config.set_str("user.name", "mcgit test").unwrap();
        config.set_str("user.email", "test@mcgit.local").unwrap();
        drop(config);
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
    fn clean_repo_state() {
        let (_tmp, repo) = setup_repo_with_commit();
        assert_eq!(get_repository_state(&repo), "clean");
    }

    #[test]
    fn merge_state_detected_via_merge_head() {
        let (_tmp, repo) = setup_repo_with_commit();
        let git_dir = repo.path();
        let oid = repo.head().unwrap().target().unwrap();
        std::fs::write(git_dir.join("MERGE_HEAD"), format!("{oid}\n")).unwrap();
        assert_eq!(get_repository_state(&repo), "merge");
    }

    #[test]
    fn cherry_pick_state_detected() {
        let (_tmp, repo) = setup_repo_with_commit();
        let git_dir = repo.path();
        let oid = repo.head().unwrap().target().unwrap();
        std::fs::write(git_dir.join("CHERRY_PICK_HEAD"), format!("{oid}\n")).unwrap();
        assert_eq!(get_repository_state(&repo), "cherry_pick");
    }

    #[test]
    fn rebase_state_detected_via_rebase_merge_dir() {
        let (_tmp, repo) = setup_repo_with_commit();
        let git_dir = repo.path();
        std::fs::create_dir_all(git_dir.join("rebase-merge")).unwrap();
        std::fs::write(git_dir.join("rebase-merge/head-name"), "refs/heads/main").unwrap();
        assert_eq!(get_repository_state(&repo), "rebase");
    }
}
