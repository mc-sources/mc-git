use tauri::{AppHandle, State};

use crate::error::{AppError, Result};
use crate::git::types::{BranchInfo, GitFlowConfig};
use crate::logger::log_result;
use crate::state::AppState;

#[tauri::command]
pub fn get_gitflow_config(state: State<AppState>) -> Option<GitFlowConfig> {
    let guard = state.lock_repo().ok()?;
    let repo = guard.as_ref()?;
    repo.get_gitflow_config()
}

#[tauri::command]
pub fn init_gitflow(config: GitFlowConfig, app: AppHandle, state: State<AppState>) -> Result<()> {
    let result = {
        let guard = state.lock_repo()?;
        let repo = guard.as_ref().ok_or(AppError::NoRepository)?;
        repo.init_gitflow(&config)
    };
    log_result(&app, "init_gitflow", result)
}

#[tauri::command]
pub fn start_gitflow_branch(
    kind: String,
    name: String,
    app: AppHandle,
    state: State<AppState>,
) -> Result<BranchInfo> {
    let result = {
        let guard = state.lock_repo()?;
        let repo = guard.as_ref().ok_or(AppError::NoRepository)?;
        repo.start_gitflow_branch(&kind, &name)
    };
    log_result(
        &app,
        &format!("start_gitflow_branch({kind}/{name})"),
        result,
    )
}

#[tauri::command]
pub fn finish_gitflow_branch(
    kind: String,
    name: String,
    app: AppHandle,
    state: State<AppState>,
) -> Result<()> {
    let result = {
        let guard = state.lock_repo()?;
        let repo = guard.as_ref().ok_or(AppError::NoRepository)?;
        repo.finish_gitflow_branch(&kind, &name)
    };
    log_result(
        &app,
        &format!("finish_gitflow_branch({kind}/{name})"),
        result,
    )
}
