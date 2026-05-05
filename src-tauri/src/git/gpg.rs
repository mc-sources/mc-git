use serde::{Deserialize, Serialize};
use std::io::Write;
use std::process::{Command, Stdio};

use crate::error::{AppError, Result};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GpgKeyInfo {
    pub key_id: String,
    pub uid: String,
}

/// List available GPG secret keys by running `gpg --list-secret-keys --with-colons`.
/// Returns an empty list (not an error) if gpg is not installed.
pub fn list_gpg_keys() -> Result<Vec<GpgKeyInfo>> {
    let output = Command::new("gpg")
        .args(["--list-secret-keys", "--with-colons"])
        .output()
        .map_err(|e| AppError::Other(format!("gpg not available: {e}")))?;

    let text = String::from_utf8_lossy(&output.stdout);
    let mut keys: Vec<GpgKeyInfo> = Vec::new();
    let mut current_key_id = String::new();
    let mut uid_seen = false;

    for line in text.lines() {
        // colon-delimited: record-type:validity:creation:expiry:keyid:...:uid
        let fields: Vec<&str> = line.splitn(10, ':').collect();
        match fields.first().copied() {
            Some("sec") => {
                current_key_id = fields.get(4).copied().unwrap_or("").to_string();
                uid_seen = false;
            }
            Some("uid") if !uid_seen && !current_key_id.is_empty() => {
                let uid = fields.get(9).copied().unwrap_or("").to_string();
                if !uid.is_empty() {
                    keys.push(GpgKeyInfo {
                        key_id: current_key_id.clone(),
                        uid,
                    });
                    uid_seen = true;
                }
            }
            _ => {}
        }
    }

    Ok(keys)
}

/// Sign `content` with GPG and return the armored detached signature.
pub fn gpg_sign(content: &str, key_id: Option<&str>) -> Result<String> {
    let mut cmd = Command::new("gpg");
    cmd.args(["--armor", "--detach-sig"]);
    if let Some(key) = key_id {
        cmd.args(["--local-user", key]);
    }

    let mut child = cmd
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| AppError::Other(format!("GPG not found: {e}")))?;

    if let Some(mut stdin) = child.stdin.take() {
        stdin
            .write_all(content.as_bytes())
            .map_err(|e| AppError::Other(format!("Failed to write to gpg stdin: {e}")))?;
    }

    let output = child
        .wait_with_output()
        .map_err(|e| AppError::Other(format!("GPG process failed: {e}")))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(AppError::Other(format!("GPG signing failed: {stderr}")));
    }

    String::from_utf8(output.stdout)
        .map_err(|e| AppError::Other(format!("GPG output is not valid UTF-8: {e}")))
}
