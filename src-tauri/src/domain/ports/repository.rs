use crate::error::Result;
use crate::git::types::{
    BlameLine, BranchInfo, CherryPickStatus, CommitDetail, CommitSummary, FileDiff, GitFlowConfig,
    LogFilters, MergeStatus, RebaseEntry, RebaseStatus, RebaseStep, ReflogEntry, RemoteFetchResult,
    RemoteInfo, RepoInfo, StashEntry, StatusEntry, SubmoduleInfo, TagInfo,
};

/// Abstract port for all git operations on an opened repository.
/// Implementations live in `infrastructure/git2/`.
pub trait GitRepository: Send {
    fn repo_info(&self) -> Result<RepoInfo>;

    // Status & Staging
    fn get_status(&self) -> Result<Vec<StatusEntry>>;
    fn list_tracked_files(&self) -> Result<Vec<String>>;
    fn stage_file(&self, path: &str) -> Result<()>;
    fn stage_paths(&self, paths: &[&str]) -> Result<()>;
    fn write_and_stage_file(&self, path: &str, content: &str) -> Result<()>;
    fn unstage_file(&self, path: &str) -> Result<()>;
    fn unstage_paths(&self, paths: &[&str]) -> Result<()>;
    fn discard_changes(&self, path: &str) -> Result<()>;
    fn discard_all(&self) -> Result<()>;
    fn stage_all(&self) -> Result<()>;
    fn unstage_all(&self) -> Result<()>;
    fn stage_hunk(&self, path: &str, hunk_index: usize, selected: Option<&[usize]>) -> Result<()>;
    fn unstage_hunk(&self, path: &str, hunk_index: usize, selected: Option<&[usize]>)
        -> Result<()>;
    fn reset_conflict_file(&self, path: &str) -> Result<()>;
    fn reset_staged_conflict_file(&self, path: &str) -> Result<()>;
    fn reset_all_conflict_files(&self) -> Result<()>;
    fn resolve_deletion_accept(&self, path: &str) -> Result<()>;
    fn resolve_deletion_restore(&self, path: &str) -> Result<()>;
    fn resolve_deletion_accept_theirs(&self, path: &str) -> Result<()>;
    fn resolve_deletion_keep_ours(&self, path: &str) -> Result<()>;

    // Reflog
    fn get_reflog(&self, refname: &str) -> Result<Vec<ReflogEntry>>;

    // Commit
    fn create_commit(&self, message: &str) -> Result<CommitSummary>;
    fn amend_commit(&self, message: &str) -> Result<CommitSummary>;
    fn get_head_commit(&self) -> Result<CommitSummary>;

    // Blame
    fn get_blame(&self, path: &str, commit_oid: Option<&str>) -> Result<Vec<BlameLine>>;

    // Diff
    fn get_file_diff(&self, path: &str, staged: bool, ignore_whitespace: bool) -> Result<FileDiff>;
    fn get_commit_diff(&self, oid: &str, ignore_whitespace: bool) -> Result<Vec<FileDiff>>;
    fn get_commit_file_diff(
        &self,
        commit_oid: &str,
        path: &str,
        ignore_whitespace: bool,
    ) -> Result<FileDiff>;

    // Merge
    fn merge_branch(&self, branch_name: &str, no_ff: bool) -> Result<MergeStatus>;
    fn abort_merge(&self) -> Result<()>;
    fn get_repository_state(&self) -> Result<String>;

    // Cherry-pick
    fn cherry_pick(&self, oid: &str) -> Result<CherryPickStatus>;
    fn continue_cherry_pick(&self) -> Result<CommitSummary>;
    fn abort_cherry_pick(&self) -> Result<()>;

    // Rebase
    fn rebase_branch(&self, onto_branch: &str) -> Result<RebaseStatus>;
    fn continue_rebase(&self) -> Result<RebaseStatus>;
    fn abort_rebase(&self) -> Result<()>;
    fn get_interactive_rebase_commits(&self, upstream_oid: &str) -> Result<Vec<RebaseEntry>>;
    fn apply_interactive_rebase(
        &self,
        upstream_oid: &str,
        steps: Vec<RebaseStep>,
    ) -> Result<RebaseStatus>;

    // History
    fn get_log(
        &self,
        limit: usize,
        offset: usize,
        branch: Option<&str>,
        filters: Option<&LogFilters>,
    ) -> Result<Vec<CommitSummary>>;
    fn get_graph_log(&self, limit: usize, show_all: bool) -> Result<Vec<CommitSummary>>;
    fn get_commit_detail(&self, oid: &str) -> Result<CommitDetail>;
    fn reset_to_commit(&self, oid: &str, mode: &str) -> Result<()>;
    fn revert_commit(&self, oid: &str) -> Result<CommitSummary>;

    // Branches
    fn list_branches(&self, filter: Option<&str>) -> Result<Vec<BranchInfo>>;
    fn create_branch(&self, name: &str, from_ref: &str) -> Result<BranchInfo>;
    fn checkout_branch(&self, name: &str) -> Result<()>;
    fn delete_branch(&self, name: &str, force: bool) -> Result<()>;
    fn rename_branch(&self, old_name: &str, new_name: &str) -> Result<BranchInfo>;
    fn checkout_remote_branch(&self, remote_branch_name: &str) -> Result<BranchInfo>;
    fn set_branch_upstream(&self, branch_name: &str, upstream: &str) -> Result<BranchInfo>;
    fn unset_branch_upstream(&self, branch_name: &str) -> Result<BranchInfo>;

    // Remotes
    fn list_remotes(&self) -> Result<Vec<RemoteInfo>>;
    fn add_remote(&self, name: &str, url: &str) -> Result<RemoteInfo>;
    fn remove_remote(&self, name: &str) -> Result<()>;
    fn fetch_remote(&self, remote_name: &str) -> Result<()>;
    fn fetch_all_remotes(&self) -> Vec<RemoteFetchResult>;
    fn push_remote(&self, remote_name: &str, branch: &str) -> Result<()>;
    fn push_force_with_lease(&self, remote_name: &str, branch: &str) -> Result<()>;
    fn pull_remote(&self, remote_name: &str, branch: &str) -> Result<()>;
    fn prune_remote(&self, remote_name: &str) -> Result<()>;

    fn fetch_remote_with_progress(
        &self,
        remote_name: &str,
        on_progress: Box<dyn Fn(u32, u32) + Send>,
    ) -> Result<()> {
        let _ = on_progress;
        self.fetch_remote(remote_name)
    }

    fn push_remote_with_progress(
        &self,
        remote_name: &str,
        branch: &str,
        on_progress: Box<dyn Fn(u32, u32) + Send>,
    ) -> Result<()> {
        let _ = on_progress;
        self.push_remote(remote_name, branch)
    }

    fn pull_remote_with_progress(
        &self,
        remote_name: &str,
        branch: &str,
        on_progress: Box<dyn Fn(u32, u32) + Send>,
    ) -> Result<()> {
        let _ = on_progress;
        self.pull_remote(remote_name, branch)
    }

    // Config
    fn get_git_config(&self, key: &str, global: bool) -> Result<Option<String>>;
    fn set_git_config(&self, key: &str, value: &str, global: bool) -> Result<()>;

    // Tags
    fn list_tags(&self) -> Result<Vec<TagInfo>>;
    fn create_tag(&self, name: &str, target_oid: &str, message: Option<&str>) -> Result<TagInfo>;
    fn delete_tag(&self, name: &str) -> Result<()>;
    fn push_tag(&self, remote_name: &str, tag_name: &str) -> Result<()>;
    fn delete_remote_tag(&self, remote_name: &str, tag_name: &str) -> Result<()>;
    fn list_remote_tags(&self, remote_name: &str) -> Result<Vec<String>>;

    // Stash
    fn stash_save(
        &self,
        message: Option<&str>,
        include_untracked: bool,
        keep_index: bool,
    ) -> Result<String>;
    fn stash_list(&self) -> Result<Vec<StashEntry>>;
    fn stash_apply(&self, index: usize) -> Result<()>;
    fn stash_pop(&self, index: usize) -> Result<()>;
    fn stash_drop(&self, index: usize) -> Result<()>;

    // Git-flow
    fn get_gitflow_config(&self) -> Option<GitFlowConfig>;
    fn init_gitflow(&self, config: &GitFlowConfig) -> Result<()>;
    fn start_gitflow_branch(&self, kind: &str, name: &str) -> Result<BranchInfo>;
    fn finish_gitflow_branch(&self, kind: &str, name: &str) -> Result<()>;

    // Submodules
    fn list_submodules(&self) -> Result<Vec<SubmoduleInfo>>;
    fn init_submodule(&self, name: &str) -> Result<()>;
    fn update_submodule(&self, name: &str) -> Result<()>;
    fn update_all_submodules(&self) -> Result<()>;
    fn add_submodule(&self, url: &str, path: &str) -> Result<()>;
}
