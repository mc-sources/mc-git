use std::collections::HashMap;
use std::io;
use std::path::PathBuf;

fn store_path() -> Option<PathBuf> {
    dirs::config_dir().map(|d| d.join("mcgit").join("trusted_ssh_hosts.json"))
}

fn load() -> HashMap<String, String> {
    let path = match store_path() {
        Some(p) => p,
        None => return HashMap::new(),
    };
    let content = match std::fs::read_to_string(&path) {
        Ok(c) => c,
        Err(_) => return HashMap::new(),
    };
    serde_json::from_str(&content).unwrap_or_default()
}

pub enum TrustStatus {
    /// Host found, fingerprint matches.
    Trusted,
    /// Host found, but fingerprint differs (possible MITM).
    Mismatch,
    /// Host not in our store.
    Unknown,
}

pub fn check(hostname: &str, fingerprint: &str) -> TrustStatus {
    let map = load();
    match map.get(hostname) {
        Some(f) if f == fingerprint => TrustStatus::Trusted,
        Some(_) => TrustStatus::Mismatch,
        None => TrustStatus::Unknown,
    }
}

pub fn add(hostname: &str, fingerprint: &str) -> io::Result<()> {
    let path = store_path()
        .ok_or_else(|| io::Error::new(io::ErrorKind::NotFound, "config dir introuvable"))?;
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    let mut map = load();
    map.insert(hostname.to_string(), fingerprint.to_string());
    let json = serde_json::to_string_pretty(&map)
        .map_err(|e| io::Error::new(io::ErrorKind::InvalidData, e))?;
    std::fs::write(&path, json)
}
