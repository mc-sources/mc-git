// Reusable scenarios: only a subset is wired into integration tests today.
// Silence dead-code warnings at the module level.
#![allow(dead_code)]

use super::TestRepo;
use mcgit_lib::domain::ports::repository::GitRepository;
use mcgit_lib::git::types::FileStatusKind;
use std::env;

pub fn commit_and_log(repo: &dyn GitRepository, tr: &TestRepo) {
    tr.write_file("hello.txt", "hello world");
    repo.stage_file("hello.txt").expect("stage_file");

    let commit = repo.create_commit("initial commit").expect("create_commit");
    assert!(!commit.oid.is_empty(), "commit oid must be non-empty");
    assert_eq!(commit.summary, "initial commit");
    assert_eq!(commit.author.name, "mcgit test");

    let head = repo.get_head_commit().expect("get_head_commit");
    assert_eq!(head.oid, commit.oid);

    let log = repo.get_log(10, 0, None, None).expect("get_log");
    assert_eq!(log.len(), 1);
    assert_eq!(log[0].oid, commit.oid);
    assert_eq!(log[0].summary, "initial commit");
}

pub fn stage_unstage(repo: &dyn GitRepository, tr: &TestRepo) {
    tr.write_file("init.txt", "init");
    repo.stage_file("init.txt").expect("stage init");
    repo.create_commit("init").expect("commit init");

    tr.write_file("a.txt", "aaa");
    tr.write_file("b.txt", "bbb");

    let status = repo.get_status().expect("get_status");
    let paths: Vec<&str> = status.iter().map(|s| s.path.as_str()).collect();
    assert!(paths.contains(&"a.txt"), "a.txt should appear in status");
    assert!(paths.contains(&"b.txt"), "b.txt should appear in status");

    repo.stage_file("a.txt").expect("stage a.txt");
    let status = repo.get_status().expect("get_status after stage");
    let a_entry = status
        .iter()
        .find(|s| s.path == "a.txt")
        .expect("a.txt in status");
    assert_ne!(
        a_entry.staged,
        FileStatusKind::Clean,
        "a.txt should be staged"
    );

    repo.unstage_file("a.txt").expect("unstage a.txt");
    let status = repo.get_status().expect("get_status after unstage");
    let a_entry = status
        .iter()
        .find(|s| s.path == "a.txt")
        .expect("a.txt in status");
    assert_ne!(
        a_entry.staged,
        FileStatusKind::Added,
        "a.txt should not be staged as Added after unstage"
    );

    repo.stage_all().expect("stage_all");
    let status = repo.get_status().expect("get_status after stage_all");
    for entry in &status {
        if entry.path != "init.txt" {
            assert_ne!(
                entry.staged,
                FileStatusKind::Clean,
                "{} should be staged",
                entry.path
            );
        }
    }

    repo.unstage_all().expect("unstage_all");
    let status = repo.get_status().expect("get_status after unstage_all");
    for entry in &status {
        assert_ne!(
            entry.staged,
            FileStatusKind::Added,
            "{} should not be staged as Added after unstage_all",
            entry.path
        );
    }
}

pub fn branch_lifecycle(repo: &dyn GitRepository, tr: &TestRepo) {
    tr.write_file("init.txt", "init");
    repo.stage_file("init.txt").expect("stage");
    let init_commit = repo.create_commit("init").expect("commit");

    let feat = repo
        .create_branch("feature-x", &init_commit.oid)
        .expect("create_branch");
    assert_eq!(feat.name, "feature-x");
    assert!(!feat.is_head, "new branch should not be HEAD");

    let branches = repo.list_branches(None).expect("list_branches");
    let names: Vec<&str> = branches.iter().map(|b| b.name.as_str()).collect();
    assert!(
        names.contains(&"feature-x"),
        "feature-x should appear in branch list"
    );

    repo.checkout_branch("feature-x")
        .expect("checkout feature-x");
    let branches = repo.list_branches(None).expect("list after checkout");
    let feat = branches
        .iter()
        .find(|b| b.name == "feature-x")
        .expect("find feature-x");
    assert!(feat.is_head, "feature-x should be HEAD after checkout");

    tr.write_file("feat.txt", "feature work");
    repo.stage_file("feat.txt").expect("stage feat.txt");
    repo.create_commit("feature commit")
        .expect("commit on feature");

    let renamed = repo
        .rename_branch("feature-x", "feature-y")
        .expect("rename_branch");
    assert_eq!(renamed.name, "feature-y");

    let branches = repo.list_branches(None).expect("list branches");
    let initial_branch = branches
        .iter()
        .find(|b| b.name != "feature-y" && !b.is_remote)
        .expect("should have another branch besides feature-y");
    repo.checkout_branch(&initial_branch.name)
        .expect("checkout initial");

    repo.delete_branch("feature-y", true)
        .expect("delete_branch");
    let branches = repo.list_branches(None).expect("list after delete");
    let names: Vec<&str> = branches.iter().map(|b| b.name.as_str()).collect();
    assert!(!names.contains(&"feature-y"), "feature-y should be deleted");
}

pub fn git_config(repo: &dyn GitRepository, _tr: &TestRepo) {
    repo.set_git_config("test.integration", "hello", false)
        .expect("set_git_config");
    let value = repo
        .get_git_config("test.integration", false)
        .expect("get_git_config");
    assert_eq!(value, Some("hello".to_string()));

    let missing = repo
        .get_git_config("test.nonexistent", false)
        .expect("get missing key");
    assert_eq!(missing, None);
}

pub fn repository_state_clean(repo: &dyn GitRepository, tr: &TestRepo) {
    tr.write_file("init.txt", "init");
    repo.stage_file("init.txt").expect("stage");
    repo.create_commit("init").expect("commit");

    let state = repo.get_repository_state().expect("get_repository_state");
    assert_eq!(state, "clean", "repo should be in clean state");
}

pub fn remote_local(repo: &dyn GitRepository, tr: &mut TestRepo) {
    tr.write_file("init.txt", "init");
    repo.stage_file("init.txt").expect("stage");
    repo.create_commit("init").expect("commit");

    let bare_path = tr.create_local_remote();
    let bare_url = bare_path.to_str().unwrap();
    let remote = repo.add_remote("origin", bare_url).expect("add_remote");
    assert_eq!(remote.name, "origin");
    assert_eq!(remote.url, bare_url);

    let remotes = repo.list_remotes().expect("list_remotes");
    assert_eq!(remotes.len(), 1);
    assert_eq!(remotes[0].name, "origin");

    let info = repo.repo_info().expect("repo_info");
    let branch_name = info.head_branch.expect("should have a HEAD branch");

    // Align the bare repo's HEAD to the same default branch as the local repo,
    // so that libgit2 push does not conflict with a stale symbolic HEAD.
    {
        let bare = git2::Repository::open_bare(&bare_path).expect("open bare");
        bare.set_head(&format!("refs/heads/{branch_name}"))
            .expect("set bare HEAD");
    }

    repo.push_remote("origin", &branch_name)
        .expect("push_remote");
    repo.fetch_remote("origin").expect("fetch_remote");

    repo.remove_remote("origin").expect("remove_remote");
    let remotes = repo.list_remotes().expect("list_remotes after remove");
    assert!(remotes.is_empty(), "remotes should be empty after remove");
}

// ---------------------------------------------------------------------------
// Merge scenarios (Git2 only)
// ---------------------------------------------------------------------------

pub fn merge_clean(repo: &dyn GitRepository, tr: &TestRepo) {
    // Commit on main
    tr.write_file("base.txt", "base content");
    repo.stage_file("base.txt").expect("stage base");
    let init = repo.create_commit("init commit").expect("init commit");

    // Create and checkout feature branch
    repo.create_branch("feature-merge", &init.oid)
        .expect("create feature-merge");
    repo.checkout_branch("feature-merge")
        .expect("checkout feature-merge");

    // Commit a different file on the feature branch
    tr.write_file("feature.txt", "feature content");
    repo.stage_file("feature.txt").expect("stage feature");
    repo.create_commit("feature commit")
        .expect("feature commit");

    // Find main branch name and checkout
    let branches = repo.list_branches(None).expect("list_branches");
    let main_branch = branches
        .iter()
        .find(|b| b.name != "feature-merge" && !b.is_remote)
        .expect("should have a main branch")
        .name
        .clone();
    repo.checkout_branch(&main_branch).expect("checkout main");

    // Merge with no-ff
    let status = repo
        .merge_branch("feature-merge", true)
        .expect("merge_branch");
    assert!(
        !status.has_conflicts,
        "clean merge should not have conflicts"
    );

    // Log should show the merge commit
    let log = repo.get_log(10, 0, None, None).expect("get_log");
    assert!(
        log.len() >= 3,
        "should have at least 3 commits (init + feature + merge)"
    );
    // The merge commit is the most recent
    assert!(
        log[0].parent_oids.len() >= 2,
        "merge commit should have >= 2 parents"
    );

    // State should be clean
    let state = repo.get_repository_state().expect("get_repository_state");
    assert_eq!(state, "clean", "state should be clean after merge");
}

pub fn merge_conflict_resolve(repo: &dyn GitRepository, tr: &TestRepo) {
    // Initial commit with a shared file
    tr.write_file("shared.txt", "original content");
    repo.stage_file("shared.txt").expect("stage shared");
    let init = repo.create_commit("init commit").expect("init commit");

    // Create and checkout feature branch
    repo.create_branch("feature-conflict", &init.oid)
        .expect("create feature-conflict");
    repo.checkout_branch("feature-conflict")
        .expect("checkout feature-conflict");

    // Modify the same file on feature branch
    tr.write_file("shared.txt", "feature version");
    repo.stage_file("shared.txt").expect("stage feature change");
    repo.create_commit("feature change")
        .expect("feature commit");

    // Checkout main and modify the same file differently
    let branches = repo.list_branches(None).expect("list_branches");
    let main_branch = branches
        .iter()
        .find(|b| b.name != "feature-conflict" && !b.is_remote)
        .expect("should have a main branch")
        .name
        .clone();
    repo.checkout_branch(&main_branch).expect("checkout main");

    tr.write_file("shared.txt", "main version");
    repo.stage_file("shared.txt").expect("stage main change");
    repo.create_commit("main change").expect("main commit");

    // Merge — should conflict
    let status = repo
        .merge_branch("feature-conflict", true)
        .expect("merge_branch");
    assert!(status.has_conflicts, "merge should have conflicts");
    assert!(status.conflict_count > 0, "conflict_count should be > 0");

    // State should be "merge"
    let state = repo.get_repository_state().expect("get_repository_state");
    assert_eq!(state, "merge", "state should be 'merge' during conflict");

    // Resolve: write resolved content, stage, commit
    tr.write_file("shared.txt", "resolved content");
    repo.stage_file("shared.txt").expect("stage resolved");
    repo.create_commit("merge: resolve conflict")
        .expect("merge commit");

    // State should be clean
    let state = repo
        .get_repository_state()
        .expect("get_repository_state after resolve");
    assert_eq!(
        state, "clean",
        "state should be clean after conflict resolution"
    );
}

pub fn merge_abort(repo: &dyn GitRepository, tr: &TestRepo) {
    // Initial commit with a shared file
    tr.write_file("shared.txt", "original content");
    repo.stage_file("shared.txt").expect("stage shared");
    let init = repo.create_commit("init commit").expect("init commit");

    // Create and checkout feature branch
    repo.create_branch("feature-abort", &init.oid)
        .expect("create feature-abort");
    repo.checkout_branch("feature-abort")
        .expect("checkout feature-abort");

    // Modify the same file on feature branch
    tr.write_file("shared.txt", "feature version");
    repo.stage_file("shared.txt").expect("stage feature change");
    repo.create_commit("feature change")
        .expect("feature commit");

    // Checkout main and modify the same file differently
    let branches = repo.list_branches(None).expect("list_branches");
    let main_branch = branches
        .iter()
        .find(|b| b.name != "feature-abort" && !b.is_remote)
        .expect("should have a main branch")
        .name
        .clone();
    repo.checkout_branch(&main_branch).expect("checkout main");

    tr.write_file("shared.txt", "main version");
    repo.stage_file("shared.txt").expect("stage main change");
    repo.create_commit("main change").expect("main commit");

    // Merge — should conflict
    let status = repo
        .merge_branch("feature-abort", true)
        .expect("merge_branch");
    assert!(status.has_conflicts, "merge should have conflicts");

    // Abort the merge
    repo.abort_merge().expect("abort_merge");

    // State should be clean
    let state = repo
        .get_repository_state()
        .expect("get_repository_state after abort");
    assert_eq!(state, "clean", "state should be clean after abort");

    // File content should be restored to main version
    let content = tr.read_file("shared.txt");
    assert_eq!(
        content, "main version",
        "file should be restored to main version after abort"
    );
}

// ---------------------------------------------------------------------------
// Diff + amend scenarios (Git2 only)
// ---------------------------------------------------------------------------

pub fn diff_file(repo: &dyn GitRepository, tr: &TestRepo) {
    // Commit an initial file
    tr.write_file("diff-target.txt", "line 1\nline 2\nline 3\n");
    repo.stage_file("diff-target.txt").expect("stage");
    repo.create_commit("init").expect("commit");

    // Modify the file (unstaged)
    tr.write_file("diff-target.txt", "line 1\nline 2 modified\nline 3\n");

    // Unstaged diff should have hunks
    let diff = repo
        .get_file_diff("diff-target.txt", false, false)
        .expect("get_file_diff unstaged");
    assert!(!diff.hunks.is_empty(), "unstaged diff should have hunks");

    // Stage the file
    repo.stage_file("diff-target.txt").expect("stage modified");

    // Staged diff should have hunks
    let diff = repo
        .get_file_diff("diff-target.txt", true, false)
        .expect("get_file_diff staged");
    assert!(!diff.hunks.is_empty(), "staged diff should have hunks");
}

pub fn amend_commit(repo: &dyn GitRepository, tr: &TestRepo) {
    // Create initial commit
    tr.write_file("amend.txt", "original");
    repo.stage_file("amend.txt").expect("stage");
    let original = repo.create_commit("original message").expect("commit");

    // Modify and stage
    tr.write_file("amend.txt", "amended content");
    repo.stage_file("amend.txt").expect("stage amended");

    // Amend the commit
    let amended = repo.amend_commit("amended").expect("amend_commit");

    // OID should change
    assert_ne!(amended.oid, original.oid, "OID should change after amend");

    // Summary should be updated
    assert_eq!(amended.summary, "amended", "summary should be 'amended'");

    // Log should still have only 1 commit
    let log = repo.get_log(10, 0, None, None).expect("get_log");
    assert_eq!(log.len(), 1, "should still have only 1 commit after amend");
    assert_eq!(log[0].summary, "amended");
}

// ---------------------------------------------------------------------------
// Remote network fetch (opt-in, both backends)
// ---------------------------------------------------------------------------

fn get_test_remote(env_var: &str) -> Option<String> {
    env::var(env_var).ok()
}

pub fn remote_network_fetch(repo: &dyn GitRepository, _tr: &TestRepo, env_var: &str) {
    let url = match get_test_remote(env_var) {
        Some(u) => u,
        None => {
            eprintln!("skipping remote_network_fetch: {} not set", env_var);
            return;
        }
    };

    repo.add_remote("test-remote", &url).expect("add_remote");
    repo.fetch_remote("test-remote")
        .expect("fetch_remote should succeed with valid credentials");
    repo.remove_remote("test-remote").expect("cleanup remote");
}

// ---------------------------------------------------------------------------
// Log and detail (both backends)
// ---------------------------------------------------------------------------

pub fn log_and_detail(repo: &dyn GitRepository, tr: &TestRepo) {
    for i in 1..=3 {
        tr.write_file(&format!("file{i}.txt"), &format!("content {i}"));
        repo.stage_file(&format!("file{i}.txt")).expect("stage");
        repo.create_commit(&format!("commit {i}")).expect("commit");
    }

    let log = repo.get_log(10, 0, None, None).expect("get_log");
    assert_eq!(log.len(), 3, "should have 3 commits");
    assert_eq!(log[0].summary, "commit 3");
    assert_eq!(log[1].summary, "commit 2");
    assert_eq!(log[2].summary, "commit 1");

    for entry in &log {
        assert_eq!(entry.oid.len(), 40, "oid should be 40 hex chars");
        assert!(entry.short_oid.len() >= 7, "short_oid should be >= 7 chars");
    }

    let detail = repo
        .get_commit_detail(&log[0].oid)
        .expect("get_commit_detail");
    assert_eq!(detail.summary, "commit 3");
    assert!(
        !detail.changed_files.is_empty(),
        "should list changed files"
    );
}
