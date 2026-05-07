use base64::engine::general_purpose::STANDARD_NO_PAD;
use base64::Engine;

use crate::git::{known_hosts, trusted_hosts};

/// Result of verifying an SSH host key.
pub enum HostKeyVerdict {
    /// Host key is known and matches — connection is safe.
    Trusted,
    /// Host is unknown — first time connecting.
    /// The inner string is the structured message for the frontend
    /// (`UNKNOWN_HOST:<host>:<fingerprint>`).
    Unknown(String),
    /// Host is known but the key has changed — possible MITM attack.
    /// The inner string is the structured message for the frontend
    /// (`MITM_DETECTED:<host>:<fingerprint>`).
    Mismatch(String),
}

/// Verifies an SSH host key against `~/.ssh/known_hosts` and the local
/// trusted-hosts store.
///
/// Verification strategy:
/// 1. Check `known_hosts` by raw key bytes (exact match or mismatch).
/// 2. Check the trusted-hosts store by SHA-256 fingerprint (TOFU).
/// 3. If neither confirms the host → `Unknown`.
///
/// `fingerprint` must be in OpenSSH display format (`SHA256:<base64>`).
/// Compute it with [`fingerprint_sha256`] before calling this function.
pub fn verify(hostname: &str, raw_key: &[u8], fingerprint: &str) -> HostKeyVerdict {
    // 1. known_hosts (raw key bytes)
    match known_hosts::check(hostname, raw_key) {
        known_hosts::KnownHostStatus::Verified => return HostKeyVerdict::Trusted,
        known_hosts::KnownHostStatus::Mismatch => {
            return HostKeyVerdict::Mismatch(format!("MITM_DETECTED:{hostname}:{fingerprint}"));
        }
        known_hosts::KnownHostStatus::NotFound => {}
    }

    // 2. trusted-hosts store (fingerprint)
    match trusted_hosts::check(hostname, fingerprint) {
        trusted_hosts::TrustStatus::Trusted => HostKeyVerdict::Trusted,
        trusted_hosts::TrustStatus::Mismatch => {
            HostKeyVerdict::Mismatch(format!("MITM_DETECTED:{hostname}:{fingerprint}"))
        }
        trusted_hosts::TrustStatus::Unknown => {
            HostKeyVerdict::Unknown(format!("UNKNOWN_HOST:{hostname}:{fingerprint}"))
        }
    }
}

/// Returns the SHA-256 fingerprint of an SSH host key in OpenSSH display format:
/// `SHA256:<base64url-no-padding>`.
/// Returns an empty string if the hash is unavailable.
pub fn fingerprint_sha256(host_key: &git2::cert::CertHostkey) -> String {
    match host_key.hash_sha256() {
        Some(h) => format!("SHA256:{}", STANDARD_NO_PAD.encode(h)),
        None => String::new(),
    }
}
