use base64::engine::general_purpose::STANDARD;
use base64::Engine;
use std::path::PathBuf;

fn known_hosts_path() -> Option<PathBuf> {
    dirs::home_dir().map(|h| h.join(".ssh").join("known_hosts"))
}

pub enum KnownHostStatus {
    /// Host found with matching key bytes.
    Verified,
    /// Host found but key bytes differ (possible MITM).
    Mismatch,
    /// Host not present in the file (skip hashed entries).
    NotFound,
}

/// Checks whether `hostname` appears in `~/.ssh/known_hosts` and whether the
/// raw key bytes match what the server presents.
///
/// Hashed entries (`|1|…`) are skipped — they require HMAC-SHA1 to verify.
/// Comma-separated hostnames and `[host]:port` syntax are handled.
pub fn check(hostname: &str, raw_key: &[u8]) -> KnownHostStatus {
    let path = match known_hosts_path() {
        Some(p) => p,
        None => return KnownHostStatus::NotFound,
    };
    let content = match std::fs::read_to_string(&path) {
        Ok(c) => c,
        Err(_) => return KnownHostStatus::NotFound,
    };

    let mut host_found = false;

    for line in content.lines() {
        let line = line.trim();
        if line.is_empty() || line.starts_with('#') || line.starts_with('|') {
            continue;
        }

        let mut parts = line.split_whitespace();
        let hosts_field = match parts.next() {
            Some(h) => h,
            None => continue,
        };
        let _key_type = match parts.next() {
            Some(k) => k,
            None => continue,
        };
        let key_b64 = match parts.next() {
            Some(k) => k,
            None => continue,
        };

        if !hostname_matches(hosts_field, hostname) {
            continue;
        }

        host_found = true;

        if let Ok(key_bytes) = STANDARD.decode(key_b64) {
            if key_bytes.as_slice() == raw_key {
                return KnownHostStatus::Verified;
            }
        }
    }

    if host_found {
        KnownHostStatus::Mismatch
    } else {
        KnownHostStatus::NotFound
    }
}

fn hostname_matches(hosts_field: &str, hostname: &str) -> bool {
    hosts_field.split(',').any(|entry| {
        let entry = entry.trim();
        // Strip negation marker (we don't implement full negation logic here)
        let entry = entry.strip_prefix('!').unwrap_or(entry);
        // Handle [host]:port format
        let bare = if let Some(rest) = entry.strip_prefix('[') {
            rest.split(']').next().unwrap_or(entry)
        } else {
            entry
        };
        bare == hostname
    })
}
