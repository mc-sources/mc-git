use tauri::State;

use crate::error::Result;
use crate::state::AppState;

#[tauri::command]
pub fn get_legal_document(name: String, state: State<AppState>) -> Result<String> {
    state.legal().get_legal_document(&name)
}

#[tauri::command]
pub fn get_third_party_notices(target: String, state: State<AppState>) -> Result<String> {
    state.legal().get_third_party_notices(&target)
}
