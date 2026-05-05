use tauri::{AppHandle, State};

use crate::error::{AppError, Result};
use crate::git::types::BranchInfo;
use crate::logger::log_result;
use crate::state::AppState;

#[tauri::command]
pub fn list_branches(filter: Option<String>, app: AppHandle, state: State<AppState>) -> Result<Vec<BranchInfo>> {
    let result = {
        let guard = state.lock_repo()?;
        let repo = guard.as_ref().ok_or(AppError::NoRepository)?;
        repo.list_branches(filter.as_deref())
    };
    log_result(&app, "list_branches", result)
}

#[tauri::command]
pub fn create_branch(name: String, from_ref: String, app: AppHandle, state: State<AppState>) -> Result<BranchInfo> {
    let result = {
        let guard = state.lock_repo()?;
        let repo = guard.as_ref().ok_or(AppError::NoRepository)?;
        repo.create_branch(&name, &from_ref)
    };
    log_result(&app, &format!("create_branch({name})"), result)
}

#[tauri::command]
pub fn checkout_branch(name: String, app: AppHandle, state: State<AppState>) -> Result<()> {
    let result = {
        let guard = state.lock_repo()?;
        let repo = guard.as_ref().ok_or(AppError::NoRepository)?;
        repo.checkout_branch(&name)
    };
    log_result(&app, &format!("checkout_branch({name})"), result)
}

#[tauri::command]
pub fn delete_branch(name: String, force: bool, app: AppHandle, state: State<AppState>) -> Result<()> {
    let result = {
        let guard = state.lock_repo()?;
        let repo = guard.as_ref().ok_or(AppError::NoRepository)?;
        repo.delete_branch(&name, force)
    };
    log_result(&app, &format!("delete_branch({name})"), result)
}

#[tauri::command]
pub fn rename_branch(old_name: String, new_name: String, app: AppHandle, state: State<AppState>) -> Result<BranchInfo> {
    let result = {
        let guard = state.lock_repo()?;
        let repo = guard.as_ref().ok_or(AppError::NoRepository)?;
        repo.rename_branch(&old_name, &new_name)
    };
    log_result(&app, &format!("rename_branch({old_name} → {new_name})"), result)
}

#[tauri::command]
pub fn checkout_remote_branch(remote_branch_name: String, app: AppHandle, state: State<AppState>) -> Result<BranchInfo> {
    let result = {
        let guard = state.lock_repo()?;
        let repo = guard.as_ref().ok_or(AppError::NoRepository)?;
        repo.checkout_remote_branch(&remote_branch_name)
    };
    log_result(&app, &format!("checkout_remote_branch({remote_branch_name})"), result)
}

#[tauri::command]
pub fn set_branch_upstream(branch_name: String, upstream: String, app: AppHandle, state: State<AppState>) -> Result<BranchInfo> {
    let result = {
        let guard = state.lock_repo()?;
        let repo = guard.as_ref().ok_or(AppError::NoRepository)?;
        repo.set_branch_upstream(&branch_name, &upstream)
    };
    log_result(&app, &format!("set_branch_upstream({branch_name} → {upstream})"), result)
}

#[tauri::command]
pub fn unset_branch_upstream(branch_name: String, app: AppHandle, state: State<AppState>) -> Result<BranchInfo> {
    let result = {
        let guard = state.lock_repo()?;
        let repo = guard.as_ref().ok_or(AppError::NoRepository)?;
        repo.unset_branch_upstream(&branch_name)
    };
    log_result(&app, &format!("unset_branch_upstream({branch_name})"), result)
}
