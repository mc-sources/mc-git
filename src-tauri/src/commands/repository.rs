use tauri::{AppHandle, State};

use crate::domain::ports::repository::GitRepository;
use crate::error::{AppError, Result};
use crate::git::{clone as git_clone, types::RepoInfo};
use crate::infrastructure::cli_impl::CliGitRepository;
use crate::infrastructure::git2_impl::Git2Repository;
use crate::logger::{emit_info, log_result};
use crate::state::AppState;

#[tauri::command]
pub fn open_repository(
    path: String,
    tab_id: String,
    backend: Option<String>,
    app: AppHandle,
    state: State<AppState>,
) -> Result<RepoInfo> {
    let result = (|| {
        let repo: Box<dyn GitRepository> = match backend.as_deref() {
            Some("cli") => Box::new(CliGitRepository::open(&path)?),
            _ => Box::new(Git2Repository::open(&path)?),
        };
        let info = repo.repo_info()?;
        state.activate_tab(&tab_id, repo)?;
        Ok(info)
    })();
    log_result(&app, "open_repository", result)
}

#[tauri::command]
pub fn init_repository(
    path: String,
    tab_id: String,
    backend: Option<String>,
    app: AppHandle,
    state: State<AppState>,
) -> Result<RepoInfo> {
    let result = (|| {
        let repo: Box<dyn GitRepository> = match backend.as_deref() {
            Some("cli") => Box::new(CliGitRepository::init(&path)?),
            _ => Box::new(Git2Repository::init(&path)?),
        };
        let info = repo.repo_info()?;
        state.activate_tab(&tab_id, repo)?;
        Ok(info)
    })();
    log_result(&app, "init_repository", result)
}

#[tauri::command]
pub fn detect_git_binary(app: AppHandle) -> Result<(String, String)> {
    let version_out = std::process::Command::new("git")
        .arg("--version")
        .output()
        .map_err(|_| AppError::Other("git introuvable dans le PATH".into()))?;
    if !version_out.status.success() {
        return Err(AppError::Other("git introuvable dans le PATH".into()));
    }
    let version = String::from_utf8_lossy(&version_out.stdout).trim().to_string();

    #[cfg(target_os = "windows")]
    let which_cmd = "where";
    #[cfg(not(target_os = "windows"))]
    let which_cmd = "which";

    let path = std::process::Command::new(which_cmd)
        .arg("git")
        .output()
        .ok()
        .filter(|o| o.status.success())
        .and_then(|o| {
            String::from_utf8(o.stdout).ok()
        })
        .map(|s| s.trim().lines().next().unwrap_or("git").to_string())
        .unwrap_or_else(|| "git".to_string());

    log_result(&app, "detect_git_binary", Ok((path, version)))
}

#[tauri::command]
pub fn get_repo_info(app: AppHandle, state: State<AppState>) -> Result<RepoInfo> {
    let result = {
        let guard = state.lock_repo()?;
        let repo = guard.as_ref().ok_or(AppError::NoRepository)?;
        repo.repo_info()
    };
    log_result(&app, "get_repo_info", result)
}

#[tauri::command]
pub async fn clone_repository(
    url: String,
    path: String,
    tab_id: String,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<RepoInfo> {
    // Run the blocking git2 clone on a dedicated thread so the async runtime
    // (and therefore the GTK event loop / webview) stays responsive.
    let app_clone = app.clone();
    let inner = tauri::async_runtime::spawn_blocking(move || {
        git_clone::clone_repository(&url, &path, &app_clone)
    })
    .await
    .map_err(|e| AppError::Other(e.to_string()))??;

    let repo = Git2Repository::from_raw(inner);
    let result = (|| {
        let info = repo.repo_info()?;
        state.activate_tab(&tab_id, Box::new(repo))?;
        Ok(info)
    })();
    log_result(&app, "clone_repository", result)
}

#[tauri::command]
pub fn close_repository(app: AppHandle, state: State<AppState>) {
    if let Ok(mut guard) = state.lock_repo() { *guard = None; }
    emit_info(&app, "close_repository", "Repository closed");
}

#[tauri::command]
pub fn switch_active_tab(tab_id: String, app: AppHandle, state: State<AppState>) -> Result<()> {
    let result = state.switch_to_tab(&tab_id);
    log_result(&app, &format!("switch_active_tab({tab_id})"), result)
}

#[tauri::command]
pub fn close_tab(tab_id: String, app: AppHandle, state: State<AppState>) -> Result<()> {
    let result = state.close_tab(&tab_id);
    log_result(&app, &format!("close_tab({tab_id})"), result)
}
