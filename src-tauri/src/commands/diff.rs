use tauri::{AppHandle, State};

use crate::error::{AppError, Result};
use crate::git::types::{BlameLine, FileDiff};
use crate::logger::log_result;
use crate::state::AppState;

#[tauri::command]
pub async fn get_file_diff(
    path: String,
    staged: bool,
    ignore_whitespace: bool,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<FileDiff> {
    let result = tokio::task::block_in_place(|| {
        let guard = state.lock_repo()?;
        let repo = guard.as_ref().ok_or(AppError::NoRepository)?;
        repo.get_file_diff(&path, staged, ignore_whitespace)
    });
    log_result(&app, &format!("get_file_diff({path}, staged={staged}, ignore_ws={ignore_whitespace})"), result)
}

#[tauri::command]
pub async fn get_commit_diff(
    oid: String,
    ignore_whitespace: bool,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<Vec<FileDiff>> {
    let result = tokio::task::block_in_place(|| {
        let guard = state.lock_repo()?;
        let repo = guard.as_ref().ok_or(AppError::NoRepository)?;
        repo.get_commit_diff(&oid, ignore_whitespace)
    });
    log_result(&app, &format!("get_commit_diff({oid})"), result)
}

#[tauri::command]
pub async fn get_commit_file_diff(
    oid: String,
    path: String,
    ignore_whitespace: bool,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<FileDiff> {
    let result = tokio::task::block_in_place(|| {
        let guard = state.lock_repo()?;
        let repo = guard.as_ref().ok_or(AppError::NoRepository)?;
        repo.get_commit_file_diff(&oid, &path, ignore_whitespace)
    });
    log_result(&app, &format!("get_commit_file_diff({oid}, {path})"), result)
}

#[tauri::command]
pub async fn get_blame(
    path: String,
    commit_oid: Option<String>,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<Vec<BlameLine>> {
    let result = tokio::task::block_in_place(|| {
        let guard = state.lock_repo()?;
        let repo = guard.as_ref().ok_or(AppError::NoRepository)?;
        repo.get_blame(&path, commit_oid.as_deref())
    });
    log_result(&app, &format!("get_blame({path})"), result)
}
