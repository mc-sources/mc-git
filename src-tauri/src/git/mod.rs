pub mod blame;
pub mod force_push;
pub mod host_verification;
pub mod https_credentials;
pub mod ssh_keys;

/// Returns `true` if the `git` binary is reachable in the system PATH.
/// Used to decide whether to attempt a git-CLI fallback or return a clear
/// error message to the user.
pub fn git_available() -> bool {
    std::process::Command::new("git")
        .arg("--version")
        .output()
        .map(|o| o.status.success())
        .unwrap_or(false)
}
pub mod known_hosts;
pub mod trusted_hosts;
pub mod gpg;
pub mod gitflow;
pub mod branch;
pub mod patch;
pub mod cherry_pick;
pub mod rebase;
pub mod merge;
pub mod clone;
pub mod commit;
pub mod config;
pub mod credential_store;
pub mod credentials;
pub mod diff;
pub mod history;
pub mod reflog;
pub mod remote;
pub mod repository;
pub mod stash;
pub mod status;
pub mod submodule;
pub mod tag;
pub mod types;
