use tauri::{AppHandle, State};

use crate::error::{AppError, Result};
use crate::events::progress::{emit_progress, emit_progress_done};
use crate::git::types::{RemoteFetchResult, RemoteInfo};
use crate::logger::log_result;
use crate::state::AppState;

#[tauri::command]
pub fn list_remotes(app: AppHandle, state: State<AppState>) -> Result<Vec<RemoteInfo>> {
    let result = {
        let guard = state.lock_repo()?;
        let repo = guard.as_ref().ok_or(AppError::NoRepository)?;
        repo.list_remotes()
    };
    log_result(&app, "list_remotes", result)
}

#[tauri::command]
pub fn add_remote(
    name: String,
    url: String,
    app: AppHandle,
    state: State<AppState>,
) -> Result<RemoteInfo> {
    let result = {
        let guard = state.lock_repo()?;
        let repo = guard.as_ref().ok_or(AppError::NoRepository)?;
        repo.add_remote(&name, &url)
    };
    log_result(&app, &format!("add_remote({name})"), result)
}

#[tauri::command]
pub fn remove_remote(name: String, app: AppHandle, state: State<AppState>) -> Result<()> {
    let result = {
        let guard = state.lock_repo()?;
        let repo = guard.as_ref().ok_or(AppError::NoRepository)?;
        repo.remove_remote(&name)
    };
    log_result(&app, &format!("remove_remote({name})"), result)
}

#[tauri::command]
pub fn fetch_remote(remote_name: String, app: AppHandle, state: State<AppState>) -> Result<()> {
    emit_progress(&app, "fetch", "Connexion au remote…", None);
    let app2 = app.clone();
    let result: Result<()> = (|| {
        let guard = state.lock_repo()?;
        let repo = guard.as_ref().ok_or(AppError::NoRepository)?;
        repo.fetch_remote_with_progress(
            &remote_name,
            Box::new(move |current, total| {
                let pct = current.checked_mul(100).and_then(|n| n.checked_div(total));
                emit_progress(&app2, "fetch", "Réception des objets…", pct);
            }),
        )
    })();
    emit_progress_done(&app, "fetch");
    log_result(&app, &format!("fetch({remote_name})"), result)
}

#[tauri::command]
pub fn push_remote(
    remote_name: String,
    branch: String,
    app: AppHandle,
    state: State<AppState>,
) -> Result<()> {
    emit_progress(&app, "push", "Envoi des objets…", None);
    let app2 = app.clone();
    let result: Result<()> = (|| {
        let guard = state.lock_repo()?;
        let repo = guard.as_ref().ok_or(AppError::NoRepository)?;
        repo.push_remote_with_progress(
            &remote_name,
            &branch,
            Box::new(move |current, total| {
                let pct = current.checked_mul(100).and_then(|n| n.checked_div(total));
                emit_progress(&app2, "push", "Envoi des objets…", pct);
            }),
        )
    })();
    emit_progress_done(&app, "push");
    log_result(&app, &format!("push({remote_name}/{branch})"), result)
}

#[tauri::command]
pub fn push_force_with_lease(
    remote_name: String,
    branch: String,
    app: AppHandle,
    state: State<AppState>,
) -> Result<()> {
    emit_progress(&app, "push", "Force push with lease…", None);
    let result: Result<()> = (|| {
        let guard = state.lock_repo()?;
        let repo = guard.as_ref().ok_or(AppError::NoRepository)?;
        repo.push_force_with_lease(&remote_name, &branch)
    })();
    emit_progress_done(&app, "push");
    log_result(
        &app,
        &format!("push_force_with_lease({remote_name}/{branch})"),
        result,
    )
}

#[tauri::command]
pub fn pull_remote(
    remote_name: String,
    branch: String,
    app: AppHandle,
    state: State<AppState>,
) -> Result<()> {
    emit_progress(&app, "pull", "Connexion au remote…", None);
    let app2 = app.clone();
    let result: Result<()> = (|| {
        let guard = state.lock_repo()?;
        let repo = guard.as_ref().ok_or(AppError::NoRepository)?;
        repo.pull_remote_with_progress(
            &remote_name,
            &branch,
            Box::new(move |current, total| {
                let pct = current.checked_mul(100).and_then(|n| n.checked_div(total));
                emit_progress(&app2, "pull", "Réception des objets…", pct);
            }),
        )
    })();
    emit_progress_done(&app, "pull");
    log_result(&app, &format!("pull({remote_name}/{branch})"), result)
}

#[tauri::command]
pub fn fetch_all_remotes(app: AppHandle, state: State<AppState>) -> Result<Vec<RemoteFetchResult>> {
    emit_progress(&app, "fetch", "Fetch all…", None);
    let result: Result<Vec<RemoteFetchResult>> = (|| {
        let guard = state.lock_repo()?;
        let repo = guard.as_ref().ok_or(AppError::NoRepository)?;
        Ok(repo.fetch_all_remotes())
    })();
    emit_progress_done(&app, "fetch");
    log_result(&app, "fetch_all_remotes", result)
}

#[tauri::command]
pub fn prune_remote(remote_name: String, app: AppHandle, state: State<AppState>) -> Result<()> {
    let result = {
        let guard = state.lock_repo()?;
        let repo = guard.as_ref().ok_or(AppError::NoRepository)?;
        repo.prune_remote(&remote_name)
    };
    log_result(&app, &format!("prune_remote({remote_name})"), result)
}
