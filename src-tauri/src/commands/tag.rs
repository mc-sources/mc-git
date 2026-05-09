use tauri::{AppHandle, State};

use crate::error::{AppError, Result};
use crate::git::types::TagInfo;
use crate::logger::log_result;
use crate::state::AppState;

#[tauri::command]
pub fn list_tags(app: AppHandle, state: State<AppState>) -> Result<Vec<TagInfo>> {
    let result = {
        let guard = state.lock_repo()?;
        let repo = guard.as_ref().ok_or(AppError::NoRepository)?;
        repo.list_tags()
    };
    log_result(&app, "list_tags", result)
}

#[tauri::command]
pub fn create_tag(
    name: String,
    target_oid: String,
    message: Option<String>,
    app: AppHandle,
    state: State<AppState>,
) -> Result<TagInfo> {
    let result = {
        let guard = state.lock_repo()?;
        let repo = guard.as_ref().ok_or(AppError::NoRepository)?;
        repo.create_tag(&name, &target_oid, message.as_deref())
    };
    log_result(&app, &format!("create_tag({name})"), result)
}

#[tauri::command]
pub fn delete_tag(name: String, app: AppHandle, state: State<AppState>) -> Result<()> {
    let result = {
        let guard = state.lock_repo()?;
        let repo = guard.as_ref().ok_or(AppError::NoRepository)?;
        repo.delete_tag(&name)
    };
    log_result(&app, &format!("delete_tag({name})"), result)
}

#[tauri::command]
pub fn push_tag(
    remote_name: String,
    tag_name: String,
    force: bool,
    app: AppHandle,
    state: State<AppState>,
) -> Result<()> {
    let result = {
        let guard = state.lock_repo()?;
        let repo = guard.as_ref().ok_or(AppError::NoRepository)?;
        repo.push_tag(&remote_name, &tag_name, force)
    };
    log_result(
        &app,
        &format!("push_tag({remote_name}/{tag_name}, force={force})"),
        result,
    )
}

#[tauri::command]
pub fn delete_remote_tag(
    remote_name: String,
    tag_name: String,
    app: AppHandle,
    state: State<AppState>,
) -> Result<()> {
    let result = {
        let guard = state.lock_repo()?;
        let repo = guard.as_ref().ok_or(AppError::NoRepository)?;
        repo.delete_remote_tag(&remote_name, &tag_name)
    };
    log_result(
        &app,
        &format!("delete_remote_tag({remote_name}/{tag_name})"),
        result,
    )
}

#[tauri::command]
pub fn list_remote_tags(
    remote_name: String,
    app: AppHandle,
    state: State<AppState>,
) -> Result<Vec<String>> {
    let result = {
        let guard = state.lock_repo()?;
        let repo = guard.as_ref().ok_or(AppError::NoRepository)?;
        repo.list_remote_tags(&remote_name)
    };
    log_result(&app, &format!("list_remote_tags({remote_name})"), result)
}
