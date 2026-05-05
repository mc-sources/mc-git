use std::path::Path;
use git2::{DiffOptions, Repository};

use crate::error::{AppError, Result};

/// Split bytes into lines, preserving line terminators.
fn split_lines(content: &[u8]) -> Vec<Vec<u8>> {
    let mut lines: Vec<Vec<u8>> = Vec::new();
    let mut start = 0;
    for (i, &b) in content.iter().enumerate() {
        if b == b'\n' {
            lines.push(content[start..=i].to_vec());
            start = i + 1;
        }
    }
    if start < content.len() {
        lines.push(content[start..].to_vec());
    }
    lines
}

/// Read the current content of `path` from the index as a list of lines.
fn read_index_lines(repo: &Repository, path: &str) -> Result<Vec<Vec<u8>>> {
    let index = repo.index()?;
    if let Some(entry) = index.get_path(Path::new(path), 0) {
        let blob = repo.find_blob(entry.id)?;
        Ok(split_lines(blob.content()))
    } else {
        Ok(Vec::new())
    }
}

/// Write `lines` as a new blob and update the index entry for `path`.
fn write_index_lines(repo: &Repository, path: &str, lines: Vec<Vec<u8>>) -> Result<()> {
    let content: Vec<u8> = lines.into_iter().flatten().collect();
    let blob_oid = repo.blob(&content)?;

    let mut index = repo.index()?;

    if let Some(mut entry) = index.get_path(Path::new(path), 0) {
        entry.id = blob_oid;
        entry.file_size = content.len() as u32;
        index.add(&entry)?;
    } else {
        // New file: create a minimal index entry
        let entry = git2::IndexEntry {
            ctime: git2::IndexTime::new(0, 0),
            mtime: git2::IndexTime::new(0, 0),
            dev: 0,
            ino: 0,
            mode: 0o100644,
            uid: 0,
            gid: 0,
            file_size: content.len() as u32,
            id: blob_oid,
            flags: 0,
            flags_extended: 0,
            path: path.as_bytes().to_vec(),
        };
        index.add(&entry)?;
    }

    index.write()?;
    Ok(())
}

/// Apply hunk `hunk_index` from an unstaged diff (index-to-workdir) to the index.
/// `selected`: if Some, only the listed line indices within the hunk are staged.
///   Unselected "+" lines are omitted; unselected "-" lines are kept as context.
/// If None, all changed lines in the hunk are staged.
pub fn stage_hunk(
    repo: &Repository,
    path: &str,
    hunk_index: usize,
    selected: Option<&[usize]>,
) -> Result<()> {
    let mut opts = DiffOptions::new();
    opts.include_untracked(true)
        .show_untracked_content(true)
        .recurse_untracked_dirs(true);
    let diff = repo.diff_index_to_workdir(None, Some(&mut opts))?;

    let delta_idx = diff
        .deltas()
        .position(|d| {
            d.new_file().path().map(|p| p == Path::new(path)).unwrap_or(false)
                || d.old_file().path().map(|p| p == Path::new(path)).unwrap_or(false)
        })
        .ok_or_else(|| AppError::Other(format!("No unstaged diff for '{path}'")))?;

    let patch = git2::Patch::from_diff(&diff, delta_idx)?
        .ok_or_else(|| AppError::Other("File is binary or identical".into()))?;

    if hunk_index >= patch.num_hunks() {
        return Err(AppError::Other(format!(
            "Hunk index {hunk_index} out of range (file has {} hunks)",
            patch.num_hunks()
        )));
    }

    let (hunk, _) = patch.hunk(hunk_index)?;
    // old_start/old_count refer to the index (old side of index-to-workdir diff).
    let old_start = hunk.old_start() as usize; // 1-based; 0 means new file
    let old_count = hunk.old_lines() as usize;

    let num_lines = patch.num_lines_in_hunk(hunk_index)?;
    let mut replacement: Vec<Vec<u8>> = Vec::new();

    for i in 0..num_lines {
        let line = patch.line_in_hunk(hunk_index, i)?;
        let origin = line.origin();
        let include = match origin {
            ' ' => true, // context: always keep
            '+' => selected.is_none_or(|sel| sel.contains(&i)),
            '-' => selected.is_some_and(|sel| !sel.contains(&i)), // keep unselected deletions
            _ => false, // no-newline markers etc.
        };
        if include {
            replacement.push(line.content().to_vec());
        }
    }

    let mut content_lines = read_index_lines(repo, path)?;
    let start = if old_start == 0 { 0 } else { old_start - 1 };
    let end = start + old_count;

    if end > content_lines.len() {
        return Err(AppError::Other(format!(
            "Hunk range {}..{} out of bounds (index has {} lines)",
            start,
            end,
            content_lines.len()
        )));
    }

    content_lines.splice(start..end, replacement);
    write_index_lines(repo, path, content_lines)
}

/// Revert hunk `hunk_index` from the staged diff (HEAD-to-index) back to HEAD in the index.
/// `selected`: if Some, only the listed line indices within the hunk are unstaged.
///   Unselected "+" lines are kept; unselected "-" lines are not restored.
/// If None, all changed lines in the hunk are unstaged.
pub fn unstage_hunk(
    repo: &Repository,
    path: &str,
    hunk_index: usize,
    selected: Option<&[usize]>,
) -> Result<()> {
    let head_tree = repo.head().ok().and_then(|h| h.peel_to_tree().ok());
    let diff = repo.diff_tree_to_index(head_tree.as_ref(), None, None)?;

    let delta_idx = diff
        .deltas()
        .position(|d| {
            d.new_file().path().map(|p| p == Path::new(path)).unwrap_or(false)
                || d.old_file().path().map(|p| p == Path::new(path)).unwrap_or(false)
        })
        .ok_or_else(|| AppError::Other(format!("No staged diff for '{path}'")))?;

    let patch = git2::Patch::from_diff(&diff, delta_idx)?
        .ok_or_else(|| AppError::Other("File is binary or identical".into()))?;

    if hunk_index >= patch.num_hunks() {
        return Err(AppError::Other(format!(
            "Hunk index {hunk_index} out of range (file has {} hunks)",
            patch.num_hunks()
        )));
    }

    let (hunk, _) = patch.hunk(hunk_index)?;
    // new_start/new_count refer to the index (new side of HEAD-to-index diff).
    let new_start = hunk.new_start() as usize; // 1-based; 0 means file deleted
    let new_count = hunk.new_lines() as usize;

    let num_lines = patch.num_lines_in_hunk(hunk_index)?;
    let mut replacement: Vec<Vec<u8>> = Vec::new();

    for i in 0..num_lines {
        let line = patch.line_in_hunk(hunk_index, i)?;
        let origin = line.origin();
        let include = match origin {
            ' ' => true, // context: always keep
            '-' => selected.is_none_or(|sel| sel.contains(&i)), // HEAD lines to restore
            '+' => selected.is_some_and(|sel| !sel.contains(&i)), // keep unselected index additions
            _ => false,
        };
        if include {
            replacement.push(line.content().to_vec());
        }
    }

    let mut content_lines = read_index_lines(repo, path)?;
    let start = if new_start == 0 { 0 } else { new_start - 1 };
    let end = start + new_count;

    if end > content_lines.len() {
        return Err(AppError::Other(format!(
            "Hunk range {}..{} out of bounds (index has {} lines)",
            start,
            end,
            content_lines.len()
        )));
    }

    content_lines.splice(start..end, replacement);

    // If content is now empty and file has no HEAD counterpart, remove from index
    if content_lines.is_empty() && head_tree.is_none_or(|t| t.get_path(Path::new(path)).is_err()) {
        let mut index = repo.index()?;
        index.remove_path(Path::new(path))?;
        index.write()?;
        return Ok(());
    }

    write_index_lines(repo, path, content_lines)
}
