use crate::error::{AppError, Result};

#[tauri::command]
pub fn read_file(path: String) -> Result<String> {
    std::fs::read_to_string(&path)
        .map_err(|e| AppError::Other(format!("Impossible de lire {path} : {e}")))
}

#[tauri::command]
pub fn write_file(path: String, content: String) -> Result<()> {
    std::fs::write(&path, content)
        .map_err(|e| AppError::Other(format!("Impossible d'écrire {path} : {e}")))
}
