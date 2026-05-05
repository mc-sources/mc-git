use git2::{build::RepoBuilder, FetchOptions, Repository};
use serde::Serialize;
use std::path::Path;
use tauri::{AppHandle, Emitter};

use crate::error::Result;
use crate::git::credentials::{build_callbacks, remap_cert_error};

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CloneProgress {
    pub received_objects: usize,
    pub total_objects: usize,
    pub indexed_objects: usize,
    pub received_bytes: usize,
    pub percent: u8,
}

/// Clones a remote repository to `target_path`, emitting `git:clone-progress` events via Tauri.
pub fn clone_repository(url: &str, target_path: &str, app: &AppHandle) -> Result<Repository> {
    let app = app.clone();
    let (mut callbacks, cert_error) = build_callbacks();

    callbacks.transfer_progress(move |stats| {
        let percent = if stats.total_objects() > 0 {
            ((stats.received_objects() as f64 / stats.total_objects() as f64) * 100.0) as u8
        } else {
            0
        };
        let progress = CloneProgress {
            received_objects: stats.received_objects(),
            total_objects: stats.total_objects(),
            indexed_objects: stats.indexed_objects(),
            received_bytes: stats.received_bytes(),
            percent,
        };
        let _ = app.emit("git:clone-progress", progress);
        true
    });

    let mut fetch_opts = FetchOptions::new();
    fetch_opts.remote_callbacks(callbacks);

    let repo = RepoBuilder::new()
        .fetch_options(fetch_opts)
        .clone(url, Path::new(target_path))
        .map_err(|e| remap_cert_error(e, &cert_error))?;

    Ok(repo)
}
