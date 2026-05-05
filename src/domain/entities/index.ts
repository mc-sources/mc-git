export interface ProgressEvent {
  operation: string;
  message: string;
  percent: number | null;
}

export interface BlameLine {
  lineNo: number;
  content: string;
  commitOid: string;
  shortOid: string;
  authorName: string;
  authorEmail: string;
  timestamp: number;
}

export type FileStatusKind =
  | "clean"
  | "added"
  | "modified"
  | "deleted"
  | "renamed"
  | "untracked"
  | "conflicted"
  | "ignored";

export interface CloneProgress {
  receivedObjects: number;
  totalObjects: number;
  indexedObjects: number;
  receivedBytes: number;
  percent: number;
}

export interface RepoInfo {
  path: string;
  name: string;
  headBranch: string | null;
  headOid: string | null;
}

export interface StatusEntry {
  path: string;
  oldPath: string | null;
  staged: FileStatusKind;
  unstaged: FileStatusKind;
}

export interface DiffLine {
  origin: "+" | "-" | " ";
  content: string;
  oldLineno: number | null;
  newLineno: number | null;
}

export interface DiffHunk {
  header: string;
  lines: DiffLine[];
}

export interface FileDiff {
  oldPath: string | null;
  newPath: string | null;
  isBinary: boolean;
  hunks: DiffHunk[];
  deletedInConflict: boolean;
  deletedByThem: boolean;
}

export interface Signature {
  name: string;
  email: string;
  when: number;
}

export interface CommitSummary {
  oid: string;
  shortOid: string;
  summary: string;
  author: Signature;
  committer: Signature;
  parentOids: string[];
}

export interface ChangedFileSummary {
  oldPath: string | null;
  newPath: string | null;
  isBinary: boolean;
  status: "added" | "modified" | "deleted" | "renamed" | "copied";
}

export interface CommitDetail extends CommitSummary {
  body: string | null;
  /** File list without diff content. Diffs are loaded on demand via getCommitFileDiff. */
  changedFiles: ChangedFileSummary[];
  /** True if the commit header contains a gpgsig (GPG signature). */
  isSignedCommit: boolean;
}

export interface GpgKeyInfo {
  keyId: string;
  uid: string;
}

export interface BranchInfo {
  name: string;
  isRemote: boolean;
  isHead: boolean;
  upstream: string | null;
  ahead: number | null;
  behind: number | null;
  headOid: string | null;
}

export interface RemoteInfo {
  name: string;
  url: string;
  pushUrl: string | null;
}

export interface RemoteFetchResult {
  remote: string;
  ok: boolean;
  error: string | null;
}

export interface TagInfo {
  name: string;
  targetOid: string;
  isAnnotated: boolean;
  message: string | null;
  tagger: Signature | null;
}

export interface StashEntry {
  index: number;
  message: string;
  oid: string;
}

export interface MergeStatus {
  hasConflicts: boolean;
  conflictCount: number;
}

export interface CherryPickStatus {
  hasConflicts: boolean;
  conflictCount: number;
}

export interface RebaseStatus {
  hasConflicts: boolean;
  conflictCount: number;
  currentStep: number;
  totalSteps: number;
  completed: boolean;
}

export type RepositoryState = "clean" | "merge" | "cherry_pick" | "rebase";

export interface CommitFilters {
  search?: string;
  since?: number;
  until?: number;
  path?: string;
}

export interface ReflogEntry {
  index: number;
  oidNew: string;
  shortOidNew: string;
  oidOld: string;
  message: string;
  committerName: string;
  timestamp: number;
}

export interface GitFlowConfig {
  master: string;
  develop: string;
  featurePrefix: string;
  releasePrefix: string;
  hotfixPrefix: string;
  supportPrefix: string;
  versionTagPrefix: string;
}

export type GitFlowBranchKind = "feature" | "release" | "hotfix" | "support";

export interface RebaseEntry {
  oid: string;
  shortOid: string;
  summary: string;
  authorName: string;
  authorEmail: string;
}

export type RebaseAction = "pick" | "reword" | "squash" | "fixup" | "drop";

export interface RebaseStep {
  oid: string;
  action: RebaseAction;
  /** New message for "reword" steps only. */
  message?: string;
}

export type SubmoduleStatus = "uninitialized" | "up_to_date" | "modified";

export interface SubmoduleInfo {
  name: string;
  path: string;
  url: string | null;
  headOid: string | null;
  status: SubmoduleStatus;
}
