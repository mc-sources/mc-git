use git2::{Repository, ResetType, Sort};

use crate::error::{AppError, Result};
use crate::git::commit::{commit_to_summary, convert_signature, create_commit};
use crate::git::types::{ChangedFileSummary, CommitDetail, CommitSummary, LogFilters};

/// Max commits scanned when a path filter is active (per-commit diff is expensive).
const MAX_PATH_SCAN: usize = 5_000;
/// Max results returned when any filter is active.
const MAX_FILTERED: usize = 500;

fn commit_touches_path(repo: &Repository, commit: &git2::Commit, path: &str) -> bool {
    let tree = match commit.tree() {
        Ok(t) => t,
        Err(_) => return false,
    };
    let parent_tree = commit.parent(0).ok().and_then(|p| p.tree().ok());
    let mut opts = git2::DiffOptions::new();
    opts.pathspec(path);
    match repo.diff_tree_to_tree(parent_tree.as_ref(), Some(&tree), Some(&mut opts)) {
        Ok(diff) => diff.deltas().count() > 0,
        Err(_) => false,
    }
}

fn commit_matches(repo: &Repository, commit: &git2::Commit, f: &LogFilters) -> bool {
    if let Some(search) = &f.search {
        let pattern = search.to_lowercase();
        let msg = commit.message().unwrap_or("").to_lowercase();
        let name = commit.author().name().unwrap_or("").to_lowercase();
        let email = commit.author().email().unwrap_or("").to_lowercase();
        if !msg.contains(&pattern) && !name.contains(&pattern) && !email.contains(&pattern) {
            return false;
        }
    }
    let ts = commit.time().seconds();
    if let Some(since) = f.since {
        if ts < since {
            return false;
        }
    }
    if let Some(until) = f.until {
        if ts > until {
            return false;
        }
    }
    if let Some(path) = &f.path {
        if !commit_touches_path(repo, commit, path) {
            return false;
        }
    }
    true
}

pub fn get_log(
    repo: &Repository,
    limit: usize,
    offset: usize,
    branch: Option<&str>,
    filters: Option<&LogFilters>,
) -> Result<Vec<CommitSummary>> {
    let mut revwalk = repo.revwalk()?;
    revwalk.set_sorting(Sort::TIME | Sort::TOPOLOGICAL)?;

    match branch {
        Some(b) => {
            let reference = repo.find_reference(&format!("refs/heads/{b}"))?;
            let oid = reference.target()
                .ok_or_else(|| AppError::Other(format!("Branch '{b}' has no direct target")))?;
            revwalk.push(oid)?;
        }
        None => {
            revwalk.push_head()?;
        }
    }

    let has_filters = filters.map(|f| !f.is_empty()).unwrap_or(false);

    if !has_filters {
        let commits: Vec<CommitSummary> = revwalk
            .skip(offset)
            .take(limit)
            .filter_map(|oid| oid.ok())
            .filter_map(|oid| repo.find_commit(oid).ok())
            .map(|c| commit_to_summary(&c))
            .collect();
        return Ok(commits);
    }

    // With filters: scan up to MAX_PATH_SCAN (expensive path diff) or unbounded for cheap filters
    let f = filters.unwrap();
    // Path filter requires per-commit diff (expensive); other filters are cheap text/date checks.
    // Both cases are capped to avoid scanning arbitrarily large histories.
    let scan_cap = if f.path.is_some() { MAX_PATH_SCAN } else { 20_000 };

    let commits: Vec<CommitSummary> = revwalk
        .take(scan_cap)
        .filter_map(|oid| oid.ok())
        .filter_map(|oid| repo.find_commit(oid).ok())
        .filter(|c| commit_matches(repo, c, f))
        .take(MAX_FILTERED)
        .map(|c| commit_to_summary(&c))
        .collect();

    Ok(commits)
}

/// Fetch commits for graph rendering.
///
/// When `show_all` is false (default): pushes HEAD only — equivalent to `git log`.
/// When `show_all` is true: pushes all local branches + all remote-tracking refs
/// — equivalent to `git log --all --graph`.
pub fn get_graph_log(repo: &Repository, limit: usize, show_all: bool) -> Result<Vec<CommitSummary>> {
    let mut revwalk = repo.revwalk()?;
    revwalk.set_sorting(Sort::TOPOLOGICAL | Sort::TIME)?;

    if show_all {
        // All local branches + all remote-tracking refs (REQ-HIST-ALL-002)
        revwalk.push_glob("refs/heads/*")?;
        let _ = revwalk.push_glob("refs/remotes/*");
        // Also push HEAD in case of detached HEAD not covered by refs/heads/*
        if let Ok(head) = repo.head() {
            if !head.is_branch() {
                if let Some(oid) = head.target() {
                    let _ = revwalk.push(oid);
                }
            }
        }
    } else {
        // HEAD only (REQ-HIST-ALL-001)
        revwalk.push_head()?;
    }

    let commits: Vec<CommitSummary> = revwalk
        .take(limit)
        .filter_map(|oid| oid.ok())
        .filter_map(|oid| repo.find_commit(oid).ok())
        .map(|c| commit_to_summary(&c))
        .collect();

    Ok(commits)
}

pub fn reset_to_commit(repo: &Repository, oid_str: &str, mode: &str) -> Result<()> {
    let oid = git2::Oid::from_str(oid_str)?;
    let obj = repo.find_object(oid, None)?;
    let reset_type = match mode {
        "soft"  => ResetType::Soft,
        "hard"  => ResetType::Hard,
        _       => ResetType::Mixed,
    };
    repo.reset(&obj, reset_type, None)?;
    Ok(())
}

pub fn revert_commit(repo: &Repository, oid_str: &str) -> Result<CommitSummary> {
    let oid = git2::Oid::from_str(oid_str)?;
    let commit = repo.find_commit(oid)?;

    if commit.parent_count() > 1 {
        return Err(AppError::Other(
            "Revert d'un commit de merge non supporté".into(),
        ));
    }

    let original_summary = commit.summary().unwrap_or("").to_string();

    repo.revert(&commit, None)?;

    let revert_message = format!("Revert \"{original_summary}\"");
    create_commit(repo, &revert_message)
}

pub fn get_commit_detail(repo: &Repository, oid_str: &str) -> Result<CommitDetail> {
    let oid = git2::Oid::from_str(oid_str)?;
    let commit = repo.find_commit(oid)?;

    let message = commit.message().unwrap_or("").to_string();
    let (summary, body) = match message.split_once('\n') {
        Some((s, b)) => (
            s.to_string(),
            Some(b.trim().to_string()).filter(|b| !b.is_empty()),
        ),
        None => (message.trim().to_string(), None),
    };

    let author = convert_signature(&commit.author());
    let committer = convert_signature(&commit.committer());
    let parent_oids: Vec<String> = commit.parent_ids().map(|id| id.to_string()).collect();

    // Build file list using foreach with only a file callback — no hunk/line computation.
    // This is O(file count) instead of O(total diff size), making large commits instant.
    let tree = commit.tree()?;
    let parent_tree = commit.parent(0).ok().and_then(|p| p.tree().ok());
    let diff = repo.diff_tree_to_tree(parent_tree.as_ref(), Some(&tree), None)?;

    let mut changed_files: Vec<ChangedFileSummary> = Vec::new();
    diff.foreach(
        &mut |delta, _progress| {
            use git2::Delta;
            let new_path = delta.new_file().path().map(|p| p.to_string_lossy().to_string());
            let old_path = delta.old_file().path().map(|p| p.to_string_lossy().to_string());
            let is_binary = delta.new_file().is_binary() || delta.old_file().is_binary();
            let status = match delta.status() {
                Delta::Added => "added",
                Delta::Deleted => "deleted",
                Delta::Renamed => "renamed",
                Delta::Copied => "copied",
                _ => "modified",
            }.to_string();
            let clean_old = old_path.filter(|p| {
                matches!(delta.status(), Delta::Deleted | Delta::Renamed | Delta::Copied)
                    || new_path.as_deref() != Some(p)
            });
            changed_files.push(ChangedFileSummary { old_path: clean_old, new_path, is_binary, status });
            true
        },
        None, None, None,
    )?;

    let is_signed = commit.raw_header()
        .map(|h| h.contains("gpgsig"))
        .unwrap_or(false);

    Ok(CommitDetail {
        oid: oid.to_string(),
        short_oid: oid.to_string()[..7].to_string(),
        summary,
        body,
        author,
        committer,
        parent_oids,
        changed_files,
        is_signed,
    })
}
