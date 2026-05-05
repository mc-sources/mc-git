use crate::git::credential_store;

/// Extracts the hostname from an HTTPS or HTTP URL.
///
/// Examples:
/// - `"https://github.com/user/repo.git"` → `"github.com"`
/// - `"http://internal.corp/repo"` → `"internal.corp"`
pub fn extract_host(url: &str) -> &str {
    let without_scheme = url
        .trim_start_matches("https://")
        .trim_start_matches("http://");
    without_scheme.split('/').next().unwrap_or(url)
}

/// Looks up stored HTTPS credentials for the given URL.
///
/// Returns `Some((username, token))` if credentials are stored for the
/// URL's host, `None` otherwise.
pub fn find_stored_credentials(url: &str) -> Option<(String, String)> {
    let host = extract_host(url);
    credential_store::get(host).map(|c| (c.username, c.token))
}
