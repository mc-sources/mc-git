use crate::error::Result;
use crate::git::gpg::{list_gpg_keys as git_list_gpg_keys, GpgKeyInfo};

#[tauri::command]
pub fn list_gpg_keys() -> Result<Vec<GpgKeyInfo>> {
    git_list_gpg_keys()
}
