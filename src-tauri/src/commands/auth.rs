use serde::Serialize;
use tauri::AppHandle;

use crate::error::{AppError, Result};
use crate::git::credential_store::{self, Credential};
use crate::git::trusted_hosts;
use crate::logger::log_result;

#[derive(Debug, Serialize)]
pub struct SshKeyInfo {
    pub name: String,
    pub algorithm: String,
    pub path: String,
}

#[tauri::command]
pub fn save_credentials(host: String, username: String, token: String, app: AppHandle) -> Result<()> {
    let result = credential_store::set(&host, Credential { username, token })
        .map_err(|e| AppError::Other(e.to_string()));
    log_result(&app, &format!("save_credentials({host})"), result)
}

#[tauri::command]
pub fn clear_credentials(host: String, app: AppHandle) -> Result<()> {
    let result = credential_store::remove(&host)
        .map_err(|e| AppError::Other(e.to_string()));
    log_result(&app, &format!("clear_credentials({host})"), result)
}

#[tauri::command]
pub fn list_saved_hosts(app: AppHandle) -> Result<Vec<String>> {
    let result = Ok(credential_store::list_hosts());
    log_result(&app, "list_saved_hosts", result)
}

#[tauri::command]
pub fn trust_ssh_host(host: String, fingerprint: String, app: AppHandle) -> Result<()> {
    let result = trusted_hosts::add(&host, &fingerprint)
        .map_err(|e| AppError::Other(e.to_string()));
    log_result(&app, &format!("trust_ssh_host({host})"), result)
}

#[tauri::command]
pub fn list_ssh_keys(app: AppHandle) -> Result<Vec<SshKeyInfo>> {
    let result = detect_ssh_keys();
    log_result(&app, "list_ssh_keys", result)
}

fn detect_ssh_keys() -> Result<Vec<SshKeyInfo>> {
    let home = dirs::home_dir()
        .ok_or_else(|| AppError::Other("Répertoire home introuvable".into()))?;
    let ssh_dir = home.join(".ssh");

    let read_dir = match std::fs::read_dir(&ssh_dir) {
        Ok(d) => d,
        Err(_) => return Ok(vec![]),
    };

    let mut keys = Vec::new();
    for entry in read_dir.flatten() {
        let pub_path = entry.path();
        // Only process .pub files
        if pub_path.extension().and_then(|e| e.to_str()) != Some("pub") {
            continue;
        }
        // Derive private key path by stripping .pub
        let private_path = pub_path.with_extension("");
        if !private_path.exists() {
            continue;
        }
        // Read algorithm from the first word of the public key file
        let pub_content = match std::fs::read_to_string(&pub_path) {
            Ok(c) => c,
            Err(_) => continue,
        };
        let algo_tag = pub_content.split_whitespace().next().unwrap_or("");
        let algorithm = match algo_tag {
            "ssh-ed25519"                                             => "Ed25519",
            "ssh-rsa"                                                 => "RSA",
            t if t.starts_with("ecdsa-sha2-")                        => "ECDSA",
            "ssh-dss"                                                 => "DSA",
            other if !other.is_empty()                               => other,
            _                                                         => "Unknown",
        };
        let name = private_path
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("")
            .to_string();
        keys.push(SshKeyInfo {
            name,
            algorithm: algorithm.to_string(),
            path: private_path.to_string_lossy().into_owned(),
        });
    }

    // Stable sort: standard names first, then alphabetical
    let order = ["id_ed25519", "id_rsa", "id_ecdsa", "id_dsa"];
    keys.sort_by(|a, b| {
        let ai = order.iter().position(|&n| n == a.name).unwrap_or(usize::MAX);
        let bi = order.iter().position(|&n| n == b.name).unwrap_or(usize::MAX);
        ai.cmp(&bi).then(a.name.cmp(&b.name))
    });

    Ok(keys)
}
