use serde::Serialize;
use tauri::{AppHandle, Emitter};

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProgressEvent {
    pub operation: String,
    pub message: String,
    pub percent: Option<u32>,
}

pub fn emit_progress(app: &AppHandle, operation: &str, message: &str, percent: Option<u32>) {
    let _ = app.emit(
        "git:progress",
        ProgressEvent {
            operation: operation.to_string(),
            message: message.to_string(),
            percent,
        },
    );
}

pub fn emit_progress_done(app: &AppHandle, operation: &str) {
    emit_progress(app, operation, "Terminé", Some(100));
}
