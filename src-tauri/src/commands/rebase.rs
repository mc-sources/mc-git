use tauri::{AppHandle, State};

use crate::error::{AppError, Result};
use crate::git::types::{RebaseEntry, RebaseStatus, RebaseStep};
use crate::logger::log_result;
use crate::state::AppState;

#[tauri::command]
pub fn rebase_branch(
    onto_branch: String,
    app: AppHandle,
    state: State<AppState>,
) -> Result<RebaseStatus> {
    let result = {
        let guard = state.lock_repo()?;
        let repo = guard.as_ref().ok_or(AppError::NoRepository)?;
        repo.rebase_branch(&onto_branch)
    };
    log_result(&app, &format!("rebase_branch({onto_branch})"), result)
}

#[tauri::command]
pub fn continue_rebase(app: AppHandle, state: State<AppState>) -> Result<RebaseStatus> {
    let result = {
        let guard = state.lock_repo()?;
        let repo = guard.as_ref().ok_or(AppError::NoRepository)?;
        repo.continue_rebase()
    };
    log_result(&app, "continue_rebase", result)
}

#[tauri::command]
pub fn abort_rebase(app: AppHandle, state: State<AppState>) -> Result<()> {
    let result = {
        let guard = state.lock_repo()?;
        let repo = guard.as_ref().ok_or(AppError::NoRepository)?;
        repo.abort_rebase()
    };
    log_result(&app, "abort_rebase", result)
}

#[tauri::command]
pub fn get_interactive_rebase_commits(
    upstream_oid: String,
    app: AppHandle,
    state: State<AppState>,
) -> Result<Vec<RebaseEntry>> {
    let result = {
        let guard = state.lock_repo()?;
        let repo = guard.as_ref().ok_or(AppError::NoRepository)?;
        repo.get_interactive_rebase_commits(&upstream_oid)
    };
    log_result(
        &app,
        &format!("get_interactive_rebase_commits({upstream_oid})"),
        result,
    )
}

#[tauri::command]
pub fn apply_interactive_rebase(
    upstream_oid: String,
    steps: Vec<RebaseStep>,
    app: AppHandle,
    state: State<AppState>,
) -> Result<RebaseStatus> {
    let result = {
        let guard = state.lock_repo()?;
        let repo = guard.as_ref().ok_or(AppError::NoRepository)?;
        repo.apply_interactive_rebase(&upstream_oid, steps)
    };
    log_result(
        &app,
        &format!("apply_interactive_rebase({upstream_oid})"),
        result,
    )
}
