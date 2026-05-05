mod common;
use common::TestRepo;
use common::skip_if_no_git;

#[test]
fn cli_commit_and_log() {
    skip_if_no_git!();
    let tr = TestRepo::new();
    let repo = tr.open_cli();
    common::scenarios::commit_and_log(&repo, &tr);
}

#[test]
fn cli_stage_unstage() {
    skip_if_no_git!();
    let tr = TestRepo::new();
    let repo = tr.open_cli();
    common::scenarios::stage_unstage(&repo, &tr);
}

#[test]
fn cli_branch_lifecycle() {
    skip_if_no_git!();
    let tr = TestRepo::new();
    let repo = tr.open_cli();
    common::scenarios::branch_lifecycle(&repo, &tr);
}

#[test]
fn cli_git_config() {
    skip_if_no_git!();
    let tr = TestRepo::new();
    let repo = tr.open_cli();
    common::scenarios::git_config(&repo, &tr);
}

#[test]
fn cli_repository_state_clean() {
    skip_if_no_git!();
    let tr = TestRepo::new();
    let repo = tr.open_cli();
    common::scenarios::repository_state_clean(&repo, &tr);
}

#[test]
fn cli_remote_local() {
    skip_if_no_git!();
    let mut tr = TestRepo::new();
    let repo = tr.open_cli();
    common::scenarios::remote_local(&repo, &mut tr);
}

#[test]
fn cli_remote_network_fetch_http() {
    skip_if_no_git!();
    let tr = TestRepo::new();
    let repo = tr.open_cli();
    common::scenarios::remote_network_fetch(&repo, &tr, "MCGIT_TEST_REMOTE_HTTP");
}

#[test]
fn cli_remote_network_fetch_ssh() {
    skip_if_no_git!();
    let tr = TestRepo::new();
    let repo = tr.open_cli();
    common::scenarios::remote_network_fetch(&repo, &tr, "MCGIT_TEST_REMOTE_SSH");
}

#[test]
fn cli_log_and_detail() {
    skip_if_no_git!();
    let tr = TestRepo::new();
    let repo = tr.open_cli();
    common::scenarios::log_and_detail(&repo, &tr);
}
