import { invoke } from "@tauri-apps/api/core";
import type { IGitRepository, GitBackend, SshKeyInfo } from "../../domain/ports/IGitRepository";
import type {
  BlameLine,
  BranchInfo,
  ChangedFileSummary,
  CherryPickStatus,
  CommitDetail,
  CommitFilters,
  CommitSummary,
  FileDiff,
  DiffHunk,
  DiffLine,
  GitFlowBranchKind,
  GitFlowConfig,
  MergeStatus,
  RebaseEntry,
  RebaseStatus,
  RebaseStep,
  ReflogEntry,
  RemoteFetchResult,
  RemoteInfo,
  RepoInfo,
  RepositoryState,
  StashEntry,
  StatusEntry,
  SubmoduleInfo,
  TagInfo,
} from "../../domain/entities";

// Wire types (snake_case) from Rust IPC
interface WireRepoInfo {
  path: string;
  name: string;
  head_branch: string | null;
  head_oid: string | null;
}

interface WireStatusEntry {
  path: string;
  old_path: string | null;
  staged: StatusEntry["staged"];
  unstaged: StatusEntry["unstaged"];
}

interface WireDiffLine {
  origin: "+" | "-" | " ";
  content: string;
  old_lineno: number | null;
  new_lineno: number | null;
}

interface WireDiffHunk {
  header: string;
  lines: WireDiffLine[];
}

interface WireFileDiff {
  old_path: string | null;
  new_path: string | null;
  is_binary: boolean;
  hunks: WireDiffHunk[];
  deleted_in_conflict: boolean;
  deleted_by_them: boolean;
}

interface WireSignature {
  name: string;
  email: string;
  when: number;
}

interface WireCommitSummary {
  oid: string;
  short_oid: string;
  summary: string;
  author: WireSignature;
  committer: WireSignature;
  parent_oids: string[];
}

interface WireChangedFileSummary {
  old_path: string | null;
  new_path: string | null;
  is_binary: boolean;
  status: string;
}

interface WireCommitDetail extends WireCommitSummary {
  body: string | null;
  changed_files: WireChangedFileSummary[];
  is_signed: boolean;
}

interface WireBranchInfo {
  name: string;
  is_remote: boolean;
  is_head: boolean;
  upstream: string | null;
  ahead: number | null;
  behind: number | null;
  head_oid: string | null;
}

interface WireRemoteInfo {
  name: string;
  url: string;
  push_url: string | null;
}

interface WireBlameLine {
  line_no: number; content: string; commit_oid: string; short_oid: string;
  author_name: string; author_email: string; timestamp: number;
}

interface WireReflogEntry {
  index: number;
  oid_new: string;
  short_oid_new: string;
  oid_old: string;
  message: string;
  committer_name: string;
  timestamp: number;
}

interface WireMergeStatus {
  has_conflicts: boolean;
  conflict_count: number;
}

interface WireRebaseStatus {
  has_conflicts: boolean;
  conflict_count: number;
  current_step: number;
  total_steps: number;
  completed: boolean;
}

interface WireTagInfo {
  name: string; target_oid: string; is_annotated: boolean;
  message: string | null; tagger: { name: string; email: string; when: number } | null;
}

interface WireSshKeyInfo {
  name: string; algorithm: string; path: string;
}

interface WireGitFlowConfig {
  master: string;
  develop: string;
  feature_prefix: string;
  release_prefix: string;
  hotfix_prefix: string;
  support_prefix: string;
  version_tag_prefix: string;
}

interface WireSubmoduleInfo {
  name: string;
  path: string;
  url: string | null;
  head_oid: string | null;
  status: SubmoduleInfo["status"];
}

// Mapping functions
function mapRepoInfo(w: WireRepoInfo): RepoInfo {
  return { path: w.path, name: w.name, headBranch: w.head_branch, headOid: w.head_oid };
}

function mapDiffLine(w: WireDiffLine): DiffLine {
  return { origin: w.origin, content: w.content, oldLineno: w.old_lineno, newLineno: w.new_lineno };
}

function mapDiffHunk(w: WireDiffHunk): DiffHunk {
  return { header: w.header, lines: w.lines.map(mapDiffLine) };
}

function mapFileDiff(w: WireFileDiff): FileDiff {
  return { oldPath: w.old_path, newPath: w.new_path, isBinary: w.is_binary, hunks: w.hunks.map(mapDiffHunk), deletedInConflict: w.deleted_in_conflict ?? false, deletedByThem: w.deleted_by_them ?? false };
}

function mapCommitSummary(w: WireCommitSummary): CommitSummary {
  return {
    oid: w.oid,
    shortOid: w.short_oid,
    summary: w.summary,
    author: w.author,
    committer: w.committer,
    parentOids: w.parent_oids,
  };
}

function mapChangedFileSummary(w: WireChangedFileSummary): ChangedFileSummary {
  return { oldPath: w.old_path, newPath: w.new_path, isBinary: w.is_binary, status: w.status as ChangedFileSummary["status"] };
}

function mapCommitDetail(w: WireCommitDetail): CommitDetail {
  return {
    ...mapCommitSummary(w),
    body: w.body,
    changedFiles: w.changed_files.map(mapChangedFileSummary),
    isSignedCommit: w.is_signed,
  };
}

function mapBranchInfo(w: WireBranchInfo): BranchInfo {
  return {
    name: w.name,
    isRemote: w.is_remote,
    isHead: w.is_head,
    upstream: w.upstream,
    ahead: w.ahead,
    behind: w.behind,
    headOid: w.head_oid,
  };
}

function mapRemoteInfo(w: WireRemoteInfo): RemoteInfo {
  return { name: w.name, url: w.url, pushUrl: w.push_url };
}

function mapStatusEntry(w: WireStatusEntry): StatusEntry {
  return { path: w.path, oldPath: w.old_path, staged: w.staged, unstaged: w.unstaged };
}

export class TauriGitRepository implements IGitRepository {
  async openRepository(path: string, tabId: string, backend?: GitBackend): Promise<RepoInfo> {
    return invoke<WireRepoInfo>("open_repository", { path, tabId, backend }).then(mapRepoInfo);
  }

  async initRepository(path: string, tabId: string, backend?: GitBackend): Promise<RepoInfo> {
    return invoke<WireRepoInfo>("init_repository", { path, tabId, backend }).then(mapRepoInfo);
  }

  async cloneRepository(url: string, path: string, tabId: string): Promise<RepoInfo> {
    return invoke<WireRepoInfo>("clone_repository", { url, path, tabId }).then(mapRepoInfo);
  }

  async getRepoInfo(): Promise<RepoInfo> {
    return invoke<WireRepoInfo>("get_repo_info").then(mapRepoInfo);
  }

  async closeRepository(): Promise<void> {
    return invoke<void>("close_repository");
  }

  async switchActiveTab(tabId: string): Promise<void> {
    return invoke<void>("switch_active_tab", { tabId });
  }

  async closeTab(tabId: string): Promise<void> {
    return invoke<void>("close_tab", { tabId });
  }

  async detectGitBinary(): Promise<{ path: string; version: string }> {
    const [path, version] = await invoke<[string, string]>("detect_git_binary");
    return { path, version };
  }

  async getStatus(): Promise<StatusEntry[]> {
    return invoke<WireStatusEntry[]>("get_status").then((arr) => arr.map(mapStatusEntry));
  }

  async listTrackedFiles(): Promise<string[]> {
    return invoke<string[]>("list_tracked_files");
  }

  async stageFile(path: string): Promise<void> {
    return invoke<void>("stage_file", { path });
  }

  async stagePaths(paths: string[]): Promise<void> {
    return invoke<void>("stage_paths", { paths });
  }

  async unstageFile(path: string): Promise<void> {
    return invoke<void>("unstage_file", { path });
  }

  async unstagePaths(paths: string[]): Promise<void> {
    return invoke<void>("unstage_paths", { paths });
  }

  async discardChanges(path: string): Promise<void> {
    return invoke<void>("discard_changes", { path });
  }

  async discardAll(): Promise<void> {
    return invoke<void>("discard_all");
  }

  async stageAll(): Promise<void> {
    return invoke<void>("stage_all");
  }

  async unstageAll(): Promise<void> {
    return invoke<void>("unstage_all");
  }

  async writeAndStageFile(path: string, content: string): Promise<void> {
    return invoke<void>("write_and_stage_file", { path, content });
  }

  async getBlame(path: string, commitOid?: string): Promise<BlameLine[]> {
    return invoke<WireBlameLine[]>("get_blame", { path, commitOid: commitOid ?? null }).then(
      (arr) => arr.map((w) => ({
        lineNo: w.line_no, content: w.content, commitOid: w.commit_oid,
        shortOid: w.short_oid, authorName: w.author_name,
        authorEmail: w.author_email, timestamp: w.timestamp,
      }))
    );
  }

  async stageHunk(path: string, hunkIndex: number, selected?: number[]): Promise<void> {
    return invoke<void>("stage_hunk", { path, hunkIndex, selected: selected ?? null });
  }

  async unstageHunk(path: string, hunkIndex: number, selected?: number[]): Promise<void> {
    return invoke<void>("unstage_hunk", { path, hunkIndex, selected: selected ?? null });
  }

  async resetConflictFile(path: string): Promise<void> {
    return invoke<void>("reset_conflict_file", { path });
  }

  async resetStagedConflictFile(path: string): Promise<void> {
    return invoke<void>("reset_staged_conflict_file", { path });
  }

  async resetAllConflictFiles(): Promise<void> {
    return invoke<void>("reset_all_conflict_files");
  }

  async resolveDeletionAccept(path: string): Promise<void> {
    return invoke<void>("resolve_deletion_accept", { path });
  }

  async resolveDeletionRestore(path: string): Promise<void> {
    return invoke<void>("resolve_deletion_restore", { path });
  }

  async resolveDeletionAcceptTheirs(path: string): Promise<void> {
    return invoke<void>("resolve_deletion_accept_theirs", { path });
  }

  async resolveDeletionKeepOurs(path: string): Promise<void> {
    return invoke<void>("resolve_deletion_keep_ours", { path });
  }

  async createCommit(message: string): Promise<CommitSummary> {
    return invoke<WireCommitSummary>("create_commit", { message }).then(mapCommitSummary);
  }

  async amendCommit(message: string): Promise<CommitSummary> {
    return invoke<WireCommitSummary>("amend_commit", { message }).then(mapCommitSummary);
  }

  async getHeadCommit(): Promise<CommitSummary> {
    return invoke<WireCommitSummary>("get_head_commit").then(mapCommitSummary);
  }

  async getFileDiff(path: string, staged: boolean, ignoreWhitespace = false): Promise<FileDiff> {
    return invoke<WireFileDiff>("get_file_diff", { path, staged, ignoreWhitespace }).then(mapFileDiff);
  }

  async getCommitDiff(oid: string, ignoreWhitespace = false): Promise<FileDiff[]> {
    return invoke<WireFileDiff[]>("get_commit_diff", { oid, ignoreWhitespace }).then((arr) => arr.map(mapFileDiff));
  }

  async getCommitFileDiff(commitOid: string, path: string, ignoreWhitespace = false): Promise<FileDiff> {
    return invoke<WireFileDiff>("get_commit_file_diff", { oid: commitOid, path, ignoreWhitespace }).then(mapFileDiff);
  }

  async getLog(limit: number, offset: number, branch?: string, filters?: CommitFilters): Promise<CommitSummary[]> {
    const wireFilters = filters && (filters.search || filters.since != null || filters.until != null || filters.path)
      ? {
          search: filters.search ?? null,
          since: filters.since ?? null,
          until: filters.until ?? null,
          path: filters.path ?? null,
        }
      : null;
    return invoke<WireCommitSummary[]>("get_log", { limit, offset, branch: branch ?? null, filters: wireFilters }).then(
      (arr) => arr.map(mapCommitSummary)
    );
  }

  async getGraphLog(limit: number, showAll: boolean): Promise<CommitSummary[]> {
    return invoke<WireCommitSummary[]>("get_graph_log", { limit, showAll }).then(
      (arr) => arr.map(mapCommitSummary)
    );
  }

  async getCommitDetail(oid: string): Promise<CommitDetail> {
    return invoke<WireCommitDetail>("get_commit_detail", { oid }).then(mapCommitDetail);
  }

  async resetToCommit(oid: string, mode: "soft" | "mixed" | "hard"): Promise<void> {
    return invoke("reset_to_commit", { oid, mode });
  }

  async revertCommit(oid: string): Promise<CommitSummary> {
    return invoke<WireCommitSummary>("revert_commit", { oid }).then(mapCommitSummary);
  }

  async getReflog(refname?: string): Promise<ReflogEntry[]> {
    return invoke<WireReflogEntry[]>("get_reflog", { refname: refname ?? null }).then((arr) =>
      arr.map((e) => ({
        index: e.index,
        oidNew: e.oid_new,
        shortOidNew: e.short_oid_new,
        oidOld: e.oid_old,
        message: e.message,
        committerName: e.committer_name,
        timestamp: e.timestamp,
      }))
    );
  }

  async mergeBranch(branchName: string, noFf: boolean): Promise<MergeStatus> {
    return invoke<WireMergeStatus>("merge_branch", { branchName, noFf }).then(
      (r) => ({ hasConflicts: r.has_conflicts, conflictCount: r.conflict_count })
    );
  }

  async abortMerge(): Promise<void> {
    return invoke("abort_merge");
  }

  async getRepositoryState(): Promise<RepositoryState> {
    return invoke<string>("get_repository_state") as Promise<RepositoryState>;
  }

  async cherryPick(oid: string): Promise<CherryPickStatus> {
    return invoke<WireMergeStatus>("cherry_pick", { oid }).then(
      (r) => ({ hasConflicts: r.has_conflicts, conflictCount: r.conflict_count })
    );
  }

  async continueCherryPick(): Promise<CommitSummary> {
    return invoke<WireCommitSummary>("continue_cherry_pick").then(mapCommitSummary);
  }

  async abortCherryPick(): Promise<void> {
    return invoke("abort_cherry_pick");
  }

  async rebaseBranch(ontoBranch: string): Promise<RebaseStatus> {
    return invoke<WireRebaseStatus>("rebase_branch", { ontoBranch }).then((r) => ({
      hasConflicts: r.has_conflicts,
      conflictCount: r.conflict_count,
      currentStep: r.current_step,
      totalSteps: r.total_steps,
      completed: r.completed,
    }));
  }

  async continueRebase(): Promise<RebaseStatus> {
    return invoke<WireRebaseStatus>("continue_rebase").then((r) => ({
      hasConflicts: r.has_conflicts,
      conflictCount: r.conflict_count,
      currentStep: r.current_step,
      totalSteps: r.total_steps,
      completed: r.completed,
    }));
  }

  async abortRebase(): Promise<void> {
    return invoke("abort_rebase");
  }

  async getInteractiveRebaseCommits(upstreamOid: string): Promise<RebaseEntry[]> {
    return invoke<Array<{
      oid: string; short_oid: string; summary: string; author_name: string; author_email: string;
    }>>("get_interactive_rebase_commits", { upstreamOid }).then((arr) =>
      arr.map((e) => ({
        oid: e.oid,
        shortOid: e.short_oid,
        summary: e.summary,
        authorName: e.author_name,
        authorEmail: e.author_email,
      }))
    );
  }

  async applyInteractiveRebase(upstreamOid: string, steps: RebaseStep[]): Promise<RebaseStatus> {
    return invoke<{
      has_conflicts: boolean; conflict_count: number; current_step: number; total_steps: number; completed: boolean;
    }>("apply_interactive_rebase", { upstreamOid, steps: steps.map((s) => ({
      oid: s.oid, action: s.action, message: s.message ?? null,
    })) }).then((r) => ({
      hasConflicts: r.has_conflicts,
      conflictCount: r.conflict_count,
      currentStep: r.current_step,
      totalSteps: r.total_steps,
      completed: r.completed,
    }));
  }

  async listBranches(filter?: "local" | "remote" | "all"): Promise<BranchInfo[]> {
    return invoke<WireBranchInfo[]>("list_branches", { filter: filter ?? null }).then(
      (arr) => arr.map(mapBranchInfo)
    );
  }

  async createBranch(name: string, fromRef: string): Promise<BranchInfo> {
    return invoke<WireBranchInfo>("create_branch", { name, fromRef }).then(mapBranchInfo);
  }

  async checkoutBranch(name: string): Promise<void> {
    return invoke<void>("checkout_branch", { name });
  }

  async deleteBranch(name: string, force: boolean): Promise<void> {
    return invoke<void>("delete_branch", { name, force });
  }

  async renameBranch(oldName: string, newName: string): Promise<BranchInfo> {
    return invoke<WireBranchInfo>("rename_branch", { oldName, newName }).then(mapBranchInfo);
  }

  async checkoutRemoteBranch(remoteBranchName: string): Promise<BranchInfo> {
    return invoke<WireBranchInfo>("checkout_remote_branch", { remoteBranchName }).then(mapBranchInfo);
  }

  async setBranchUpstream(branchName: string, upstream: string): Promise<BranchInfo> {
    return invoke<WireBranchInfo>("set_branch_upstream", { branchName, upstream }).then(mapBranchInfo);
  }

  async unsetBranchUpstream(branchName: string): Promise<BranchInfo> {
    return invoke<WireBranchInfo>("unset_branch_upstream", { branchName }).then(mapBranchInfo);
  }

  async listRemotes(): Promise<RemoteInfo[]> {
    return invoke<WireRemoteInfo[]>("list_remotes").then((arr) => arr.map(mapRemoteInfo));
  }

  async addRemote(name: string, url: string): Promise<RemoteInfo> {
    return invoke<WireRemoteInfo>("add_remote", { name, url }).then(mapRemoteInfo);
  }

  async removeRemote(name: string): Promise<void> {
    return invoke<void>("remove_remote", { name });
  }

  async fetchRemote(remoteName: string): Promise<void> {
    return invoke<void>("fetch_remote", { remoteName });
  }

  async fetchAllRemotes(): Promise<RemoteFetchResult[]> {
    return invoke<RemoteFetchResult[]>("fetch_all_remotes");
  }

  async pushRemote(remoteName: string, branch: string): Promise<void> {
    return invoke<void>("push_remote", { remoteName, branch });
  }

  async pushForceWithLease(remoteName: string, branch: string): Promise<void> {
    return invoke<void>("push_force_with_lease", { remoteName, branch });
  }

  async pullRemote(remoteName: string, branch: string): Promise<void> {
    return invoke<void>("pull_remote", { remoteName, branch });
  }

  async getGitConfig(key: string, global: boolean): Promise<string | null> {
    return invoke<string | null>("get_git_config", { key, global });
  }

  async setGitConfig(key: string, value: string, global: boolean): Promise<void> {
    return invoke<void>("set_git_config", { key, value, global });
  }

  async listTags(): Promise<TagInfo[]> {
    return invoke<WireTagInfo[]>("list_tags").then((arr) =>
      arr.map((w) => ({
        name: w.name,
        targetOid: w.target_oid,
        isAnnotated: w.is_annotated,
        message: w.message,
        tagger: w.tagger,
      }))
    );
  }

  async createTag(name: string, targetOid: string, message: string | null): Promise<TagInfo> {
    return invoke<WireTagInfo>("create_tag", { name, targetOid, message }).then((w) => ({
      name: w.name,
      targetOid: w.target_oid,
      isAnnotated: w.is_annotated,
      message: w.message,
      tagger: w.tagger,
    }));
  }

  async deleteTag(name: string): Promise<void> {
    return invoke<void>("delete_tag", { name });
  }

  async pushTag(remoteName: string, tagName: string): Promise<void> {
    return invoke<void>("push_tag", { remoteName, tagName });
  }

  async deleteRemoteTag(remoteName: string, tagName: string): Promise<void> {
    return invoke<void>("delete_remote_tag", { remoteName, tagName });
  }

  async listRemoteTags(remoteName: string): Promise<string[]> {
    return invoke<string[]>("list_remote_tags", { remoteName });
  }

  async stashSave(message: string | null, includeUntracked: boolean, keepIndex: boolean): Promise<string> {
    return invoke<string>("stash_save", { message, includeUntracked, keepIndex });
  }

  async stashList(): Promise<StashEntry[]> {
    return invoke<StashEntry[]>("stash_list");
  }

  async stashApply(index: number): Promise<void> {
    return invoke<void>("stash_apply", { index });
  }

  async stashPop(index: number): Promise<void> {
    return invoke<void>("stash_pop", { index });
  }

  async stashDrop(index: number): Promise<void> {
    return invoke<void>("stash_drop", { index });
  }

  async listSshKeys(): Promise<SshKeyInfo[]> {
    return invoke<WireSshKeyInfo[]>("list_ssh_keys").then((arr) =>
      arr.map((w) => ({ name: w.name, algorithm: w.algorithm, path: w.path }))
    );
  }

  async listSavedHosts(): Promise<string[]> {
    return invoke<string[]>("list_saved_hosts");
  }

  async saveCredentials(host: string, username: string, token: string): Promise<void> {
    return invoke<void>("save_credentials", { host, username, token });
  }

  async clearCredentials(host: string): Promise<void> {
    return invoke<void>("clear_credentials", { host });
  }

  async trustSshHost(host: string, fingerprint: string): Promise<void> {
    return invoke<void>("trust_ssh_host", { host, fingerprint });
  }

  async getGitflowConfig(): Promise<GitFlowConfig | null> {
    const raw = await invoke<WireGitFlowConfig | null>("get_gitflow_config");
    if (!raw) return null;
    return {
      master: raw.master,
      develop: raw.develop,
      featurePrefix: raw.feature_prefix,
      releasePrefix: raw.release_prefix,
      hotfixPrefix: raw.hotfix_prefix,
      supportPrefix: raw.support_prefix,
      versionTagPrefix: raw.version_tag_prefix,
    };
  }

  async initGitflow(config: GitFlowConfig): Promise<void> {
    return invoke<void>("init_gitflow", {
      config: {
        master: config.master,
        develop: config.develop,
        feature_prefix: config.featurePrefix,
        release_prefix: config.releasePrefix,
        hotfix_prefix: config.hotfixPrefix,
        support_prefix: config.supportPrefix,
        version_tag_prefix: config.versionTagPrefix,
      },
    });
  }

  async startGitflowBranch(kind: GitFlowBranchKind, name: string): Promise<BranchInfo> {
    return invoke<WireBranchInfo>("start_gitflow_branch", { kind, name }).then(mapBranchInfo);
  }

  async finishGitflowBranch(kind: GitFlowBranchKind, name: string): Promise<void> {
    return invoke<void>("finish_gitflow_branch", { kind, name });
  }

  async pruneRemote(remoteName: string): Promise<void> {
    return invoke("prune_remote", { remoteName });
  }

  async listSubmodules(): Promise<SubmoduleInfo[]> {
    return invoke<WireSubmoduleInfo[]>("list_submodules").then((arr) =>
      arr.map((w) => ({
        name: w.name,
        path: w.path,
        url: w.url,
        headOid: w.head_oid,
        status: w.status,
      }))
    );
  }

  async initSubmodule(name: string): Promise<void> {
    return invoke("init_submodule", { name });
  }

  async updateSubmodule(name: string): Promise<void> {
    return invoke("update_submodule", { name });
  }

  async updateAllSubmodules(): Promise<void> {
    return invoke("update_all_submodules");
  }

  async addSubmodule(url: string, path: string): Promise<void> {
    return invoke("add_submodule", { url, path });
  }
}
