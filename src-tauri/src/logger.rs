use serde::Serialize;
use tauri::{AppHandle, Emitter};

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum LogLevel {
    Info,
    Error,
}

#[derive(Debug, Clone, Serialize)]
pub struct LogEntry {
    pub level: LogLevel,
    pub command: String,
    pub message: String,
    pub timestamp: i64,
}

fn now_ms() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
}

pub fn emit_info(app: &AppHandle, command: &str, message: &str) {
    let _ = app.emit(
        "git:log",
        LogEntry {
            level: LogLevel::Info,
            command: command.to_string(),
            message: message.to_string(),
            timestamp: now_ms(),
        },
    );
}

pub fn emit_error(app: &AppHandle, command: &str, message: &str) {
    let _ = app.emit(
        "git:log",
        LogEntry {
            level: LogLevel::Error,
            command: command.to_string(),
            message: message.to_string(),
            timestamp: now_ms(),
        },
    );
}

/// Logs the result of a git operation: info on success, error on failure.
/// Returns the result unchanged so it can be used inline.
pub fn log_result<T>(
    app: &AppHandle,
    command: &str,
    result: crate::error::Result<T>,
) -> crate::error::Result<T> {
    match &result {
        Ok(_) => emit_info(app, command, "OK"),
        Err(e) => emit_error(app, command, &e.to_string()),
    }
    result
}
