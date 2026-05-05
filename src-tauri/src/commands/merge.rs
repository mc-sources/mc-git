use tauri::{AppHandle, State};

use crate::error::{AppError, Result};
use crate::git::types::MergeStatus;
use crate::logger::log_result;
use crate::state::AppState;

#[tauri::command]
pub fn merge_branch(
    branch_name: String,
    no_ff: bool,
    app: AppHandle,
    state: State<AppState>,
) -> Result<MergeStatus> {
    let result = {
        let guard = state.lock_repo()?;
        let repo = guard.as_ref().ok_or(AppError::NoRepository)?;
        repo.merge_branch(&branch_name, no_ff)
    };
    log_result(&app, &format!("merge_branch({branch_name}, no_ff={no_ff})"), result)
}

#[tauri::command]
pub fn abort_merge(app: AppHandle, state: State<AppState>) -> Result<()> {
    let result = {
        let guard = state.lock_repo()?;
        let repo = guard.as_ref().ok_or(AppError::NoRepository)?;
        repo.abort_merge()
    };
    log_result(&app, "abort_merge", result)
}

#[tauri::command]
pub fn get_repository_state(app: AppHandle, state: State<AppState>) -> Result<String> {
    let result = {
        let guard = state.lock_repo()?;
        let repo = guard.as_ref().ok_or(AppError::NoRepository)?;
        repo.get_repository_state()
    };
    log_result(&app, "get_repository_state", result)
}
