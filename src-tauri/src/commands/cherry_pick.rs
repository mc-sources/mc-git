use tauri::{AppHandle, State};

use crate::error::{AppError, Result};
use crate::git::types::{CherryPickStatus, CommitSummary};
use crate::logger::log_result;
use crate::state::AppState;

#[tauri::command]
pub fn cherry_pick(
    oid: String,
    app: AppHandle,
    state: State<AppState>,
) -> Result<CherryPickStatus> {
    let result = {
        let guard = state.lock_repo()?;
        let repo = guard.as_ref().ok_or(AppError::NoRepository)?;
        repo.cherry_pick(&oid)
    };
    log_result(&app, &format!("cherry_pick({oid})"), result)
}

#[tauri::command]
pub fn continue_cherry_pick(app: AppHandle, state: State<AppState>) -> Result<CommitSummary> {
    let result = {
        let guard = state.lock_repo()?;
        let repo = guard.as_ref().ok_or(AppError::NoRepository)?;
        repo.continue_cherry_pick()
    };
    log_result(&app, "continue_cherry_pick", result)
}

#[tauri::command]
pub fn abort_cherry_pick(app: AppHandle, state: State<AppState>) -> Result<()> {
    let result = {
        let guard = state.lock_repo()?;
        let repo = guard.as_ref().ok_or(AppError::NoRepository)?;
        repo.abort_cherry_pick()
    };
    log_result(&app, "abort_cherry_pick", result)
}
