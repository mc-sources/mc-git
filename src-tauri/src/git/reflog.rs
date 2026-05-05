use git2::Repository;

use crate::error::Result;
use crate::git::types::ReflogEntry;

pub fn get_reflog(repo: &Repository, refname: &str) -> Result<Vec<ReflogEntry>> {
    let reflog = repo.reflog(refname)?;
    let count = reflog.len();

    let entries: Vec<ReflogEntry> = (0..count)
        .filter_map(|i| reflog.get(i))
        .enumerate()
        .map(|(index, entry)| {
            let oid_new = entry.id_new().to_string();
            let short_oid_new = oid_new.get(..7).unwrap_or(&oid_new).to_string();
            let oid_old = entry.id_old().to_string();
            let message = entry.message().unwrap_or("").to_string();
            let committer = entry.committer();
            let committer_name = committer.name().unwrap_or("").to_string();
            let timestamp = committer.when().seconds();

            ReflogEntry {
                index,
                oid_new,
                short_oid_new,
                oid_old,
                message,
                committer_name,
                timestamp,
            }
        })
        .collect();

    Ok(entries)
}
