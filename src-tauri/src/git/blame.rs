use git2::Repository;
use std::path::Path;

use crate::error::{AppError, Result};
use crate::git::types::BlameLine;

pub fn get_blame(
    repo: &Repository,
    path: &str,
    commit_oid: Option<&str>,
) -> Result<Vec<BlameLine>> {
    let mut opts = git2::BlameOptions::new();

    let newest_oid = if let Some(oid_str) = commit_oid {
        let oid = git2::Oid::from_str(oid_str)?;
        opts.newest_commit(oid);
        Some(oid)
    } else {
        None
    };

    let blame = repo.blame_file(Path::new(path), Some(&mut opts))?;

    // Read file content at the specified revision (or workdir if none).
    let content = match newest_oid {
        Some(oid) => {
            let commit = repo.find_commit(oid)?;
            let tree = commit.tree()?;
            let entry = tree
                .get_path(Path::new(path))
                .map_err(|_| AppError::Other(format!("'{path}' not found at commit {oid}")))?;
            let blob = entry
                .to_object(repo)?
                .into_blob()
                .map_err(|_| AppError::Other(format!("'{path}' is not a blob")))?;
            String::from_utf8_lossy(blob.content()).into_owned()
        }
        None => {
            let workdir = repo
                .workdir()
                .ok_or_else(|| AppError::Other("No working directory".into()))?;
            std::fs::read_to_string(workdir.join(path))
                .map_err(|e| AppError::Other(e.to_string()))?
        }
    };

    let file_lines: Vec<&str> = content.lines().collect();
    let mut result: Vec<BlameLine> = Vec::new();

    for hunk in blame.iter() {
        let orig_oid = hunk.orig_commit_id();
        let commit = repo.find_commit(orig_oid)?;
        let sig = commit.author();

        let oid_str = orig_oid.to_string();
        let short_oid = oid_str[..7.min(oid_str.len())].to_string();
        let author_name = sig.name().unwrap_or("?").to_string();
        let author_email = sig.email().unwrap_or("").to_string();
        let timestamp = sig.when().seconds();

        let start = hunk.final_start_line(); // 1-based
        let count = hunk.lines_in_hunk();

        for i in 0..count {
            let line_no = (start + i) as u32;
            let content = file_lines
                .get((line_no - 1) as usize)
                .map(|s| s.to_string())
                .unwrap_or_default();

            result.push(BlameLine {
                line_no,
                content,
                commit_oid: oid_str.clone(),
                short_oid: short_oid.clone(),
                author_name: author_name.clone(),
                author_email: author_email.clone(),
                timestamp,
            });
        }
    }

    result.sort_by_key(|l| l.line_no);
    Ok(result)
}
