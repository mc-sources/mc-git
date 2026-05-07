use tauri::{AppHandle, State};

use crate::error::{AppError, Result};
use crate::git::types::SubmoduleInfo;
use crate::logger::log_result;
use crate::state::AppState;

#[tauri::command]
pub fn list_submodules(app: AppHandle, state: State<AppState>) -> Result<Vec<SubmoduleInfo>> {
    let result = {
        let guard = state.lock_repo()?;
        let repo = guard.as_ref().ok_or(AppError::NoRepository)?;
        repo.list_submodules()
    };
    log_result(&app, "list_submodules", result)
}

#[tauri::command]
pub fn init_submodule(name: String, app: AppHandle, state: State<AppState>) -> Result<()> {
    let result = {
        let guard = state.lock_repo()?;
        let repo = guard.as_ref().ok_or(AppError::NoRepository)?;
        repo.init_submodule(&name)
    };
    log_result(&app, &format!("init_submodule({name})"), result)
}

#[tauri::command]
pub fn update_submodule(name: String, app: AppHandle, state: State<AppState>) -> Result<()> {
    let result = {
        let guard = state.lock_repo()?;
        let repo = guard.as_ref().ok_or(AppError::NoRepository)?;
        repo.update_submodule(&name)
    };
    log_result(&app, &format!("update_submodule({name})"), result)
}

#[tauri::command]
pub fn update_all_submodules(app: AppHandle, state: State<AppState>) -> Result<()> {
    let result = {
        let guard = state.lock_repo()?;
        let repo = guard.as_ref().ok_or(AppError::NoRepository)?;
        repo.update_all_submodules()
    };
    log_result(&app, "update_all_submodules", result)
}

#[tauri::command]
pub fn add_submodule(
    url: String,
    path: String,
    app: AppHandle,
    state: State<AppState>,
) -> Result<()> {
    let result = {
        let guard = state.lock_repo()?;
        let repo = guard.as_ref().ok_or(AppError::NoRepository)?;
        repo.add_submodule(&url, &path)
    };
    log_result(&app, &format!("add_submodule({url}, {path})"), result)
}
