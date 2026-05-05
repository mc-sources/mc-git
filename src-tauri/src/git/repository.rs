use git2::Repository;

use crate::error::{AppError, Result};
use crate::git::types::RepoInfo;

pub fn open(path: &str) -> Result<Repository> {
    Ok(Repository::open(path)?)
}

pub fn init(path: &str) -> Result<Repository> {
    Ok(Repository::init(path)?)
}

pub fn repo_info(repo: &Repository) -> Result<RepoInfo> {
    let path = repo
        .workdir()
        .ok_or_else(|| AppError::Other("Bare repositories are not supported".into()))?
        .to_string_lossy()
        .to_string();

    let name = std::path::Path::new(&path)
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| path.clone());

    let (head_branch, head_oid) = match repo.head() {
        Ok(head) => {
            let branch = head.shorthand().map(|s| s.to_string());
            let oid = head.target().map(|o| o.to_string());
            (branch, oid)
        }
        Err(_) => (None, None), // Empty repo (no commits yet)
    };

    Ok(RepoInfo {
        path,
        name,
        head_branch,
        head_oid,
    })
}
