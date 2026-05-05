mod common;
use common::TestRepo;

#[test]
fn git2_commit_and_log() {
    let tr = TestRepo::new();
    let repo = tr.open_git2();
    common::scenarios::commit_and_log(&repo, &tr);
}

#[test]
fn git2_stage_unstage() {
    let tr = TestRepo::new();
    let repo = tr.open_git2();
    common::scenarios::stage_unstage(&repo, &tr);
}

#[test]
fn git2_branch_lifecycle() {
    let tr = TestRepo::new();
    let repo = tr.open_git2();
    common::scenarios::branch_lifecycle(&repo, &tr);
}

#[test]
fn git2_git_config() {
    let tr = TestRepo::new();
    let repo = tr.open_git2();
    common::scenarios::git_config(&repo, &tr);
}

#[test]
fn git2_repository_state_clean() {
    let tr = TestRepo::new();
    let repo = tr.open_git2();
    common::scenarios::repository_state_clean(&repo, &tr);
}

#[test]
fn git2_remote_local() {
    let mut tr = TestRepo::new();
    let repo = tr.open_git2();
    common::scenarios::remote_local(&repo, &mut tr);
}

#[test]
fn git2_merge_clean() {
    let tr = TestRepo::new();
    let repo = tr.open_git2();
    common::scenarios::merge_clean(&repo, &tr);
}

#[test]
fn git2_merge_conflict_resolve() {
    let tr = TestRepo::new();
    let repo = tr.open_git2();
    common::scenarios::merge_conflict_resolve(&repo, &tr);
}

#[test]
fn git2_merge_abort() {
    let tr = TestRepo::new();
    let repo = tr.open_git2();
    common::scenarios::merge_abort(&repo, &tr);
}

#[test]
fn git2_diff_file() {
    let tr = TestRepo::new();
    let repo = tr.open_git2();
    common::scenarios::diff_file(&repo, &tr);
}

#[test]
fn git2_amend_commit() {
    let tr = TestRepo::new();
    let repo = tr.open_git2();
    common::scenarios::amend_commit(&repo, &tr);
}

#[test]
fn git2_remote_network_fetch_http() {
    let tr = TestRepo::new();
    let repo = tr.open_git2();
    common::scenarios::remote_network_fetch(&repo, &tr, "MCGIT_TEST_REMOTE_HTTP");
}

#[test]
fn git2_remote_network_fetch_ssh() {
    let tr = TestRepo::new();
    let repo = tr.open_git2();
    common::scenarios::remote_network_fetch(&repo, &tr, "MCGIT_TEST_REMOTE_SSH");
}

#[test]
fn git2_log_and_detail() {
    let tr = TestRepo::new();
    let repo = tr.open_git2();
    common::scenarios::log_and_detail(&repo, &tr);
}
