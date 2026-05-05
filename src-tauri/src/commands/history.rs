use tauri::{AppHandle, State};

use crate::error::{AppError, Result};
use crate::git::types::{CommitDetail, CommitSummary, LogFilters, ReflogEntry};
use crate::logger::log_result;
use crate::state::AppState;

#[tauri::command]
pub async fn get_log(
    limit: usize,
    offset: usize,
    branch: Option<String>,
    filters: Option<LogFilters>,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<Vec<CommitSummary>> {
    let result = tokio::task::block_in_place(|| {
        let guard = state.lock_repo()?;
        let repo = guard.as_ref().ok_or(AppError::NoRepository)?;
        repo.get_log(limit, offset, branch.as_deref(), filters.as_ref())
    });
    log_result(&app, "get_log", result)
}

#[tauri::command]
pub async fn get_graph_log(
    limit: usize,
    show_all: bool,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<Vec<CommitSummary>> {
    let result = tokio::task::block_in_place(|| {
        let guard = state.lock_repo()?;
        let repo = guard.as_ref().ok_or(AppError::NoRepository)?;
        repo.get_graph_log(limit, show_all)
    });
    log_result(&app, "get_graph_log", result)
}

#[tauri::command]
pub async fn get_commit_detail(
    oid: String,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<CommitDetail> {
    let result = tokio::task::block_in_place(|| {
        let guard = state.lock_repo()?;
        let repo = guard.as_ref().ok_or(AppError::NoRepository)?;
        repo.get_commit_detail(&oid)
    });
    log_result(&app, &format!("get_commit_detail({oid})"), result)
}

#[tauri::command]
pub async fn reset_to_commit(
    oid: String,
    mode: String,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<()> {
    let result = tokio::task::block_in_place(|| {
        let guard = state.lock_repo()?;
        let repo = guard.as_ref().ok_or(AppError::NoRepository)?;
        repo.reset_to_commit(&oid, &mode)
    });
    log_result(&app, &format!("reset_to_commit({oid}, {mode})"), result)
}

#[tauri::command]
pub async fn revert_commit(
    oid: String,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<CommitSummary> {
    let result = tokio::task::block_in_place(|| {
        let guard = state.lock_repo()?;
        let repo = guard.as_ref().ok_or(AppError::NoRepository)?;
        repo.revert_commit(&oid)
    });
    log_result(&app, &format!("revert_commit({oid})"), result)
}

#[tauri::command]
pub async fn get_reflog(
    refname: Option<String>,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<Vec<ReflogEntry>> {
    let refname = refname.unwrap_or_else(|| "HEAD".to_string());
    let result = tokio::task::block_in_place(|| {
        let guard = state.lock_repo()?;
        let repo = guard.as_ref().ok_or(AppError::NoRepository)?;
        repo.get_reflog(&refname)
    });
    log_result(&app, "get_reflog", result)
}
