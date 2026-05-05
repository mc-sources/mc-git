use std::collections::HashMap;
use std::ops::{Deref, DerefMut};
use std::sync::{Mutex, MutexGuard};

use crate::domain::ports::repository::GitRepository;
use crate::error::{AppError, Result};

/// Internal state protected by a single mutex.
///
/// All three fields are grouped so that tab-switch operations are atomic:
/// no concurrent `lock_repo()` can observe `repo = None` while a switch
/// is in progress.
struct TabState {
    repo: Option<Box<dyn GitRepository + Send>>,
    repo_pool: HashMap<String, Box<dyn GitRepository + Send>>,
    active_tab_id: Option<String>,
}

/// Backward-compatible guard over the active repository.
///
/// Derefs to `Option<Box<dyn GitRepository + Send>>` so every existing
/// command call site (`*guard = Some(...)`, `guard.as_ref()`, etc.) works
/// without modification.
pub struct RepoGuard<'a>(MutexGuard<'a, TabState>);

impl<'a> Deref for RepoGuard<'a> {
    type Target = Option<Box<dyn GitRepository + Send>>;
    fn deref(&self) -> &Self::Target {
        &self.0.repo
    }
}

impl<'a> DerefMut for RepoGuard<'a> {
    fn deref_mut(&mut self) -> &mut Self::Target {
        &mut self.0.repo
    }
}

/// Shared application state managed by Tauri.
///
/// A single `Mutex<TabState>` ensures that tab-switch operations (park +
/// activate) are atomic. All existing commands call `lock_repo()` and
/// receive a `RepoGuard` that derefs identically to the previous
/// `MutexGuard<Option<…>>` — no call sites needed updating.
pub struct AppState {
    inner: Mutex<TabState>,
}

impl AppState {
    pub fn new() -> Self {
        Self {
            inner: Mutex::new(TabState {
                repo: None,
                repo_pool: HashMap::new(),
                active_tab_id: None,
            }),
        }
    }

    fn lock_inner(&self) -> Result<MutexGuard<'_, TabState>> {
        self.inner
            .lock()
            .map_err(|_| AppError::Other("AppState lock poisoned".into()))
    }

    /// Acquire the active repo lock (used by all existing commands — unchanged).
    pub fn lock_repo(&self) -> Result<RepoGuard<'_>> {
        Ok(RepoGuard(self.lock_inner()?))
    }

    /// Activate a new tab: atomically park the current repo in the pool,
    /// set `repo` to `new_repo`, and record `tab_id` as the active tab.
    pub fn activate_tab(
        &self,
        tab_id: &str,
        new_repo: Box<dyn GitRepository + Send>,
    ) -> Result<()> {
        let mut s = self.lock_inner()?;
        if let Some(old_repo) = s.repo.take() {
            if let Some(id) = s.active_tab_id.take() {
                s.repo_pool.insert(id, old_repo);
            }
        }
        s.repo = Some(new_repo);
        s.active_tab_id = Some(tab_id.to_string());
        Ok(())
    }

    /// Switch to an existing tab in the pool (fully atomic — no window where
    /// `lock_repo()` can observe `None`).
    pub fn switch_to_tab(&self, tab_id: &str) -> Result<()> {
        let mut s = self.lock_inner()?;
        let target = s
            .repo_pool
            .remove(tab_id)
            .ok_or_else(|| AppError::Other(format!("Onglet introuvable : {tab_id}")))?;
        if let Some(old_repo) = s.repo.take() {
            if let Some(id) = s.active_tab_id.take() {
                s.repo_pool.insert(id, old_repo);
            }
        }
        s.repo = Some(target);
        s.active_tab_id = Some(tab_id.to_string());
        Ok(())
    }

    /// Close a tab: if active, clear repo; if in the pool, remove it (atomic).
    pub fn close_tab(&self, tab_id: &str) -> Result<()> {
        let mut s = self.lock_inner()?;
        if s.active_tab_id.as_deref() == Some(tab_id) {
            s.repo = None;
            s.active_tab_id = None;
        } else {
            s.repo_pool.remove(tab_id);
        }
        Ok(())
    }
}
