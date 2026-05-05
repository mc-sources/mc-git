use git2::{Cred, CredentialType, RemoteCallbacks};
use std::sync::{Arc, Mutex};

use crate::error::AppError;
use crate::git::{host_verification, https_credentials, ssh_keys};

/// Shared channel for communicating SSH certificate errors out of the
/// `certificate_check` callback.  libgit2 overwrites any custom error message
/// produced inside the callback with its own "invalid or unknown remote ssh
/// hostkey" message, so we store our structured message here instead and
/// consult it after the operation fails.
pub type CertError = Arc<Mutex<Option<String>>>;

/// If `cert_error` contains a stored message, returns `AppError::Other(msg)`.
/// Otherwise wraps the original git2 error as `AppError::Git(e)`.
pub fn remap_cert_error(e: git2::Error, cert_error: &CertError) -> AppError {
    if let Ok(guard) = cert_error.lock() {
        if let Some(msg) = guard.as_ref() {
            return AppError::Other(msg.clone());
        }
    }
    AppError::Git(e)
}

/// Builds a `RemoteCallbacks` that handles SSH and HTTPS credential requests,
/// and also verifies SSH host keys (TOFU / known_hosts).
///
/// Returns `(callbacks, cert_error)`.  If the connection fails due to an
/// unknown or mismatched SSH host key, `cert_error` will contain the
/// structured message (`UNKNOWN_HOST:host:fp` or `MITM_DETECTED:host:fp`)
/// that should be surfaced to the frontend.  Use `remap_cert_error` on the
/// failing operation to convert the git2 error to the right `AppError`.
///
/// SSH host verification strategy (see [`host_verification::verify`]):
///   1. `~/.ssh/known_hosts` (key bytes compared)
///   2. Local trusted-hosts store (`~/.config/mcgit/trusted_ssh_hosts.json`)
///   3. Unknown → `UNKNOWN_HOST` stored in cert_error
///   4. Known host, different key → `MITM_DETECTED` stored in cert_error
///
/// Credential strategy:
///   SSH:   agent → id_ed25519 → id_rsa → id_ecdsa → id_dsa
///   HTTPS: stored credentials → `AUTH_REQUIRED:<host>`
pub fn build_callbacks<'a>() -> (RemoteCallbacks<'a>, CertError) {
    let mut callbacks = RemoteCallbacks::new();
    let cert_error: CertError = Arc::new(Mutex::new(None));
    let cert_err_clone = Arc::clone(&cert_error);

    // SSH host key verification. HTTPS certificates (X.509) are accepted as-is.
    callbacks.certificate_check(move |cert, hostname| {
        let host_key = match cert.as_hostkey() {
            Some(k) => k,
            None => return Ok(git2::CertificateCheckStatus::CertificateOk),
        };
        let raw_key = match host_key.hostkey() {
            Some(k) => k,
            None => return Ok(git2::CertificateCheckStatus::CertificateOk),
        };
        let fingerprint = host_verification::fingerprint_sha256(host_key);
        if fingerprint.is_empty() {
            return Ok(git2::CertificateCheckStatus::CertificateOk);
        }

        match host_verification::verify(hostname, raw_key, &fingerprint) {
            host_verification::HostKeyVerdict::Trusted => {
                Ok(git2::CertificateCheckStatus::CertificateOk)
            }
            host_verification::HostKeyVerdict::Unknown(msg)
            | host_verification::HostKeyVerdict::Mismatch(msg) => {
                if let Ok(mut g) = cert_err_clone.lock() {
                    *g = Some(msg);
                }
                Err(git2::Error::from_str("SSH certificate check failed"))
            }
        }
    });

    let mut attempts = 0usize;

    callbacks.credentials(move |url, username_from_url, allowed_types| {
        attempts += 1;
        if attempts > 6 {
            return Err(git2::Error::from_str(
                "Trop de tentatives d'authentification. Vérifiez vos clés SSH ou credentials HTTPS.",
            ));
        }

        let username = username_from_url.unwrap_or("git");

        // Username only (git2 sometimes asks for just the username before SSH_KEY)
        if allowed_types.contains(CredentialType::USERNAME) {
            return Cred::username(username);
        }

        // SSH — always preferred over HTTPS when both are offered
        if allowed_types.contains(CredentialType::SSH_KEY) {
            // Attempt 1: SSH agent
            if attempts <= 1 {
                if let Ok(cred) = Cred::ssh_key_from_agent(username) {
                    return Ok(cred);
                }
            }
            // Attempts 2+: key files in preference order
            let keys = ssh_keys::discover();
            let index = attempts.saturating_sub(2); // agent was attempt 1
            if let Some((public, private)) = keys.get(index) {
                let pub_opt = if public.exists() { Some(public.as_path()) } else { None };
                return Cred::ssh_key(username, pub_opt, private, None);
            }
            return Err(git2::Error::from_str(
                "Aucune clé SSH disponible. Vérifiez que ~/.ssh/ contient une paire de clés \
                 et que la clé publique est enregistrée sur le serveur distant.",
            ));
        }

        // HTTPS credentials (only when SSH is not offered)
        if allowed_types.contains(CredentialType::USER_PASS_PLAINTEXT) {
            let host = https_credentials::extract_host(url);
            if let Some((user, token)) = https_credentials::find_stored_credentials(url) {
                return Cred::userpass_plaintext(&user, &token);
            }
            return Err(git2::Error::from_str(&format!("AUTH_REQUIRED:{host}")));
        }

        // Default credentials (useful on some platforms)
        if allowed_types.contains(CredentialType::DEFAULT) {
            if let Ok(cred) = Cred::default() {
                return Ok(cred);
            }
        }

        Err(git2::Error::from_str(&format!(
            "Authentification échouée pour {url}. \
             Vérifiez vos clés SSH ou vos credentials HTTPS."
        )))
    });

    (callbacks, cert_error)
}
