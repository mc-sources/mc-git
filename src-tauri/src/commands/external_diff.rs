use git2::Repository;
use std::path::Path;

use crate::error::{AppError, Result};

fn get_head_content(repo: &Repository, file_path: &str) -> Option<Vec<u8>> {
    let head_commit = repo.head().ok()?.peel_to_commit().ok()?;
    let tree = head_commit.tree().ok()?;
    let entry = tree.get_path(Path::new(file_path)).ok()?;
    let blob = repo.find_blob(entry.id()).ok()?;
    Some(blob.content().to_vec())
}

fn get_index_content(repo: &Repository, file_path: &str) -> Option<Vec<u8>> {
    let index = repo.index().ok()?;
    let entry = index.get_path(Path::new(file_path), 0)?;
    let blob = repo.find_blob(entry.id).ok()?;
    Some(blob.content().to_vec())
}

fn get_workdir_content(repo: &Repository, file_path: &str) -> Option<Vec<u8>> {
    let workdir = repo.workdir()?;
    std::fs::read(workdir.join(file_path)).ok()
}

/// Open the before/after versions of a file in an external diff tool.
/// - `staged=true`  → HEAD vs index (showing what will be committed)
/// - `staged=false` → index vs working tree (showing unstaged changes)
///
/// Two temporary files are written; the tool is spawned as a background process.
/// The command may contain arguments separated by whitespace (e.g. `code --diff`).
#[tauri::command]
pub fn open_external_diff(
    tool: String,
    repo_path: String,
    file_path: String,
    staged: bool,
) -> Result<()> {
    let repo = Repository::open(&repo_path)
        .map_err(|e| AppError::Other(format!("Cannot open repository: {e}")))?;

    let (old_content, new_content) = if staged {
        // staged diff: HEAD  vs  index
        let old = get_head_content(&repo, &file_path).unwrap_or_default();
        let new = get_index_content(&repo, &file_path).unwrap_or_default();
        (old, new)
    } else {
        // unstaged diff: index  vs  working tree
        // Fall back to HEAD content if the file is not yet in the index (new file).
        let old = get_index_content(&repo, &file_path)
            .or_else(|| get_head_content(&repo, &file_path))
            .unwrap_or_default();
        let new = get_workdir_content(&repo, &file_path).unwrap_or_default();
        (old, new)
    };

    let ext = Path::new(&file_path)
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("txt");

    let nonce = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_nanos();

    let tmp_dir = std::env::temp_dir();
    let tmp_old = tmp_dir.join(format!("mcgit_old_{nonce}.{ext}"));
    let tmp_new = tmp_dir.join(format!("mcgit_new_{nonce}.{ext}"));

    std::fs::write(&tmp_old, &old_content)
        .map_err(|e| AppError::Other(format!("Cannot write temp file (old): {e}")))?;
    std::fs::write(&tmp_new, &new_content)
        .map_err(|e| AppError::Other(format!("Cannot write temp file (new): {e}")))?;

    let parts: Vec<&str> = tool.split_whitespace().collect();
    if parts.is_empty() {
        return Err(AppError::Other("Empty diff tool command".into()));
    }

    std::process::Command::new(parts[0])
        .args(&parts[1..])
        .arg(&tmp_old)
        .arg(&tmp_new)
        .spawn()
        .map_err(|e| {
            AppError::Other(format!("Failed to launch diff tool '{}': {e}", parts[0]))
        })?;

    Ok(())
}
