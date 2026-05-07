use crate::error::{AppError, Result};

#[cfg(unix)]
use std::os::unix::process::CommandExt;

fn spawn_detached(cmd: &mut std::process::Command) -> std::io::Result<std::process::Child> {
    #[cfg(unix)]
    cmd.process_group(0);
    cmd.spawn()
}

#[tauri::command]
pub fn open_terminal(path: String) -> Result<()> {
    if !std::path::Path::new(&path).is_dir() {
        return Err(AppError::Other(format!("Répertoire introuvable : {path}")));
    }

    #[cfg(target_os = "linux")]
    {
        let candidates: Vec<String> = {
            let mut v = Vec::new();
            if let Ok(t) = std::env::var("TERMINAL") {
                v.push(t);
            }
            v.extend([
                "xfce4-terminal".into(),
                "x-terminal-emulator".into(),
                "gnome-terminal".into(),
                "konsole".into(),
                "xterm".into(),
            ]);
            v
        };

        for term in &candidates {
            let result = match term.as_str() {
                "gnome-terminal" => spawn_detached(
                    std::process::Command::new(term)
                        .arg("--working-directory")
                        .arg(&path),
                ),
                "konsole" => {
                    spawn_detached(std::process::Command::new(term).arg("--workdir").arg(&path))
                }
                "xfce4-terminal" | "x-terminal-emulator" => spawn_detached(
                    std::process::Command::new(term)
                        .arg("--working-directory")
                        .arg(&path),
                ),
                _ => spawn_detached(std::process::Command::new(term).current_dir(&path)),
            };
            if result.is_ok() {
                return Ok(());
            }
        }
        return Err(AppError::Other(
            "Aucun terminal trouvé. Installez xterm ou définissez la variable $TERMINAL.".into(),
        ));
    }

    #[cfg(target_os = "macos")]
    {
        spawn_detached(std::process::Command::new("open").args(["-a", "Terminal", &path]))
            .map_err(|e| AppError::Other(format!("Impossible d'ouvrir Terminal : {e}")))?;
        return Ok(());
    }

    #[cfg(target_os = "windows")]
    {
        if spawn_detached(std::process::Command::new("wt.exe").args(["-d", &path])).is_ok() {
            return Ok(());
        }
        spawn_detached(
            std::process::Command::new("cmd.exe").args(["/k", &format!("cd /d {path}")]),
        )
        .map_err(|e| AppError::Other(format!("Impossible d'ouvrir cmd.exe : {e}")))?;
        return Ok(());
    }

    #[allow(unreachable_code)]
    Err(AppError::Other("Plateforme non supportée".into()))
}
