use git2::{Repository, StashApplyOptions, StashFlags};

use crate::error::{AppError, Result};
use crate::git::types::StashEntry;

pub fn stash_save(
    repo: &mut Repository,
    message: Option<&str>,
    include_untracked: bool,
    keep_index: bool,
) -> Result<String> {
    let sig = repo.signature()?;
    let msg = message.unwrap_or("WIP");
    let mut flags = StashFlags::DEFAULT;
    if include_untracked {
        flags |= StashFlags::INCLUDE_UNTRACKED;
    }
    if keep_index {
        flags |= StashFlags::KEEP_INDEX;
    }
    let oid = repo.stash_save(&sig, msg, Some(flags))?;
    Ok(oid.to_string())
}

pub fn stash_list(repo: &mut Repository) -> Result<Vec<StashEntry>> {
    let mut entries: Vec<StashEntry> = Vec::new();
    repo.stash_foreach(|index, message, oid| {
        entries.push(StashEntry {
            index,
            message: message.to_owned(),
            oid: oid.to_string(),
        });
        true
    })?;
    Ok(entries)
}

pub fn stash_apply(repo: &mut Repository, index: usize) -> Result<()> {
    let mut opts = StashApplyOptions::default();
    repo.stash_apply(index, Some(&mut opts)).map_err(AppError::from)
}

pub fn stash_pop(repo: &mut Repository, index: usize) -> Result<()> {
    let mut opts = StashApplyOptions::default();
    repo.stash_pop(index, Some(&mut opts)).map_err(AppError::from)
}

pub fn stash_drop(repo: &mut Repository, index: usize) -> Result<()> {
    repo.stash_drop(index).map_err(AppError::from)
}
