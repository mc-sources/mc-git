import type {
  BlameLine,
  BranchInfo,
  CherryPickStatus,
  CommitDetail,
  CommitFilters,
  CommitSummary,
  FileDiff,
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
} from "../entities";

export type GitBackend = "git2" | "cli";

export interface IGitRepository {
  // Repository
  openRepository(path: string, tabId: string, backend?: GitBackend): Promise<RepoInfo>;
  initRepository(path: string, tabId: string, backend?: GitBackend): Promise<RepoInfo>;
  cloneRepository(url: string, path: string, tabId: string): Promise<RepoInfo>;
  getRepoInfo(): Promise<RepoInfo>;
  closeRepository(): Promise<void>;
  switchActiveTab(tabId: string): Promise<void>;
  closeTab(tabId: string): Promise<void>;
  detectGitBinary(): Promise<{ path: string; version: string }>;

  // Status & Staging
  getStatus(): Promise<StatusEntry[]>;
  listTrackedFiles(): Promise<string[]>;
  stageFile(path: string): Promise<void>;
  stagePaths(paths: string[]): Promise<void>;
  unstageFile(path: string): Promise<void>;
  unstagePaths(paths: string[]): Promise<void>;
  discardChanges(path: string): Promise<void>;
  discardAll(): Promise<void>;
  stageAll(): Promise<void>;
  unstageAll(): Promise<void>;
  writeAndStageFile(path: string, content: string): Promise<void>;
  stageHunk(path: string, hunkIndex: number, selected?: number[]): Promise<void>;
  unstageHunk(path: string, hunkIndex: number, selected?: number[]): Promise<void>;
  resetConflictFile(path: string): Promise<void>;
  resetStagedConflictFile(path: string): Promise<void>;
  resetAllConflictFiles(): Promise<void>;
  resolveDeletionAccept(path: string): Promise<void>;
  resolveDeletionRestore(path: string): Promise<void>;
  resolveDeletionAcceptTheirs(path: string): Promise<void>;
  resolveDeletionKeepOurs(path: string): Promise<void>;

  // Commit
  createCommit(message: string): Promise<CommitSummary>;
  amendCommit(message: string): Promise<CommitSummary>;
  getHeadCommit(): Promise<CommitSummary>;

  // Blame
  getBlame(path: string, commitOid?: string): Promise<BlameLine[]>;

  // Diff
  getFileDiff(path: string, staged: boolean, ignoreWhitespace?: boolean): Promise<FileDiff>;
  getCommitDiff(oid: string, ignoreWhitespace?: boolean): Promise<FileDiff[]>;
  getCommitFileDiff(commitOid: string, path: string, ignoreWhitespace?: boolean): Promise<FileDiff>;

  // Merge
  mergeBranch(branchName: string, noFf: boolean): Promise<MergeStatus>;
  abortMerge(): Promise<void>;
  getRepositoryState(): Promise<RepositoryState>;

  // Cherry-pick
  cherryPick(oid: string): Promise<CherryPickStatus>;
  continueCherryPick(): Promise<CommitSummary>;
  abortCherryPick(): Promise<void>;

  // Rebase
  rebaseBranch(ontoBranch: string): Promise<RebaseStatus>;
  continueRebase(): Promise<RebaseStatus>;
  abortRebase(): Promise<void>;
  getInteractiveRebaseCommits(upstreamOid: string): Promise<RebaseEntry[]>;
  applyInteractiveRebase(upstreamOid: string, steps: RebaseStep[]): Promise<RebaseStatus>;

  // History
  getLog(limit: number, offset: number, branch?: string, filters?: CommitFilters): Promise<CommitSummary[]>;
  getGraphLog(limit: number, showAll: boolean): Promise<CommitSummary[]>;
  getCommitDetail(oid: string): Promise<CommitDetail>;
  resetToCommit(oid: string, mode: "soft" | "mixed" | "hard"): Promise<void>;
  revertCommit(oid: string): Promise<CommitSummary>;
  getReflog(refname?: string): Promise<ReflogEntry[]>;

  // Branches
  listBranches(filter?: "local" | "remote" | "all"): Promise<BranchInfo[]>;
  createBranch(name: string, fromRef: string): Promise<BranchInfo>;
  checkoutBranch(name: string): Promise<void>;
  deleteBranch(name: string, force: boolean): Promise<void>;
  renameBranch(oldName: string, newName: string): Promise<BranchInfo>;
  checkoutRemoteBranch(remoteBranchName: string): Promise<BranchInfo>;
  setBranchUpstream(branchName: string, upstream: string): Promise<BranchInfo>;
  unsetBranchUpstream(branchName: string): Promise<BranchInfo>;

  // Remotes
  listRemotes(): Promise<RemoteInfo[]>;
  addRemote(name: string, url: string): Promise<RemoteInfo>;
  removeRemote(name: string): Promise<void>;
  fetchRemote(remoteName: string): Promise<void>;
  fetchAllRemotes(): Promise<RemoteFetchResult[]>;
  pushRemote(remoteName: string, branch: string): Promise<void>;
  pushForceWithLease(remoteName: string, branch: string): Promise<void>;
  pullRemote(remoteName: string, branch: string): Promise<void>;
  pruneRemote(remoteName: string): Promise<void>;

  // Config
  getGitConfig(key: string, global: boolean): Promise<string | null>;
  setGitConfig(key: string, value: string, global: boolean): Promise<void>;

  // Tags
  listTags(): Promise<TagInfo[]>;
  createTag(name: string, targetOid: string, message: string | null): Promise<TagInfo>;
  deleteTag(name: string): Promise<void>;
  pushTag(remoteName: string, tagName: string, force: boolean): Promise<void>;
  deleteRemoteTag(remoteName: string, tagName: string): Promise<void>;
  listRemoteTags(remoteName: string): Promise<string[]>;

  // Stash
  stashSave(message: string | null, includeUntracked: boolean, keepIndex: boolean): Promise<string>;
  stashList(): Promise<StashEntry[]>;
  stashApply(index: number): Promise<void>;
  stashPop(index: number): Promise<void>;
  stashDrop(index: number): Promise<void>;

  // Auth
  listSshKeys(): Promise<SshKeyInfo[]>;
  listSavedHosts(): Promise<string[]>;
  saveCredentials(host: string, username: string, token: string): Promise<void>;
  clearCredentials(host: string): Promise<void>;
  trustSshHost(host: string, fingerprint: string): Promise<void>;

  // Git-flow
  getGitflowConfig(): Promise<GitFlowConfig | null>;
  initGitflow(config: GitFlowConfig): Promise<void>;
  startGitflowBranch(kind: GitFlowBranchKind, name: string): Promise<BranchInfo>;
  finishGitflowBranch(kind: GitFlowBranchKind, name: string): Promise<void>;

  // Submodules
  listSubmodules(): Promise<SubmoduleInfo[]>;
  initSubmodule(name: string): Promise<void>;
  updateSubmodule(name: string): Promise<void>;
  updateAllSubmodules(): Promise<void>;
  addSubmodule(url: string, path: string): Promise<void>;
}

export interface SshKeyInfo {
  name: string;
  algorithm: string;
  path: string;
}
