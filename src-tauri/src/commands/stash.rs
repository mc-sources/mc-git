use tauri::{AppHandle, State};

use crate::error::{AppError, Result};
use crate::git::types::StashEntry;
use crate::logger::log_result;
use crate::state::AppState;

#[tauri::command]
pub fn stash_save(
    message: Option<String>,
    include_untracked: bool,
    keep_index: bool,
    app: AppHandle,
    state: State<AppState>,
) -> Result<String> {
    let result = {
        let guard = state.lock_repo()?;
        let repo = guard.as_ref().ok_or(AppError::NoRepository)?;
        repo.stash_save(message.as_deref(), include_untracked, keep_index)
    };
    log_result(&app, "stash_save", result)
}

#[tauri::command]
pub fn stash_list(app: AppHandle, state: State<AppState>) -> Result<Vec<StashEntry>> {
    let result = {
        let guard = state.lock_repo()?;
        let repo = guard.as_ref().ok_or(AppError::NoRepository)?;
        repo.stash_list()
    };
    log_result(&app, "stash_list", result)
}

#[tauri::command]
pub fn stash_apply(index: usize, app: AppHandle, state: State<AppState>) -> Result<()> {
    let result = {
        let guard = state.lock_repo()?;
        let repo = guard.as_ref().ok_or(AppError::NoRepository)?;
        repo.stash_apply(index)
    };
    log_result(&app, "stash_apply", result)
}

#[tauri::command]
pub fn stash_pop(index: usize, app: AppHandle, state: State<AppState>) -> Result<()> {
    let result = {
        let guard = state.lock_repo()?;
        let repo = guard.as_ref().ok_or(AppError::NoRepository)?;
        repo.stash_pop(index)
    };
    log_result(&app, "stash_pop", result)
}

#[tauri::command]
pub fn stash_drop(index: usize, app: AppHandle, state: State<AppState>) -> Result<()> {
    let result = {
        let guard = state.lock_repo()?;
        let repo = guard.as_ref().ok_or(AppError::NoRepository)?;
        repo.stash_drop(index)
    };
    log_result(&app, "stash_drop", result)
}
