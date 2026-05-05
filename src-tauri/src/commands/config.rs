use tauri::{AppHandle, State};

use crate::error::{AppError, Result};
use crate::logger::log_result;
use crate::state::AppState;

#[tauri::command]
pub fn get_git_config(
    key: String,
    global: bool,
    app: AppHandle,
    state: State<AppState>,
) -> Result<Option<String>> {
    let result = {
        let guard = state.lock_repo()?;
        let repo = guard.as_ref().ok_or(AppError::NoRepository)?;
        repo.get_git_config(&key, global)
    };
    log_result(&app, &format!("get_git_config({key}, global={global})"), result)
}

#[tauri::command]
pub fn set_git_config(
    key: String,
    value: String,
    global: bool,
    app: AppHandle,
    state: State<AppState>,
) -> Result<()> {
    let result = {
        let guard = state.lock_repo()?;
        let repo = guard.as_ref().ok_or(AppError::NoRepository)?;
        repo.set_git_config(&key, &value, global)
    };
    log_result(&app, &format!("set_git_config({key}, global={global})"), result)
}
