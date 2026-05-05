use crate::error::{AppError, Result};

#[cfg(unix)]
use std::os::unix::process::CommandExt;

fn spawn_detached(cmd: &mut std::process::Command) -> std::io::Result<std::process::Child> {
    #[cfg(unix)]
    cmd.process_group(0);
    cmd.spawn()
}

/// Build the OS-appropriate command.
///
/// On Windows, many editor launchers (e.g. `code`, `subl`) are `.cmd` batch files that
/// `cmd.exe` resolves via PATH, but that `CreateProcess` cannot find directly.
/// Wrapping with `cmd /C` delegates resolution to the shell.
fn build_command(exe: &str, pre_args: &[&str], path: &str) -> std::process::Command {
    #[cfg(windows)]
    {
        let mut cmd = std::process::Command::new("cmd");
        cmd.args(["/C", exe]).args(pre_args).arg(path);
        cmd
    }
    #[cfg(not(windows))]
    {
        let mut cmd = std::process::Command::new(exe);
        cmd.args(pre_args).arg(path);
        cmd
    }
}

#[tauri::command]
pub fn open_in_editor(path: String, editor_cmd: String) -> Result<()> {
    let editor_cmd = editor_cmd.trim().to_string();
    if editor_cmd.is_empty() {
        return Err(AppError::Other("Aucun éditeur configuré".into()));
    }
    if !std::path::Path::new(&path).is_dir() {
        return Err(AppError::Other(format!("Répertoire introuvable : {path}")));
    }

    // Split the command into executable + pre-defined args (e.g. "code ." → ["code", "."])
    let mut parts = editor_cmd.split_whitespace();
    let exe = parts.next().unwrap_or_default();
    let pre_args: Vec<&str> = parts.collect();

    spawn_detached(&mut build_command(exe, &pre_args, &path))
        .map_err(|e| AppError::Other(format!("Impossible de lancer l'éditeur : {e}")))?;

    Ok(())
}
