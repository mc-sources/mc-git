use tauri::{AppHandle, State};

use crate::error::{AppError, Result};
use crate::git::types::CommitSummary;
use crate::logger::log_result;
use crate::state::AppState;

#[tauri::command]
pub fn create_commit(message: String, app: AppHandle, state: State<AppState>) -> Result<CommitSummary> {
    let result = {
        let guard = state.lock_repo()?;
        let repo = guard.as_ref().ok_or(AppError::NoRepository)?;
        repo.create_commit(&message)
    };
    log_result(&app, "create_commit", result)
}

#[tauri::command]
pub fn amend_commit(message: String, app: AppHandle, state: State<AppState>) -> Result<CommitSummary> {
    let result = {
        let guard = state.lock_repo()?;
        let repo = guard.as_ref().ok_or(AppError::NoRepository)?;
        repo.amend_commit(&message)
    };
    log_result(&app, "amend_commit", result)
}

#[tauri::command]
pub fn get_head_commit(app: AppHandle, state: State<AppState>) -> Result<CommitSummary> {
    let result = {
        let guard = state.lock_repo()?;
        let repo = guard.as_ref().ok_or(AppError::NoRepository)?;
        repo.get_head_commit()
    };
    log_result(&app, "get_head_commit", result)
}
