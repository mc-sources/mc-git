use git2::{build::CheckoutBuilder, Repository, RepositoryState, Sort};

use crate::error::{AppError, Result};
use crate::git::types::{RebaseEntry, RebaseStatus, RebaseStep};

/// Start a rebase of HEAD onto `onto_branch`.
/// Loops through all steps until a conflict is hit or the rebase completes.
pub fn rebase_branch(repo: &Repository, onto_branch: &str) -> Result<RebaseStatus> {
    if repo.state() != RepositoryState::Clean {
        return Err(AppError::Other(
            "Le dépôt n'est pas dans un état propre".into(),
        ));
    }

    // Resolve onto branch to an annotated commit
    let onto_ref = repo
        .find_reference(&format!("refs/heads/{onto_branch}"))
        .or_else(|_| repo.find_reference(onto_branch))
        .map_err(|_| AppError::Other(format!("Branche introuvable : {onto_branch}")))?;
    let onto_oid = onto_ref
        .target()
        .ok_or_else(|| AppError::Other("La référence onto n'a pas de cible".into()))?;
    let onto_commit = repo.find_annotated_commit(onto_oid)?;

    // Start the rebase (branch=None means HEAD, upstream=None uses onto as upstream)
    let mut rebase = repo.rebase(None, None, Some(&onto_commit), None)?;

    let total_steps = rebase.len();
    let mut current_step = 0usize;

    loop {
        match rebase.next() {
            None => {
                // All steps processed without conflict
                let sig = repo.signature()?;
                rebase.finish(Some(&sig))?;
                return Ok(RebaseStatus {
                    has_conflicts: false,
                    conflict_count: 0,
                    current_step,
                    total_steps,
                    completed: true,
                });
            }
            Some(Err(e)) => return Err(e.into()),
            Some(Ok(_op)) => {
                current_step += 1;

                let mut index = repo.index()?;
                index.read(true)?;

                if index.has_conflicts() {
                    let conflict_count = index.conflicts()?.count();
                    return Ok(RebaseStatus {
                        has_conflicts: true,
                        conflict_count,
                        current_step,
                        total_steps,
                        completed: false,
                    });
                }

                // No conflict for this step — commit it
                let sig = repo.signature()?;
                rebase.commit(None, &sig, None)?;
            }
        }
    }
}

/// Continue a rebase in progress after conflicts have been resolved.
pub fn continue_rebase(repo: &Repository) -> Result<RebaseStatus> {
    let state = repo.state();
    if state != RepositoryState::Rebase
        && state != RepositoryState::RebaseInteractive
        && state != RepositoryState::RebaseMerge
    {
        return Err(AppError::Other("Aucun rebase en cours".into()));
    }

    let mut index = repo.index()?;
    index.read(true)?;
    if index.has_conflicts() {
        return Err(AppError::Other(
            "Des conflits sont encore présents — résolvez-les avant de continuer".into(),
        ));
    }

    let mut rebase = repo.open_rebase(None)?;
    let total_steps = rebase.len();

    // Commit the current (conflicted) step that was just resolved
    let sig = repo.signature()?;
    rebase.commit(None, &sig, None)?;

    let mut current_step = rebase.operation_current().unwrap_or(0);

    // Continue processing remaining steps
    loop {
        match rebase.next() {
            None => {
                rebase.finish(Some(&sig))?;
                return Ok(RebaseStatus {
                    has_conflicts: false,
                    conflict_count: 0,
                    current_step,
                    total_steps,
                    completed: true,
                });
            }
            Some(Err(e)) => return Err(e.into()),
            Some(Ok(_op)) => {
                current_step += 1;

                let mut index = repo.index()?;
                index.read(true)?;

                if index.has_conflicts() {
                    let conflict_count = index.conflicts()?.count();
                    return Ok(RebaseStatus {
                        has_conflicts: true,
                        conflict_count,
                        current_step,
                        total_steps,
                        completed: false,
                    });
                }

                rebase.commit(None, &sig, None)?;
            }
        }
    }
}

/// Abort an in-progress rebase and restore the pre-rebase state.
pub fn abort_rebase(repo: &Repository) -> Result<()> {
    let state = repo.state();
    if state != RepositoryState::Rebase
        && state != RepositoryState::RebaseInteractive
        && state != RepositoryState::RebaseMerge
    {
        return Err(AppError::Other("Aucun rebase en cours".into()));
    }
    let mut rebase = repo.open_rebase(None)?;
    rebase.abort()?;
    repo.checkout_head(Some(CheckoutBuilder::new().force()))?;
    Ok(())
}

// ─── Interactive rebase ───────────────────────────────────────────────────────

/// Return the list of commits between `upstream_oid` (exclusive) and HEAD
/// (inclusive), ordered oldest → newest — ready to be displayed in the
/// interactive rebase editor.
pub fn get_interactive_rebase_commits(
    repo: &Repository,
    upstream_oid: &str,
) -> Result<Vec<RebaseEntry>> {
    let upstream = upstream_oid
        .parse::<git2::Oid>()
        .map_err(|_| AppError::Other(format!("OID invalide : {upstream_oid}")))?;

    let head_commit = repo.head()?.peel_to_commit()?;

    let mut walk = repo.revwalk()?;
    walk.push(head_commit.id())?;
    walk.hide(upstream)?;
    walk.set_sorting(Sort::TOPOLOGICAL | Sort::REVERSE)?;

    let mut entries = Vec::new();
    for oid_result in walk {
        let oid = oid_result?;
        let commit = repo.find_commit(oid)?;
        let oid_str = oid.to_string();
        entries.push(RebaseEntry {
            short_oid: oid_str[..7].to_string(),
            oid: oid_str,
            summary: commit.summary().unwrap_or("").to_string(),
            author_name: commit.author().name().unwrap_or("").to_string(),
            author_email: commit.author().email().unwrap_or("").to_string(),
        });
    }
    Ok(entries)
}

/// Execute an interactive rebase plan.
///
/// Pure libgit2 implementation — no git CLI dependency.
///
/// Strategy:
///   1. Group consecutive squash/fixup steps with their preceding pick/reword.
///   2. For each group: cherry-pick every commit in the group (committing each
///      as a temporary commit), then soft-reset to the group's base and create
///      a single final commit with the appropriate combined message.
///   3. Point the original branch ref to the new HEAD.
///
/// Conflicts during cherry-pick are returned immediately; the repo is left in
/// a cherry-pick conflict state so the user can resolve and call continue.
pub fn apply_interactive_rebase(
    repo: &Repository,
    upstream_oid: &str,
    steps: Vec<RebaseStep>,
) -> Result<RebaseStatus> {
    if repo.state() != RepositoryState::Clean {
        return Err(AppError::Other(
            "Le dépôt n'est pas dans un état propre".into(),
        ));
    }

    // Filter drops.
    let plan: Vec<&RebaseStep> = steps.iter().filter(|s| s.action != "drop").collect();
    if plan.is_empty() {
        return Err(AppError::Other(
            "Le plan ne contient aucun commit à appliquer (tous supprimés)".into(),
        ));
    }
    let total_steps = plan.len();

    // Save original HEAD ref name (to restore branch pointer at the end).
    let original_refname: Option<String> = repo
        .head()
        .ok()
        .filter(|r| r.is_branch())
        .and_then(|r| r.name().map(str::to_owned));

    // Group steps: each group starts with a pick/reword and accumulates
    // following squash/fixup entries.
    struct Group<'a> {
        commits: Vec<&'a RebaseStep>,
    }
    let mut groups: Vec<Group> = Vec::new();
    for step in &plan {
        match step.action.as_str() {
            "pick" | "reword" => groups.push(Group {
                commits: vec![step],
            }),
            "squash" | "fixup" => {
                if let Some(g) = groups.last_mut() {
                    g.commits.push(step);
                }
            }
            _ => {}
        }
    }

    // Detach HEAD at upstream.
    let upstream = upstream_oid
        .parse::<git2::Oid>()
        .map_err(|_| AppError::Other(format!("OID invalide : {upstream_oid}")))?;
    let upstream_commit = repo.find_commit(upstream)?;
    repo.set_head_detached(upstream)?;
    repo.checkout_tree(
        upstream_commit.as_object(),
        Some(CheckoutBuilder::new().force()),
    )?;

    let mut current_step = 0usize;

    for group in &groups {
        // Remember the HEAD before this group (= parent for the squash commit).
        let group_base = repo
            .head()?
            .target()
            .ok_or_else(|| AppError::Other("HEAD sans cible".into()))?;

        for step in &group.commits {
            current_step += 1;

            let oid = step
                .oid
                .parse::<git2::Oid>()
                .map_err(|_| AppError::Other(format!("OID invalide : {}", step.oid)))?;
            let commit = repo.find_commit(oid)?;

            // Cherry-pick applies the commit's diff onto the current HEAD via
            // 3-way merge, without creating a commit.
            repo.cherrypick(&commit, None)?;

            let mut index = repo.index()?;
            index.read(true)?;

            if index.has_conflicts() {
                let conflict_count = index.conflicts()?.count();
                return Ok(RebaseStatus {
                    has_conflicts: true,
                    conflict_count,
                    current_step,
                    total_steps,
                    completed: false,
                });
            }

            // Commit the cherry-picked changes (may be temporary for squash groups).
            let sig = repo.signature()?;
            let tree_oid = index.write_tree()?;
            let tree = repo.find_tree(tree_oid)?;
            let parent = repo.head()?.peel_to_commit()?;

            let commit_msg_owned;
            let commit_msg: &str = match step.action.as_str() {
                "reword" => {
                    commit_msg_owned = step
                        .message
                        .as_deref()
                        .unwrap_or_else(|| commit.summary().unwrap_or(""))
                        .to_owned();
                    &commit_msg_owned
                }
                _ => commit.message().unwrap_or(""),
            };

            repo.commit(Some("HEAD"), &sig, &sig, commit_msg, &tree, &[&parent])?;

            // Clear the cherry-pick state so the next iteration starts clean.
            repo.cleanup_state()?;
        }

        // For squash/fixup groups: soft-reset to group_base and create one commit.
        if group.commits.len() > 1 {
            // Build the combined commit message.
            let mut combined = String::new();
            for step in &group.commits {
                let oid = step.oid.parse::<git2::Oid>()?;
                let commit = repo.find_commit(oid)?;

                let msg = match step.action.as_str() {
                    "reword" => step
                        .message
                        .as_deref()
                        .unwrap_or_else(|| commit.summary().unwrap_or(""))
                        .to_owned(),
                    _ => commit.message().unwrap_or("").to_owned(),
                };

                match step.action.as_str() {
                    "pick" | "reword" => combined = msg,
                    "squash" => {
                        if !combined.is_empty() && !msg.is_empty() {
                            combined.push_str("\n\n");
                        }
                        combined.push_str(&msg);
                    }
                    "fixup" => {} // discard this commit's message
                    _ => {}
                }
            }

            // Soft-reset: move HEAD back to group_base, keep index as-is.
            let base_obj = repo.find_object(group_base, None)?;
            repo.reset(&base_obj, git2::ResetType::Soft, None)?;

            // Create the single squash commit.
            let sig = repo.signature()?;
            let mut index = repo.index()?;
            index.read(true)?;
            let tree_oid = index.write_tree()?;
            let tree = repo.find_tree(tree_oid)?;
            let base_parent = repo.find_commit(group_base)?;
            repo.commit(Some("HEAD"), &sig, &sig, &combined, &tree, &[&base_parent])?;
        }
    }

    // Point the original branch ref to the new HEAD.
    let new_head = repo
        .head()?
        .target()
        .ok_or_else(|| AppError::Other("HEAD sans cible".into()))?;

    if let Some(refname) = &original_refname {
        repo.find_reference(refname)?
            .set_target(new_head, "rebase interactif")?;
        repo.set_head(refname)?;
        repo.checkout_head(Some(CheckoutBuilder::new().force()))?;
    }

    Ok(RebaseStatus {
        has_conflicts: false,
        conflict_count: 0,
        current_step: total_steps,
        total_steps,
        completed: true,
    })
}
