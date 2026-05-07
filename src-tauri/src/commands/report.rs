use crate::error::Result;

#[tauri::command]
pub fn save_report(path: String, content: String) -> Result<()> {
    std::fs::write(&path, content.as_bytes()).map_err(|e| {
        crate::error::AppError::Other(format!("Impossible d'écrire le rapport : {e}"))
    })?;
    Ok(())
}

#[tauri::command]
pub fn copy_to_clipboard(text: String) -> Result<()> {
    // arboard clears the clipboard when the Clipboard object is dropped (X11 behaviour).
    // We keep it alive in a background thread until another app takes ownership or 60s pass.
    let (ready_tx, ready_rx) = std::sync::mpsc::channel::<Result<()>>();

    std::thread::spawn(move || {
        match arboard::Clipboard::new() {
            Err(e) => {
                let _ = ready_tx.send(Err(crate::error::AppError::Other(format!(
                    "Presse-papier inaccessible : {e}"
                ))));
            }
            Ok(mut cb) => {
                match cb.set_text(&text) {
                    Err(e) => {
                        let _ = ready_tx.send(Err(crate::error::AppError::Other(format!(
                            "Impossible de copier : {e}"
                        ))));
                    }
                    Ok(()) => {
                        let _ = ready_tx.send(Ok(()));
                        // Keep cb alive so X11/Wayland can serve paste requests.
                        std::thread::sleep(std::time::Duration::from_secs(60));
                    }
                }
            }
        }
    });

    ready_rx
        .recv()
        .map_err(|_| crate::error::AppError::Other("Thread presse-papier perdu".into()))?
}
