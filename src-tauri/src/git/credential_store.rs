use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::{Mutex, OnceLock};

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Credential {
    pub username: String,
    pub token: String,
}

static CACHE: OnceLock<Mutex<HashMap<String, Credential>>> = OnceLock::new();

fn get_cache() -> &'static Mutex<HashMap<String, Credential>> {
    CACHE.get_or_init(|| Mutex::new(load_from_disk().unwrap_or_default()))
}

fn store_path() -> Option<PathBuf> {
    dirs::data_local_dir().map(|d| d.join("mcgit").join("credentials.json"))
}

fn load_from_disk() -> Option<HashMap<String, Credential>> {
    let path = store_path()?;
    let data = std::fs::read_to_string(&path).ok()?;
    serde_json::from_str(&data).ok()
}

fn save_to_disk(map: &HashMap<String, Credential>) -> std::io::Result<()> {
    let path = store_path().ok_or_else(|| {
        std::io::Error::new(
            std::io::ErrorKind::NotFound,
            "Répertoire de données introuvable",
        )
    })?;
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    let data = serde_json::to_string_pretty(map).map_err(std::io::Error::other)?;
    std::fs::write(&path, data)
}

/// Returns the stored credential for the given host, if any.
pub fn get(host: &str) -> Option<Credential> {
    get_cache().lock().ok()?.get(host).cloned()
}

/// Saves a credential for the given host, persisting to disk.
pub fn set(host: &str, cred: Credential) -> std::io::Result<()> {
    let mut cache = get_cache()
        .lock()
        .map_err(|_| std::io::Error::other("Verrou du cache de credentials corrompu"))?;
    cache.insert(host.to_string(), cred);
    save_to_disk(&cache)
}

/// Removes the credential for the given host and persists to disk.
pub fn remove(host: &str) -> std::io::Result<()> {
    let mut cache = get_cache()
        .lock()
        .map_err(|_| std::io::Error::other("Verrou du cache de credentials corrompu"))?;
    cache.remove(host);
    save_to_disk(&cache)
}

/// Returns all stored hosts.
pub fn list_hosts() -> Vec<String> {
    get_cache()
        .lock()
        .map(|c| c.keys().cloned().collect())
        .unwrap_or_default()
}
