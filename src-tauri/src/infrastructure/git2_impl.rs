use git2::Repository;
use std::cell::UnsafeCell;

use crate::domain::ports::repository::GitRepository;
use crate::error::Result;
use crate::git::types::{
    BlameLine, BranchInfo, CherryPickStatus, CommitDetail, CommitSummary, FileDiff, GitFlowConfig,
    LogFilters, MergeStatus, RebaseEntry, RebaseStatus, RebaseStep, ReflogEntry, RemoteFetchResult,
    RemoteInfo, RepoInfo, StashEntry, StatusEntry, SubmoduleInfo, TagInfo,
};
use crate::git::{
    blame, branch, cherry_pick, commit, config, diff, gitflow, history, merge, patch, rebase,
    reflog, remote, repository as git_repository, stash, status, submodule, tag,
};

/// Concrete implementation of `GitRepository` backed by `git2-rs`.
///
/// `inner` is wrapped in `UnsafeCell` so that stash operations (which require
/// `&mut Repository` in git2-rs) can be called via `&self` methods.
///
/// # Safety invariant
/// `AppState` guards access to `Git2Repository` behind a `Mutex`. Only one thread
/// holds a reference at a time, so `repo_mut()` is safe to call from `&self`.
pub struct Git2Repository {
    inner: UnsafeCell<Repository>,
}

// SAFETY: `Repository` is `Send`. `UnsafeCell` removes the auto-`Send` impl,
// but the Mutex in AppState ensures exclusive access — we re-assert `Send` here.
unsafe impl Send for Git2Repository {}

impl Git2Repository {
    pub fn open(path: &str) -> Result<Self> {
        Ok(Self {
            inner: UnsafeCell::new(git_repository::open(path)?),
        })
    }

    pub fn init(path: &str) -> Result<Self> {
        Ok(Self {
            inner: UnsafeCell::new(git_repository::init(path)?),
        })
    }

    pub fn from_raw(repo: Repository) -> Self {
        Self {
            inner: UnsafeCell::new(repo),
        }
    }

    fn repo(&self) -> &Repository {
        // SAFETY: AppState::Mutex guarantees exclusive access.
        unsafe { &*self.inner.get() }
    }

    #[allow(clippy::mut_from_ref)] // SAFETY: exclusive access garanti par AppState::Mutex (UnsafeCell délibéré).
    fn repo_mut(&self) -> &mut Repository {
        // SAFETY: AppState::Mutex guarantees exclusive access.
        unsafe { &mut *self.inner.get() }
    }
}

impl GitRepository for Git2Repository {
    fn repo_info(&self) -> Result<RepoInfo> {
        git_repository::repo_info(self.repo())
    }

    fn get_status(&self) -> Result<Vec<StatusEntry>> {
        status::get_status(self.repo())
    }

    fn list_tracked_files(&self) -> Result<Vec<String>> {
        status::list_tracked_files(self.repo())
    }

    fn stage_file(&self, path: &str) -> Result<()> {
        status::stage_file(self.repo(), path)
    }

    fn stage_paths(&self, paths: &[&str]) -> Result<()> {
        status::stage_paths(self.repo(), paths)
    }

    fn write_and_stage_file(&self, path: &str, content: &str) -> Result<()> {
        status::write_and_stage_file(self.repo(), path, content)
    }

    fn unstage_file(&self, path: &str) -> Result<()> {
        status::unstage_file(self.repo(), path)
    }

    fn unstage_paths(&self, paths: &[&str]) -> Result<()> {
        status::unstage_paths(self.repo(), paths)
    }

    fn discard_changes(&self, path: &str) -> Result<()> {
        status::discard_changes(self.repo(), path)
    }

    fn discard_all(&self) -> Result<()> {
        status::discard_all(self.repo())
    }

    fn stage_all(&self) -> Result<()> {
        status::stage_all(self.repo())
    }

    fn unstage_all(&self) -> Result<()> {
        status::unstage_all(self.repo())
    }

    fn get_blame(&self, path: &str, commit_oid: Option<&str>) -> Result<Vec<BlameLine>> {
        blame::get_blame(self.repo(), path, commit_oid)
    }

    fn stage_hunk(&self, path: &str, hunk_index: usize, selected: Option<&[usize]>) -> Result<()> {
        patch::stage_hunk(self.repo(), path, hunk_index, selected)
    }

    fn unstage_hunk(
        &self,
        path: &str,
        hunk_index: usize,
        selected: Option<&[usize]>,
    ) -> Result<()> {
        patch::unstage_hunk(self.repo(), path, hunk_index, selected)
    }

    fn reset_conflict_file(&self, path: &str) -> Result<()> {
        status::reset_conflict_file(self.repo(), path)
    }

    fn reset_staged_conflict_file(&self, path: &str) -> Result<()> {
        status::reset_staged_conflict_file(self.repo(), path)
    }

    fn reset_all_conflict_files(&self) -> Result<()> {
        status::reset_all_conflict_files(self.repo())
    }

    fn resolve_deletion_accept(&self, path: &str) -> Result<()> {
        status::resolve_deletion_accept(self.repo(), path)
    }

    fn resolve_deletion_restore(&self, path: &str) -> Result<()> {
        status::resolve_deletion_restore(self.repo(), path)
    }

    fn resolve_deletion_accept_theirs(&self, path: &str) -> Result<()> {
        status::resolve_deletion_accept_theirs(self.repo(), path)
    }

    fn resolve_deletion_keep_ours(&self, path: &str) -> Result<()> {
        status::resolve_deletion_keep_ours(self.repo(), path)
    }

    fn get_reflog(&self, refname: &str) -> Result<Vec<ReflogEntry>> {
        reflog::get_reflog(self.repo(), refname)
    }

    fn create_commit(&self, message: &str) -> Result<CommitSummary> {
        commit::create_commit(self.repo(), message)
    }

    fn amend_commit(&self, message: &str) -> Result<CommitSummary> {
        commit::amend_commit(self.repo(), message)
    }

    fn get_head_commit(&self) -> Result<CommitSummary> {
        commit::get_head_commit(self.repo())
    }

    fn get_file_diff(&self, path: &str, staged: bool, ignore_whitespace: bool) -> Result<FileDiff> {
        diff::get_file_diff(self.repo(), path, staged, ignore_whitespace)
    }

    fn get_commit_diff(&self, oid: &str, ignore_whitespace: bool) -> Result<Vec<FileDiff>> {
        diff::get_commit_diff(self.repo(), oid, ignore_whitespace)
    }

    fn get_commit_file_diff(
        &self,
        commit_oid: &str,
        path: &str,
        ignore_whitespace: bool,
    ) -> Result<FileDiff> {
        diff::get_commit_file_diff(self.repo(), commit_oid, path, ignore_whitespace)
    }

    fn get_log(
        &self,
        limit: usize,
        offset: usize,
        branch: Option<&str>,
        filters: Option<&LogFilters>,
    ) -> Result<Vec<CommitSummary>> {
        history::get_log(self.repo(), limit, offset, branch, filters)
    }

    fn get_graph_log(&self, limit: usize, show_all: bool) -> Result<Vec<CommitSummary>> {
        history::get_graph_log(self.repo(), limit, show_all)
    }

    fn get_commit_detail(&self, oid: &str) -> Result<CommitDetail> {
        history::get_commit_detail(self.repo(), oid)
    }

    fn merge_branch(&self, branch_name: &str, no_ff: bool) -> Result<MergeStatus> {
        merge::merge_branch(self.repo(), branch_name, no_ff)
    }

    fn abort_merge(&self) -> Result<()> {
        merge::abort_merge(self.repo())
    }

    fn get_repository_state(&self) -> Result<String> {
        Ok(merge::get_repository_state(self.repo()).to_string())
    }

    fn cherry_pick(&self, oid: &str) -> Result<CherryPickStatus> {
        cherry_pick::cherry_pick(self.repo(), oid)
    }

    fn continue_cherry_pick(&self) -> Result<CommitSummary> {
        cherry_pick::continue_cherry_pick(self.repo())
    }

    fn abort_cherry_pick(&self) -> Result<()> {
        cherry_pick::abort_cherry_pick(self.repo())
    }

    fn rebase_branch(&self, onto_branch: &str) -> Result<RebaseStatus> {
        rebase::rebase_branch(self.repo(), onto_branch)
    }

    fn continue_rebase(&self) -> Result<RebaseStatus> {
        rebase::continue_rebase(self.repo())
    }

    fn abort_rebase(&self) -> Result<()> {
        rebase::abort_rebase(self.repo())
    }

    fn get_interactive_rebase_commits(&self, upstream_oid: &str) -> Result<Vec<RebaseEntry>> {
        rebase::get_interactive_rebase_commits(self.repo(), upstream_oid)
    }

    fn apply_interactive_rebase(
        &self,
        upstream_oid: &str,
        steps: Vec<RebaseStep>,
    ) -> Result<RebaseStatus> {
        rebase::apply_interactive_rebase(self.repo(), upstream_oid, steps)
    }

    fn reset_to_commit(&self, oid: &str, mode: &str) -> Result<()> {
        history::reset_to_commit(self.repo(), oid, mode)
    }

    fn revert_commit(&self, oid: &str) -> Result<CommitSummary> {
        history::revert_commit(self.repo(), oid)
    }

    fn list_branches(&self, filter: Option<&str>) -> Result<Vec<BranchInfo>> {
        branch::list_branches(self.repo(), filter)
    }

    fn create_branch(&self, name: &str, from_ref: &str) -> Result<BranchInfo> {
        branch::create_branch(self.repo(), name, from_ref)
    }

    fn checkout_branch(&self, name: &str) -> Result<()> {
        branch::checkout_branch(self.repo(), name)
    }

    fn delete_branch(&self, name: &str, force: bool) -> Result<()> {
        branch::delete_branch(self.repo(), name, force)
    }

    fn rename_branch(&self, old_name: &str, new_name: &str) -> Result<BranchInfo> {
        branch::rename_branch(self.repo(), old_name, new_name)
    }

    fn checkout_remote_branch(&self, remote_branch_name: &str) -> Result<BranchInfo> {
        branch::checkout_remote_branch(self.repo(), remote_branch_name)
    }

    fn set_branch_upstream(&self, branch_name: &str, upstream: &str) -> Result<BranchInfo> {
        branch::set_branch_upstream(self.repo(), branch_name, upstream)
    }

    fn unset_branch_upstream(&self, branch_name: &str) -> Result<BranchInfo> {
        branch::unset_branch_upstream(self.repo(), branch_name)
    }

    fn list_remotes(&self) -> Result<Vec<RemoteInfo>> {
        remote::list_remotes(self.repo())
    }

    fn add_remote(&self, name: &str, url: &str) -> Result<RemoteInfo> {
        remote::add_remote(self.repo(), name, url)
    }

    fn remove_remote(&self, name: &str) -> Result<()> {
        remote::remove_remote(self.repo(), name)
    }

    fn fetch_remote(&self, remote_name: &str) -> Result<()> {
        remote::fetch(self.repo(), remote_name, None)
    }

    fn fetch_all_remotes(&self) -> Vec<RemoteFetchResult> {
        remote::fetch_all(self.repo())
    }

    fn push_remote(&self, remote_name: &str, branch: &str) -> Result<()> {
        remote::push(self.repo(), remote_name, branch, None)
    }

    fn push_force_with_lease(&self, remote_name: &str, branch: &str) -> Result<()> {
        if !crate::git::git_available() {
            return Err(crate::error::AppError::Other(
                "Le force push avec lease nécessite git installé sur ce système (libgit2 ne supporte pas --force-with-lease).".into(),
            ));
        }
        let workdir = self.repo().workdir().ok_or_else(|| {
            crate::error::AppError::Other("Dépôt bare — pas de répertoire de travail".into())
        })?;
        crate::git::force_push::push_force_with_lease(workdir, remote_name, branch)
    }

    fn pull_remote(&self, remote_name: &str, branch: &str) -> Result<()> {
        remote::pull(self.repo(), remote_name, branch, None)
    }

    fn fetch_remote_with_progress(
        &self,
        remote_name: &str,
        on_progress: Box<dyn Fn(u32, u32) + Send>,
    ) -> Result<()> {
        remote::fetch(self.repo(), remote_name, Some(on_progress))
    }

    fn push_remote_with_progress(
        &self,
        remote_name: &str,
        branch: &str,
        on_progress: Box<dyn Fn(u32, u32) + Send>,
    ) -> Result<()> {
        remote::push(self.repo(), remote_name, branch, Some(on_progress))
    }

    fn pull_remote_with_progress(
        &self,
        remote_name: &str,
        branch: &str,
        on_progress: Box<dyn Fn(u32, u32) + Send>,
    ) -> Result<()> {
        remote::pull(self.repo(), remote_name, branch, Some(on_progress))
    }

    fn get_git_config(&self, key: &str, global: bool) -> Result<Option<String>> {
        config::get_config(self.repo(), key, global)
    }

    fn set_git_config(&self, key: &str, value: &str, global: bool) -> Result<()> {
        config::set_config(self.repo(), key, value, global)
    }

    fn list_tags(&self) -> Result<Vec<TagInfo>> {
        tag::list_tags(self.repo())
    }

    fn create_tag(&self, name: &str, target_oid: &str, message: Option<&str>) -> Result<TagInfo> {
        tag::create_tag(self.repo(), name, target_oid, message)
    }

    fn delete_tag(&self, name: &str) -> Result<()> {
        tag::delete_tag(self.repo(), name)
    }

    fn push_tag(&self, remote_name: &str, tag_name: &str) -> Result<()> {
        tag::push_tag(self.repo(), remote_name, tag_name)
    }

    fn delete_remote_tag(&self, remote_name: &str, tag_name: &str) -> Result<()> {
        tag::delete_remote_tag(self.repo(), remote_name, tag_name)
    }

    fn list_remote_tags(&self, remote_name: &str) -> Result<Vec<String>> {
        tag::list_remote_tags(self.repo(), remote_name)
    }

    fn stash_save(
        &self,
        message: Option<&str>,
        include_untracked: bool,
        keep_index: bool,
    ) -> Result<String> {
        stash::stash_save(self.repo_mut(), message, include_untracked, keep_index)
    }

    fn stash_list(&self) -> Result<Vec<StashEntry>> {
        stash::stash_list(self.repo_mut())
    }

    fn stash_apply(&self, index: usize) -> Result<()> {
        stash::stash_apply(self.repo_mut(), index)
    }

    fn stash_pop(&self, index: usize) -> Result<()> {
        stash::stash_pop(self.repo_mut(), index)
    }

    fn stash_drop(&self, index: usize) -> Result<()> {
        stash::stash_drop(self.repo_mut(), index)
    }

    fn get_gitflow_config(&self) -> Option<GitFlowConfig> {
        gitflow::read_gitflow_config(self.repo())
    }

    fn init_gitflow(&self, config: &GitFlowConfig) -> Result<()> {
        gitflow::init_gitflow(self.repo(), config)
    }

    fn start_gitflow_branch(&self, kind: &str, name: &str) -> Result<BranchInfo> {
        let config = gitflow::read_gitflow_config(self.repo()).ok_or_else(|| {
            crate::error::AppError::Other("Git-flow non initialisé sur ce dépôt".into())
        })?;
        gitflow::start_branch(self.repo(), kind, name, &config)
    }

    fn finish_gitflow_branch(&self, kind: &str, name: &str) -> Result<()> {
        let config = gitflow::read_gitflow_config(self.repo()).ok_or_else(|| {
            crate::error::AppError::Other("Git-flow non initialisé sur ce dépôt".into())
        })?;
        gitflow::finish_branch(self.repo(), kind, name, &config)
    }

    fn prune_remote(&self, remote_name: &str) -> Result<()> {
        remote::prune_remote(self.repo(), remote_name)
    }

    fn list_submodules(&self) -> Result<Vec<SubmoduleInfo>> {
        submodule::list_submodules(self.repo())
    }

    fn init_submodule(&self, name: &str) -> Result<()> {
        submodule::init_submodule(self.repo(), name)
    }

    fn update_submodule(&self, name: &str) -> Result<()> {
        submodule::update_submodule(self.repo(), name)
    }

    fn update_all_submodules(&self) -> Result<()> {
        submodule::update_all_submodules(self.repo())
    }

    fn add_submodule(&self, url: &str, path: &str) -> Result<()> {
        submodule::add_submodule(self.repo(), url, path)
    }
}
