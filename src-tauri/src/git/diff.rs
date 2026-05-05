use git2::{DiffOptions, Oid, Repository};

use crate::error::Result;
use crate::git::types::{DiffHunk, DiffLine, FileDiff};

fn convert_diff(diff: git2::Diff) -> Result<Vec<FileDiff>> {
    let mut files: Vec<FileDiff> = Vec::new();

    diff.print(git2::DiffFormat::Patch, |delta, hunk, line| {
        use git2::Delta;

        let new_path = delta
            .new_file()
            .path()
            .map(|p| p.to_string_lossy().to_string());
        let old_path = delta
            .old_file()
            .path()
            .map(|p| p.to_string_lossy().to_string());
        let is_binary = delta.new_file().is_binary() || delta.old_file().is_binary();

        // Find or create the FileDiff for this delta
        let file_diff = match files.iter_mut().find(|f| {
            f.new_path.as_deref() == new_path.as_deref()
                || f.old_path.as_deref() == old_path.as_deref()
        }) {
            Some(f) => f,
            None => {
                files.push(FileDiff {
                    old_path: old_path.filter(|p| {
                        matches!(delta.status(), Delta::Deleted | Delta::Renamed | Delta::Copied)
                            || new_path.as_deref() != Some(p)
                    }),
                    new_path,
                    is_binary,
                    hunks: Vec::new(),
                    deleted_in_conflict: false,
                    deleted_by_them: false,
                });
                files.last_mut().expect("invariant: files non vide après push")
            }
        };

        if is_binary {
            return true;
        }

        if let Some(h) = hunk {
            let header = String::from_utf8_lossy(h.header()).to_string();
            if file_diff.hunks.last().map(|hk: &DiffHunk| hk.header != header).unwrap_or(true) {
                file_diff.hunks.push(DiffHunk {
                    header,
                    lines: Vec::new(),
                });
            }
        }

        let origin = line.origin();
        // Skip file headers ('+++ ', '--- ', etc.)
        if matches!(origin, '+' | '-' | ' ') {
            let content = String::from_utf8_lossy(line.content()).to_string();
            if let Some(hunk) = file_diff.hunks.last_mut() {
                hunk.lines.push(DiffLine {
                    origin,
                    content,
                    old_lineno: line.old_lineno(),
                    new_lineno: line.new_lineno(),
                });
            }
        }

        true
    })?;

    Ok(files)
}

/// For "added by both sides" (AA) conflicts, git writes `path~HEAD` and
/// `path~BRANCH` instead of placing conflict markers in the file itself.
/// Return Some((head_content, branch_content, branch_label)) if those files exist.
fn detect_added_by_both(workdir: &std::path::Path, path: &str) -> Option<(String, String, String)> {
    let filename = std::path::Path::new(path)
        .file_name()
        .map(|n| n.to_string_lossy().to_string())?;
    let dir = workdir.join(path).parent()
        .map(|p| p.to_path_buf())
        .unwrap_or_else(|| workdir.to_path_buf());

    let head_path = dir.join(format!("{}~HEAD", filename));
    if !head_path.exists() {
        return None;
    }
    let head_content = std::fs::read_to_string(&head_path).ok()?;

    let prefix = format!("{}~", filename);
    let entries = std::fs::read_dir(&dir).ok()?;
    for entry in entries.flatten() {
        let name = entry.file_name().to_string_lossy().to_string();
        if name.starts_with(&prefix) && name != format!("{}~HEAD", filename) {
            let label = name[prefix.len()..].to_string();
            let branch_content = std::fs::read_to_string(entry.path()).unwrap_or_default();
            return Some((head_content, branch_content, label));
        }
    }
    None
}

fn is_ud_conflict(repo: &Repository, path: &str) -> bool {
    repo.index()
        .ok()
        .map(|index| {
            let p = std::path::Path::new(path);
            // UD = "deleted by them": stage 1 (ancestor) and stage 2 (ours) present, stage 3 (theirs) absent
            index.get_path(p, 1).is_some()
                && index.get_path(p, 2).is_some()
                && index.get_path(p, 3).is_none()
        })
        .unwrap_or(false)
}

fn get_conflict_file_content(repo: &Repository, path: &str) -> Result<FileDiff> {
    let workdir = repo
        .workdir()
        .ok_or_else(|| crate::error::AppError::Other("No working directory".into()))?;
    let abs_path = workdir.join(path);

    // File may not exist on disk if it was deleted on our side of the conflict,
    // OR for "added by both" (AA) conflicts where git writes ~HEAD / ~BRANCH files.
    if !abs_path.exists() {
        if let Some((head_content, branch_content, branch_label)) =
            detect_added_by_both(workdir, path)
        {
            // Synthesize conflict markers so MergeEditor can display/resolve them.
            let head_str = if head_content.ends_with('\n') {
                head_content
            } else {
                format!("{head_content}\n")
            };
            let branch_str = if branch_content.ends_with('\n') {
                branch_content
            } else {
                format!("{branch_content}\n")
            };
            let synthetic = format!(
                "<<<<<<< HEAD\n{head_str}=======\n{branch_str}>>>>>>> {branch_label}\n"
            );
            let lines: Vec<DiffLine> = synthetic
                .lines()
                .enumerate()
                .map(|(i, line)| DiffLine {
                    origin: ' ',
                    content: format!("{line}\n"),
                    old_lineno: Some((i + 1) as u32),
                    new_lineno: Some((i + 1) as u32),
                })
                .collect();
            let n = lines.len();
            return Ok(FileDiff {
                old_path: None,
                new_path: Some(path.to_string()),
                is_binary: false,
                hunks: vec![DiffHunk {
                    header: format!("@@ -1,{n} +1,{n} @@"),
                    lines,
                }],
                deleted_in_conflict: true,
                deleted_by_them: false,
            });
        }

        // Truly deleted ("deleted by us" DU conflict).
        return Ok(FileDiff {
            old_path: Some(path.to_string()),
            new_path: None,
            is_binary: false,
            hunks: Vec::new(),
            deleted_in_conflict: true,
            deleted_by_them: false,
        });
    }

    // UD conflict: they deleted, we modified. Signal with deleted_by_them = true.
    if is_ud_conflict(repo, path) {
        return Ok(FileDiff {
            old_path: None,
            new_path: Some(path.to_string()),
            is_binary: false,
            hunks: Vec::new(),
            deleted_in_conflict: false,
            deleted_by_them: true,
        });
    }

    let content = std::fs::read_to_string(&abs_path)
        .map_err(|e| crate::error::AppError::Other(e.to_string()))?;

    let lines: Vec<DiffLine> = content
        .lines()
        .enumerate()
        .map(|(i, line)| DiffLine {
            origin: ' ',
            content: format!("{line}\n"),
            old_lineno: Some((i + 1) as u32),
            new_lineno: Some((i + 1) as u32),
        })
        .collect();

    let n = lines.len();
    Ok(FileDiff {
        old_path: None,
        new_path: Some(path.to_string()),
        is_binary: false,
        hunks: vec![DiffHunk {
            header: format!("@@ -1,{n} +1,{n} @@"),
            lines,
        }],
        deleted_in_conflict: false,
        deleted_by_them: false,
    })
}

pub fn get_file_diff(repo: &Repository, path: &str, staged: bool, ignore_whitespace: bool) -> Result<FileDiff> {
    // Conflicted files have index entries at stages 1/2/3 — diff_index_to_workdir
    // emits no delta for them. Read the working-dir content directly instead so the
    // conflict markers are visible.
    if !staged {
        // repo.index() can fail on corrupt index states (e.g. bad NAME extension from
        // rename conflicts). Use .ok() so the error is non-fatal: if index is unreadable
        // we fall through to the normal diff path.
        //
        // Conflict types and their stage entries:
        //   UU / DU / UD: stage 1 exists (common ancestor)
        //   AA (added by both sides): stages 2+3 exist but NOT stage 1
        let is_conflicted = repo.index()
            .ok()
            .map(|index| {
                let p = std::path::Path::new(path);
                index.get_path(p, 1).is_some()
                    || (index.get_path(p, 2).is_some() && index.get_path(p, 3).is_some())
            })
            .unwrap_or(false);
        if is_conflicted {
            return get_conflict_file_content(repo, path);
        }
    }
    // We intentionally avoid pathspec here: special characters (spaces, parentheses)
    // can be misinterpreted by the pathspec parser. Instead we get the full diff and
    // filter by exact path in Rust.
    let diff = if staged {
        // Staged diff: compare HEAD tree vs index
        let head_tree = repo
            .head()
            .ok()
            .and_then(|h| h.peel_to_tree().ok());
        let mut opts = DiffOptions::new();
        if ignore_whitespace { opts.ignore_whitespace(true); }
        repo.diff_tree_to_index(head_tree.as_ref(), None, Some(&mut opts))?
    } else {
        // Unstaged diff: compare index vs working dir.
        // show_untracked_content is required so untracked files emit actual diff lines
        // (otherwise the delta exists but no hunk/line callbacks fire).
        let mut opts = DiffOptions::new();
        opts.include_untracked(true)
            .show_untracked_content(true)
            .recurse_untracked_dirs(true);
        if ignore_whitespace { opts.ignore_whitespace(true); }
        repo.diff_index_to_workdir(None, Some(&mut opts))?
    };

    let files = convert_diff(diff)?;
    let found = files
        .into_iter()
        .find(|f| {
            f.new_path.as_deref() == Some(path) || f.old_path.as_deref() == Some(path)
        });

    // If the normal diff returned no entry, or returned an entry with empty hunks, it may
    // be a conflict file that repo.index() failed to detect (e.g. AA conflict when the NAME
    // extension makes the index unreadable). Fall back to reading the file from disk.
    let workdir = repo
        .workdir()
        .ok_or_else(|| crate::error::AppError::Other("Pas de répertoire de travail".into()))?;
    let abs_path = workdir.join(path);

    match found {
        Some(fd) if !fd.hunks.is_empty() || fd.is_binary => Ok(fd),
        Some(fd) => {
            // File found in diff but empty hunks: may be an AA conflict where git2 did not
            // generate hunk data. Try reading conflict content from disk; if that yields
            // non-empty hunks, return it. Otherwise return fd as-is so that new_path is
            // preserved — the frontend will show "no changes" instead of a deletion panel.
            if abs_path.exists() {
                let conflict = get_conflict_file_content(repo, path)?;
                if !conflict.hunks.is_empty() {
                    return Ok(conflict);
                }
            }
            Ok(fd)
        }
        None => {
            if abs_path.exists() {
                // File not in diff but present on disk. This can mean:
                //   (a) Index is unreadable (corrupt NAME extension): the file is still
                //       conflicted but the early is_conflicted check returned false.
                //   (b) Post-resolution: stages cleared, workdir == index → no delta.
                // Re-check conflict stages and ~HEAD/~BRANCH presence to distinguish.
                let still_conflicted = repo.index()
                    .ok()
                    .map(|idx| {
                        let p = std::path::Path::new(path);
                        idx.get_path(p, 1).is_some()
                            || (idx.get_path(p, 2).is_some() && idx.get_path(p, 3).is_some())
                    })
                    .unwrap_or(false);
                if still_conflicted || detect_added_by_both(workdir, path).is_some() {
                    get_conflict_file_content(repo, path)
                } else {
                    // Clean post-resolution file: nothing to show.
                    Ok(FileDiff {
                        old_path: None,
                        new_path: Some(path.to_string()),
                        is_binary: false,
                        hunks: Vec::new(),
                        deleted_in_conflict: false,
                        deleted_by_them: false,
                    })
                }
            } else {
                // File absent from disk and not in diff: "deleted by us" conflict.
                Ok(FileDiff {
                    old_path: Some(path.to_string()),
                    new_path: None,
                    is_binary: false,
                    hunks: Vec::new(),
                    deleted_in_conflict: true,
                    deleted_by_them: false,
                })
            }
        }
    }
}

pub fn get_commit_diff(repo: &Repository, oid_str: &str, ignore_whitespace: bool) -> Result<Vec<FileDiff>> {
    let oid = Oid::from_str(oid_str)?;
    let commit = repo.find_commit(oid)?;
    let tree = commit.tree()?;

    let parent_tree = commit
        .parent(0)
        .ok()
        .and_then(|p| p.tree().ok());

    let mut opts = DiffOptions::new();
    if ignore_whitespace { opts.ignore_whitespace(true); }
    let diff = repo.diff_tree_to_tree(parent_tree.as_ref(), Some(&tree), Some(&mut opts))?;
    convert_diff(diff)
}

/// Get the diff for a single file within a commit. Uses a pathspec so only that
/// file's patch is computed — safe for large commits.
pub fn get_commit_file_diff(repo: &Repository, commit_oid: &str, path: &str, ignore_whitespace: bool) -> Result<FileDiff> {
    let oid = Oid::from_str(commit_oid)?;
    let commit = repo.find_commit(oid)?;
    let tree = commit.tree()?;
    let parent_tree = commit.parent(0).ok().and_then(|p| p.tree().ok());

    let mut opts = DiffOptions::new();
    opts.pathspec(path);
    if ignore_whitespace { opts.ignore_whitespace(true); }
    let diff = repo.diff_tree_to_tree(parent_tree.as_ref(), Some(&tree), Some(&mut opts))?;
    let files = convert_diff(diff)?;
    files
        .into_iter()
        .find(|f| f.new_path.as_deref() == Some(path) || f.old_path.as_deref() == Some(path))
        .ok_or_else(|| crate::error::AppError::Other(format!("No diff found for {path}")))
}
