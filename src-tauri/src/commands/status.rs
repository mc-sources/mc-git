use tauri::{AppHandle, State};

use crate::error::{AppError, Result};
use crate::git::types::StatusEntry;
use crate::logger::log_result;
use crate::state::AppState;

#[tauri::command]
pub fn list_tracked_files(app: AppHandle, state: State<AppState>) -> Result<Vec<String>> {
    let result = {
        let guard = state.lock_repo()?;
        let repo = guard.as_ref().ok_or(AppError::NoRepository)?;
        repo.list_tracked_files()
    };
    log_result(&app, "list_tracked_files", result)
}

#[tauri::command]
pub fn get_status(app: AppHandle, state: State<AppState>) -> Result<Vec<StatusEntry>> {
    let result = {
        let guard = state.lock_repo()?;
        let repo = guard.as_ref().ok_or(AppError::NoRepository)?;
        repo.get_status()
    };
    log_result(&app, "get_status", result)
}

#[tauri::command]
pub fn stage_file(path: String, app: AppHandle, state: State<AppState>) -> Result<()> {
    let result = {
        let guard = state.lock_repo()?;
        let repo = guard.as_ref().ok_or(AppError::NoRepository)?;
        repo.stage_file(&path)
    };
    log_result(&app, &format!("stage_file({path})"), result)
}

#[tauri::command]
pub fn unstage_file(path: String, app: AppHandle, state: State<AppState>) -> Result<()> {
    let result = {
        let guard = state.lock_repo()?;
        let repo = guard.as_ref().ok_or(AppError::NoRepository)?;
        repo.unstage_file(&path)
    };
    log_result(&app, &format!("unstage_file({path})"), result)
}

#[tauri::command]
pub fn stage_paths(paths: Vec<String>, app: AppHandle, state: State<AppState>) -> Result<()> {
    let result = {
        let guard = state.lock_repo()?;
        let repo = guard.as_ref().ok_or(AppError::NoRepository)?;
        let refs: Vec<&str> = paths.iter().map(|s| s.as_str()).collect();
        repo.stage_paths(&refs)
    };
    log_result(&app, &format!("stage_paths({} files)", paths.len()), result)
}

#[tauri::command]
pub fn unstage_paths(paths: Vec<String>, app: AppHandle, state: State<AppState>) -> Result<()> {
    let result = {
        let guard = state.lock_repo()?;
        let repo = guard.as_ref().ok_or(AppError::NoRepository)?;
        let refs: Vec<&str> = paths.iter().map(|s| s.as_str()).collect();
        repo.unstage_paths(&refs)
    };
    log_result(&app, &format!("unstage_paths({} files)", paths.len()), result)
}

#[tauri::command]
pub fn discard_changes(path: String, app: AppHandle, state: State<AppState>) -> Result<()> {
    let result = {
        let guard = state.lock_repo()?;
        let repo = guard.as_ref().ok_or(AppError::NoRepository)?;
        repo.discard_changes(&path)
    };
    log_result(&app, &format!("discard_changes({path})"), result)
}

#[tauri::command]
pub fn discard_all(app: AppHandle, state: State<AppState>) -> Result<()> {
    let result = {
        let guard = state.lock_repo()?;
        let repo = guard.as_ref().ok_or(AppError::NoRepository)?;
        repo.discard_all()
    };
    log_result(&app, "discard_all", result)
}

#[tauri::command]
pub fn resolve_deletion_accept(path: String, app: AppHandle, state: State<AppState>) -> Result<()> {
    let result = {
        let guard = state.lock_repo()?;
        let repo = guard.as_ref().ok_or(AppError::NoRepository)?;
        repo.resolve_deletion_accept(&path)
    };
    log_result(&app, &format!("resolve_deletion_accept({path})"), result)
}

#[tauri::command]
pub fn resolve_deletion_restore(path: String, app: AppHandle, state: State<AppState>) -> Result<()> {
    let result = {
        let guard = state.lock_repo()?;
        let repo = guard.as_ref().ok_or(AppError::NoRepository)?;
        repo.resolve_deletion_restore(&path)
    };
    log_result(&app, &format!("resolve_deletion_restore({path})"), result)
}

#[tauri::command]
pub fn resolve_deletion_accept_theirs(path: String, app: AppHandle, state: State<AppState>) -> Result<()> {
    let result = {
        let guard = state.lock_repo()?;
        let repo = guard.as_ref().ok_or(AppError::NoRepository)?;
        repo.resolve_deletion_accept_theirs(&path)
    };
    log_result(&app, &format!("resolve_deletion_accept_theirs({path})"), result)
}

#[tauri::command]
pub fn resolve_deletion_keep_ours(path: String, app: AppHandle, state: State<AppState>) -> Result<()> {
    let result = {
        let guard = state.lock_repo()?;
        let repo = guard.as_ref().ok_or(AppError::NoRepository)?;
        repo.resolve_deletion_keep_ours(&path)
    };
    log_result(&app, &format!("resolve_deletion_keep_ours({path})"), result)
}

#[tauri::command]
pub fn stage_all(app: AppHandle, state: State<AppState>) -> Result<()> {
    let result = {
        let guard = state.lock_repo()?;
        let repo = guard.as_ref().ok_or(AppError::NoRepository)?;
        repo.stage_all()
    };
    log_result(&app, "stage_all", result)
}

#[tauri::command]
pub fn write_and_stage_file(
    path: String,
    content: String,
    app: AppHandle,
    state: State<AppState>,
) -> Result<()> {
    let result = {
        let guard = state.lock_repo()?;
        let repo = guard.as_ref().ok_or(AppError::NoRepository)?;
        repo.write_and_stage_file(&path, &content)
    };
    log_result(&app, &format!("write_and_stage_file({path})"), result)
}

#[tauri::command]
pub fn unstage_all(app: AppHandle, state: State<AppState>) -> Result<()> {
    let result = {
        let guard = state.lock_repo()?;
        let repo = guard.as_ref().ok_or(AppError::NoRepository)?;
        repo.unstage_all()
    };
    log_result(&app, "unstage_all", result)
}

#[tauri::command]
pub fn reset_conflict_file(path: String, app: AppHandle, state: State<AppState>) -> Result<()> {
    let result = {
        let guard = state.lock_repo()?;
        let repo = guard.as_ref().ok_or(AppError::NoRepository)?;
        repo.reset_conflict_file(&path)
    };
    log_result(&app, &format!("reset_conflict_file({path})"), result)
}

#[tauri::command]
pub fn reset_staged_conflict_file(
    path: String,
    app: AppHandle,
    state: State<AppState>,
) -> Result<()> {
    let result = {
        let guard = state.lock_repo()?;
        let repo = guard.as_ref().ok_or(AppError::NoRepository)?;
        repo.reset_staged_conflict_file(&path)
    };
    log_result(&app, &format!("reset_staged_conflict_file({path})"), result)
}

#[tauri::command]
pub fn reset_all_conflict_files(app: AppHandle, state: State<AppState>) -> Result<()> {
    let result = {
        let guard = state.lock_repo()?;
        let repo = guard.as_ref().ok_or(AppError::NoRepository)?;
        repo.reset_all_conflict_files()
    };
    log_result(&app, "reset_all_conflict_files", result)
}

#[tauri::command]
pub fn stage_hunk(
    path: String,
    hunk_index: usize,
    selected: Option<Vec<usize>>,
    app: AppHandle,
    state: State<AppState>,
) -> Result<()> {
    let result = {
        let guard = state.lock_repo()?;
        let repo = guard.as_ref().ok_or(AppError::NoRepository)?;
        repo.stage_hunk(&path, hunk_index, selected.as_deref())
    };
    log_result(&app, &format!("stage_hunk({path}, {hunk_index})"), result)
}

#[tauri::command]
pub fn unstage_hunk(
    path: String,
    hunk_index: usize,
    selected: Option<Vec<usize>>,
    app: AppHandle,
    state: State<AppState>,
) -> Result<()> {
    let result = {
        let guard = state.lock_repo()?;
        let repo = guard.as_ref().ok_or(AppError::NoRepository)?;
        repo.unstage_hunk(&path, hunk_index, selected.as_deref())
    };
    log_result(&app, &format!("unstage_hunk({path}, {hunk_index})"), result)
}
