import type { IGitRepository } from "../../domain/ports/IGitRepository";

export function listSshKeysUseCase(repo: IGitRepository) {
  return repo.listSshKeys();
}

export function listSavedHostsUseCase(repo: IGitRepository) {
  return repo.listSavedHosts();
}

export function saveCredentialsUseCase(
  repo: IGitRepository,
  host: string,
  username: string,
  token: string
) {
  return repo.saveCredentials(host, username, token);
}

export function clearCredentialsUseCase(repo: IGitRepository, host: string) {
  return repo.clearCredentials(host);
}

/// Detects if an error message signals a missing HTTPS credential.
/// Returns the hostname if so, null otherwise.
export function parseAuthRequired(error: string): string | null {
  const match = error.match(/AUTH_REQUIRED:(.+)/);
  return match ? match[1].trim() : null;
}

/// Detects if an error message signals an unknown SSH host (TOFU required).
/// Returns { host, fingerprint } if so, null otherwise.
export function parseUnknownHost(
  error: string
): { host: string; fingerprint: string } | null {
  const match = error.match(/UNKNOWN_HOST:([^:]+):(.+)/);
  return match ? { host: match[1].trim(), fingerprint: match[2].trim() } : null;
}

/// Detects if an error message signals a possible MITM (known host, key changed).
/// Returns { host, fingerprint } if so, null otherwise.
export function parseMitmDetected(
  error: string
): { host: string; fingerprint: string } | null {
  const match = error.match(/MITM_DETECTED:([^:]+):(.+)/);
  return match ? { host: match[1].trim(), fingerprint: match[2].trim() } : null;
}

export function trustSshHostUseCase(
  repo: IGitRepository,
  host: string,
  fingerprint: string
): Promise<void> {
  return repo.trustSshHost(host, fingerprint);
}
