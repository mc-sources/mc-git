use git2::{build::CheckoutBuilder, Repository, RepositoryState};

use crate::error::{AppError, Result};
use crate::git::commit::{commit_to_summary, create_commit};
use crate::git::types::{CherryPickStatus, CommitSummary};

pub fn cherry_pick(repo: &Repository, oid_str: &str) -> Result<CherryPickStatus> {
    // Require clean state
    if repo.state() != RepositoryState::Clean {
        return Err(AppError::Other(
            "Le dépôt n'est pas dans un état propre (merge, cherry-pick ou rebase en cours)".into(),
        ));
    }

    let oid = git2::Oid::from_str(oid_str)?;
    let commit = repo.find_commit(oid)?;

    // Reject merge commits
    if commit.parent_count() > 1 {
        return Err(AppError::Other(
            "Cherry-pick d'un commit de fusion non supporté (plusieurs parents)".into(),
        ));
    }

    let oid_short = oid.to_string();
    let oid_short = &oid_short[..7.min(oid_short.len())];
    let message = commit
        .message()
        .filter(|m| !m.trim().is_empty())
        .map(|m| m.to_string())
        .unwrap_or_else(|| format!("cherry-pick {oid_short}"));

    // Apply the cherry-pick (modifies workdir + index)
    repo.cherrypick(&commit, None)?;

    let mut index = repo.index()?;
    index.read(true)?; // refresh from disk

    if index.has_conflicts() {
        let conflict_count = index.conflicts()?.count();
        return Ok(CherryPickStatus { has_conflicts: true, conflict_count });
    }

    // No conflicts — auto-commit then clean up state
    create_commit(repo, &message)?;
    repo.cleanup_state()?;

    Ok(CherryPickStatus { has_conflicts: false, conflict_count: 0 })
}

pub fn continue_cherry_pick(repo: &Repository) -> Result<CommitSummary> {
    let state = repo.state();
    if state != RepositoryState::CherryPick && state != RepositoryState::CherryPickSequence {
        return Err(AppError::Other("Aucun cherry-pick en cours".into()));
    }

    let mut index = repo.index()?;
    index.read(true)?;
    if index.has_conflicts() {
        return Err(AppError::Other(
            "Des conflits sont encore présents — résolvez-les avant de continuer".into(),
        ));
    }

    // Read the original commit message from CHERRY_PICK_HEAD
    let head_ref = repo.find_reference("CHERRY_PICK_HEAD").map_err(|_| {
        AppError::Other("CHERRY_PICK_HEAD introuvable — aucun cherry-pick en cours".into())
    })?;
    let original_oid = head_ref
        .target()
        .ok_or_else(|| AppError::Other("CHERRY_PICK_HEAD n'a pas de cible".into()))?;
    let original_commit = repo.find_commit(original_oid)?;

    let oid_short = original_oid.to_string();
    let oid_short = &oid_short[..7.min(oid_short.len())];
    let message = original_commit
        .message()
        .filter(|m| !m.trim().is_empty())
        .map(|m| m.to_string())
        .unwrap_or_else(|| format!("cherry-pick {oid_short}"));

    // We need the commit summary before cleanup_state() removes CHERRY_PICK_HEAD
    let _ = commit_to_summary(&original_commit); // keep borrow live
    drop(original_commit);

    let summary = create_commit(repo, &message)?;
    repo.cleanup_state()?;

    Ok(summary)
}

pub fn abort_cherry_pick(repo: &Repository) -> Result<()> {
    let state = repo.state();
    if state != RepositoryState::CherryPick && state != RepositoryState::CherryPickSequence {
        return Err(AppError::Other("Aucun cherry-pick en cours".into()));
    }
    repo.checkout_head(Some(CheckoutBuilder::new().force()))?;
    repo.cleanup_state()?;
    Ok(())
}
