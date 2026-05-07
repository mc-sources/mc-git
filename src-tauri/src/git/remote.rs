use git2::{MergeOptions, Repository};

use crate::error::{AppError, Result};
use crate::git::credentials::{build_callbacks, remap_cert_error};
use crate::git::types::{RemoteFetchResult, RemoteInfo};

pub fn list_remotes(repo: &Repository) -> Result<Vec<RemoteInfo>> {
    let remote_names = repo.remotes()?;
    let mut remotes = Vec::new();

    for name in remote_names.iter().flatten() {
        if let Ok(remote) = repo.find_remote(name) {
            remotes.push(RemoteInfo {
                name: name.to_string(),
                url: remote.url().unwrap_or("").to_string(),
                push_url: remote.pushurl().map(|u| u.to_string()),
            });
        }
    }

    Ok(remotes)
}

pub fn add_remote(repo: &Repository, name: &str, url: &str) -> Result<RemoteInfo> {
    let remote = repo.remote(name, url)?;
    Ok(RemoteInfo {
        name: remote.name().unwrap_or("").to_string(),
        url: remote.url().unwrap_or("").to_string(),
        push_url: remote.pushurl().map(|u| u.to_string()),
    })
}

pub fn remove_remote(repo: &Repository, name: &str) -> Result<()> {
    repo.remote_delete(name)?;
    Ok(())
}

pub fn fetch(
    repo: &Repository,
    remote_name: &str,
    on_progress: Option<Box<dyn Fn(u32, u32) + Send>>,
) -> Result<()> {
    let mut remote = repo.find_remote(remote_name)?;

    let (mut callbacks, cert_err) = build_callbacks();

    if let Some(cb) = on_progress {
        let mut last_pct = u32::MAX;
        callbacks.transfer_progress(move |stats| {
            let total = stats.total_objects() as u32;
            if total > 0 {
                let current = stats.received_objects() as u32;
                let pct = current * 100 / total;
                if pct != last_pct {
                    last_pct = pct;
                    cb(current, total);
                }
            }
            true
        });
    }

    let mut fetch_opts = git2::FetchOptions::new();
    fetch_opts.remote_callbacks(callbacks);
    fetch_opts.download_tags(git2::AutotagOption::Unspecified);

    remote
        .fetch(&[] as &[&str], Some(&mut fetch_opts), None)
        .map_err(|e| remap_cert_error(e, &cert_err))?;
    Ok(())
}

pub fn push(
    repo: &Repository,
    remote_name: &str,
    branch: &str,
    on_progress: Option<Box<dyn Fn(u32, u32) + Send>>,
) -> Result<()> {
    let mut remote = repo.find_remote(remote_name)?;

    let (mut callbacks, cert_err) = build_callbacks();

    if let Some(cb) = on_progress {
        let mut last_pct = u32::MAX;
        callbacks.push_transfer_progress(move |current, total, _bytes| {
            let total = total as u32;
            let current = current as u32;
            if total > 0 {
                let pct = current * 100 / total;
                if pct != last_pct {
                    last_pct = pct;
                    cb(current, total);
                }
            }
        });
    }

    let mut push_opts = git2::PushOptions::new();
    push_opts.remote_callbacks(callbacks);

    let refspec = format!("refs/heads/{branch}:refs/heads/{branch}");
    remote
        .push(&[refspec.as_str()], Some(&mut push_opts))
        .map_err(|e| remap_cert_error(e, &cert_err))?;
    Ok(())
}

pub fn pull(
    repo: &Repository,
    remote_name: &str,
    branch: &str,
    on_progress: Option<Box<dyn Fn(u32, u32) + Send>>,
) -> Result<()> {
    // 1. Fetch with progress
    fetch(repo, remote_name, on_progress)?;

    // 2. Find the remote tracking branch
    let remote_ref = format!("refs/remotes/{remote_name}/{branch}");
    let fetch_head = repo
        .find_reference(&remote_ref)
        .or_else(|_| repo.find_reference("FETCH_HEAD"))?;

    let fetch_commit = repo.reference_to_annotated_commit(&fetch_head)?;

    // 3. Merge analysis
    let (analysis, _) = repo.merge_analysis(&[&fetch_commit])?;

    if analysis.is_up_to_date() {
        return Ok(());
    }

    if analysis.is_fast_forward() {
        // Fast-forward: move HEAD ref directly
        let refname = format!("refs/heads/{branch}");
        let mut reference = repo.find_reference(&refname)?;
        reference.set_target(fetch_commit.id(), "pull: Fast-forward")?;
        repo.set_head(&refname)?;
        let mut checkout_opts = git2::build::CheckoutBuilder::new();
        checkout_opts.force();
        repo.checkout_head(Some(&mut checkout_opts))?;
        return Ok(());
    }

    if analysis.is_normal() {
        // Regular merge commit
        let head_commit = repo
            .head()?
            .target()
            .and_then(|oid| repo.find_commit(oid).ok())
            .ok_or_else(|| AppError::Other("HEAD commit not found".into()))?;

        let remote_commit = repo.find_commit(fetch_commit.id())?;

        let mut merge_opts = MergeOptions::new();
        let mut checkout_opts = git2::build::CheckoutBuilder::new();
        checkout_opts.force();

        repo.merge(
            &[&fetch_commit],
            Some(&mut merge_opts),
            Some(&mut checkout_opts),
        )?;

        // Check for conflicts — leave MERGE_HEAD intact so the repo state stays "merge"
        let index = repo.index()?;
        if index.has_conflicts() {
            return Err(AppError::Other(
                "Conflits de fusion détectés. Résolvez-les manuellement.".into(),
            ));
        }

        // Create merge commit
        let sig = repo.signature()?;
        let mut index = repo.index()?;
        let tree_oid = index.write_tree()?;
        let tree = repo.find_tree(tree_oid)?;
        let message = format!("Merge remote-tracking branch '{remote_name}/{branch}'");
        repo.commit(
            Some("HEAD"),
            &sig,
            &sig,
            &message,
            &tree,
            &[&head_commit, &remote_commit],
        )?;
        repo.cleanup_state()?;
        return Ok(());
    }

    Err(AppError::Other(
        "Impossible de fusionner: état du dépôt inattendu".into(),
    ))
}

pub fn fetch_all(repo: &Repository) -> Vec<RemoteFetchResult> {
    let remote_names = match repo.remotes() {
        Ok(names) => names,
        Err(e) => {
            return vec![RemoteFetchResult {
                remote: "*".into(),
                ok: false,
                error: Some(e.message().to_string()),
            }]
        }
    };
    let names: Vec<String> = remote_names
        .iter()
        .flatten()
        .map(|s| s.to_string())
        .collect();
    let mut results = Vec::new();
    for name in names {
        match fetch(repo, &name, None) {
            Ok(()) => results.push(RemoteFetchResult {
                remote: name,
                ok: true,
                error: None,
            }),
            Err(e) => results.push(RemoteFetchResult {
                remote: name,
                ok: false,
                error: Some(e.to_string()),
            }),
        }
    }
    results
}

pub fn prune_remote(repo: &Repository, remote_name: &str) -> Result<()> {
    let mut remote = repo.find_remote(remote_name)?;
    let (cbs, cert_err) = build_callbacks();
    remote
        .connect_auth(git2::Direction::Fetch, Some(cbs), None)
        .map_err(|e| remap_cert_error(e, &cert_err))?;
    let (cbs2, _) = build_callbacks();
    remote.prune(Some(cbs2))?;
    remote.disconnect()?;
    Ok(())
}
