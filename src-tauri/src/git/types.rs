use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BlameLine {
    pub line_no: u32,
    pub content: String,
    pub commit_oid: String,
    pub short_oid: String,
    pub author_name: String,
    pub author_email: String,
    pub timestamp: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RepoInfo {
    pub path: String,
    pub name: String,
    pub head_branch: Option<String>,
    pub head_oid: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum FileStatusKind {
    Clean, // placeholder — no change in this area
    Added,
    Modified,
    Deleted,
    Renamed,
    Untracked,
    Conflicted,
    Ignored,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StatusEntry {
    pub path: String,
    pub old_path: Option<String>,
    pub staged: FileStatusKind,
    pub unstaged: FileStatusKind,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiffLine {
    pub origin: char, // '+', '-', ' '
    pub content: String,
    pub old_lineno: Option<u32>,
    pub new_lineno: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiffHunk {
    pub header: String,
    pub lines: Vec<DiffLine>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileDiff {
    pub old_path: Option<String>,
    pub new_path: Option<String>,
    pub is_binary: bool,
    pub hunks: Vec<DiffHunk>,
    /// True only when the file was deleted as part of a merge conflict
    /// ("deleted by us" / DU conflict). False for regular deletions.
    #[serde(default)]
    pub deleted_in_conflict: bool,
    /// True when the remote side deleted the file ("deleted by them" / UD conflict)
    /// but our side modified it. The file still exists on disk with our content.
    #[serde(default)]
    pub deleted_by_them: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Signature {
    pub name: String,
    pub email: String,
    pub when: i64, // Unix timestamp
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReflogEntry {
    pub index: usize,
    pub oid_new: String,
    pub short_oid_new: String,
    pub oid_old: String,
    pub message: String,
    pub committer_name: String,
    pub timestamp: i64,
}

/// Filters for commit log queries. All fields are optional (no filter = no restriction).
#[derive(Debug, Default, Deserialize)]
pub struct LogFilters {
    /// Searches commit message AND author name/email (case-insensitive OR match)
    pub search: Option<String>,
    /// Lower bound: only commits at or after this Unix timestamp (seconds)
    pub since: Option<i64>,
    /// Upper bound: only commits at or before this Unix timestamp (seconds)
    pub until: Option<i64>,
    /// Only commits that touch this file path (expensive — triggers per-commit diff)
    pub path: Option<String>,
}

impl LogFilters {
    pub fn is_empty(&self) -> bool {
        self.search.is_none() && self.since.is_none() && self.until.is_none() && self.path.is_none()
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CommitSummary {
    pub oid: String,
    pub short_oid: String,
    pub summary: String,
    pub author: Signature,
    pub committer: Signature,
    pub parent_oids: Vec<String>,
}

/// Lightweight file summary — path and binary flag only, no diff content.
/// Used in CommitDetail so that loading a commit's metadata is fast even for
/// commits with hundreds of changed files.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChangedFileSummary {
    pub old_path: Option<String>,
    pub new_path: Option<String>,
    pub is_binary: bool,
    pub status: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CommitDetail {
    pub oid: String,
    pub short_oid: String,
    pub summary: String,
    pub body: Option<String>,
    pub author: Signature,
    pub committer: Signature,
    pub parent_oids: Vec<String>,
    /// File list without diff content — diffs are loaded on demand via get_commit_file_diff.
    pub changed_files: Vec<ChangedFileSummary>,
    /// Whether the commit contains a GPG signature header.
    pub is_signed: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BranchInfo {
    pub name: String,
    pub is_remote: bool,
    pub is_head: bool,
    pub upstream: Option<String>,
    pub ahead: Option<usize>,
    pub behind: Option<usize>,
    pub head_oid: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RemoteInfo {
    pub name: String,
    pub url: String,
    pub push_url: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct RemoteFetchResult {
    pub remote: String,
    pub ok: bool,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TagInfo {
    pub name: String,
    pub target_oid: String,
    pub is_annotated: bool,
    pub message: Option<String>,
    pub tagger: Option<Signature>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StashEntry {
    pub index: usize,
    pub message: String,
    pub oid: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MergeStatus {
    pub has_conflicts: bool,
    pub conflict_count: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CherryPickStatus {
    pub has_conflicts: bool,
    pub conflict_count: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RebaseStatus {
    pub has_conflicts: bool,
    pub conflict_count: usize,
    pub current_step: usize,
    pub total_steps: usize,
    pub completed: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum SubmoduleStatus {
    Uninitialized,
    UpToDate,
    Modified,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SubmoduleInfo {
    pub name: String,
    pub path: String,
    pub url: Option<String>,
    pub head_oid: Option<String>,
    pub status: SubmoduleStatus,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitFlowConfig {
    pub master: String,
    pub develop: String,
    pub feature_prefix: String,
    pub release_prefix: String,
    pub hotfix_prefix: String,
    pub support_prefix: String,
    pub version_tag_prefix: String,
}

/// A commit entry for the interactive rebase plan — sent to the frontend for display.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RebaseEntry {
    pub oid: String,
    pub short_oid: String,
    pub summary: String,
    pub author_name: String,
    pub author_email: String,
}

/// A single step in an interactive rebase plan, as received from the frontend.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RebaseStep {
    /// Full OID of the original commit.
    pub oid: String,
    /// Action: "pick" | "reword" | "squash" | "fixup" | "drop".
    pub action: String,
    /// New commit message for "reword" steps only.
    pub message: Option<String>,
}
