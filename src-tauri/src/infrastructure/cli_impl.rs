use std::path::PathBuf;
use std::process::Command;

use crate::domain::ports::repository::GitRepository;
use crate::error::{AppError, Result};
use crate::git::types::{
    BlameLine, BranchInfo, ChangedFileSummary, CherryPickStatus, CommitDetail, CommitSummary,
    FileDiff, FileStatusKind, GitFlowConfig, LogFilters, MergeStatus, RebaseStatus, ReflogEntry,
    RemoteFetchResult, RemoteInfo, RepoInfo, Signature, StashEntry, StatusEntry, SubmoduleInfo,
    TagInfo,
};

/// Concrete implementation of `GitRepository` backed by the system `git` binary.
///
/// All git operations are delegated to the external `git` binary via
/// `std::process::Command`. This provides native SSH-agent and credential-helper
/// support, at the cost of not supporting diff, blame, hunk-level staging,
/// stash, tags, merge, rebase, cherry-pick, git-flow, submodules, or reflog.
///
/// Unsupported methods return `AppError::Other` with a clear message.
pub struct CliGitRepository {
    path: PathBuf,
}

// ─── Construction ─────────────────────────────────────────────────────────────

impl CliGitRepository {
    pub fn open(path: &str) -> Result<Self> {
        let p = PathBuf::from(path);
        let out = Command::new("git")
            .args(["rev-parse", "--git-dir"])
            .current_dir(&p)
            .env("LC_ALL", "C")
            .env("GIT_TERMINAL_PROMPT", "0")
            .output()
            .map_err(|e| AppError::Other(format!("git introuvable : {e}")))?;
        if !out.status.success() {
            return Err(AppError::Other("Pas un dépôt git".into()));
        }
        Ok(Self { path: p })
    }

    pub fn init(path: &str) -> Result<Self> {
        let p = PathBuf::from(path);
        std::fs::create_dir_all(&p)
            .map_err(|e| AppError::Other(format!("Impossible de créer le répertoire : {e}")))?;
        let out = Command::new("git")
            .args(["init"])
            .current_dir(&p)
            .env("LC_ALL", "C")
            .env("GIT_TERMINAL_PROMPT", "0")
            .output()
            .map_err(|e| AppError::Other(format!("git introuvable : {e}")))?;
        if !out.status.success() {
            let stderr = String::from_utf8_lossy(&out.stderr);
            return Err(AppError::Other(stderr.trim().to_string()));
        }
        Ok(Self { path: p })
    }

    /// Run a git command in `self.path`, return stdout on success, stderr as Err on failure.
    fn run(&self, args: &[&str]) -> Result<String> {
        let out = Command::new("git")
            .args(args)
            .current_dir(&self.path)
            .env("LC_ALL", "C")
            .env("GIT_TERMINAL_PROMPT", "0")
            .output()
            .map_err(|e| AppError::Other(format!("git introuvable : {e}")))?;
        if out.status.success() {
            Ok(String::from_utf8_lossy(&out.stdout).into_owned())
        } else {
            let stderr = String::from_utf8_lossy(&out.stderr);
            Err(AppError::Other(stderr.trim().to_string()))
        }
    }

    fn unsupported(feature: &str) -> AppError {
        AppError::Other(format!(
            "Non disponible avec le backend Git CLI : {feature}. \
             Passez au backend intégré (git2) dans les Paramètres."
        ))
    }
}

// ─── Log format ────────────────────────────────────────────────────────────────
//
// Fields separated by \x1f (unit separator), records terminated by \x1e (record sep).
// Fields: oid, short_oid, subject, author_name, author_email, author_ts,
//         committer_name, committer_email, committer_ts, parent_oids
const LOG_FORMAT: &str =
    "--format=%H\x1f%h\x1f%s\x1f%an\x1f%ae\x1f%at\x1f%cn\x1f%ce\x1f%ct\x1f%P\x1e";

// ─── Parsing helpers ───────────────────────────────────────────────────────────

fn parse_commit_summary(record: &str) -> Option<CommitSummary> {
    let r = record.trim();
    if r.is_empty() {
        return None;
    }
    let mut f = r.splitn(10, '\x1f');
    let oid = f.next()?.trim().to_string();
    if oid.is_empty() {
        return None;
    }
    let short_oid = f.next()?.trim().to_string();
    let summary = f.next()?.to_string();
    let author_name = f.next()?.to_string();
    let author_email = f.next()?.to_string();
    let author_ts: i64 = f.next()?.trim().parse().unwrap_or(0);
    let committer_name = f.next()?.to_string();
    let committer_email = f.next()?.to_string();
    let committer_ts: i64 = f.next()?.trim().parse().unwrap_or(0);
    let parent_raw = f.next().unwrap_or("").trim_matches('\x1e').trim();
    let parent_oids: Vec<String> = parent_raw
        .split_whitespace()
        .filter(|s| !s.is_empty())
        .map(|s| s.to_string())
        .collect();

    Some(CommitSummary {
        oid,
        short_oid,
        summary,
        author: Signature {
            name: author_name,
            email: author_email,
            when: author_ts,
        },
        committer: Signature {
            name: committer_name,
            email: committer_email,
            when: committer_ts,
        },
        parent_oids,
    })
}

fn parse_log_output(raw: &str) -> Vec<CommitSummary> {
    raw.split('\x1e').filter_map(parse_commit_summary).collect()
}

fn staged_char(c: u8) -> FileStatusKind {
    match c {
        b'M' => FileStatusKind::Modified,
        b'A' => FileStatusKind::Added,
        b'D' => FileStatusKind::Deleted,
        b'R' | b'C' => FileStatusKind::Renamed,
        b'U' => FileStatusKind::Conflicted,
        b'?' => FileStatusKind::Untracked,
        _ => FileStatusKind::Clean,
    }
}

fn unstaged_char(c: u8) -> FileStatusKind {
    match c {
        b'M' => FileStatusKind::Modified,
        b'D' => FileStatusKind::Deleted,
        b'R' | b'C' => FileStatusKind::Renamed,
        b'U' => FileStatusKind::Conflicted,
        b'?' => FileStatusKind::Untracked,
        _ => FileStatusKind::Clean,
    }
}

/// Parse `git status --porcelain=v1 -z` output (NUL-separated entries).
fn parse_status(raw: &str) -> Vec<StatusEntry> {
    let mut entries = Vec::new();
    let parts: Vec<&str> = raw.split('\0').collect();
    let mut i = 0;
    while i < parts.len() {
        let chunk = parts[i];
        if chunk.len() < 3 {
            i += 1;
            continue;
        }
        let x = chunk.as_bytes()[0];
        let y = chunk.as_bytes()[1];
        let path = chunk[3..].to_string();
        let staged = staged_char(x);
        let unstaged = unstaged_char(y);
        // Rename/copy: next NUL-separated token is the original path
        let is_rename = x == b'R' || x == b'C' || y == b'R' || y == b'C';
        let old_path = if is_rename && i + 1 < parts.len() && !parts[i + 1].is_empty() {
            i += 1;
            Some(parts[i].to_string())
        } else {
            None
        };
        entries.push(StatusEntry {
            path,
            old_path,
            staged,
            unstaged,
        });
        i += 1;
    }
    entries
}

/// Parse ahead/behind from `%(upstream:track)` output like `[ahead 3, behind 1]`.
fn parse_ahead_behind(track: &str) -> (Option<usize>, Option<usize>) {
    let mut ahead = None;
    let mut behind = None;
    if let Some(pos) = track.find("ahead ") {
        let rest = &track[pos + 6..];
        let end = rest
            .find(|c: char| !c.is_ascii_digit())
            .unwrap_or(rest.len());
        ahead = rest[..end].parse().ok();
    }
    if let Some(pos) = track.find("behind ") {
        let rest = &track[pos + 7..];
        let end = rest
            .find(|c: char| !c.is_ascii_digit())
            .unwrap_or(rest.len());
        behind = rest[..end].parse().ok();
    }
    (ahead, behind)
}

/// Parse `git diff-tree --name-status` or `git show --name-status` output.
fn parse_name_status(raw: &str) -> Vec<ChangedFileSummary> {
    raw.lines()
        .filter(|l| !l.trim().is_empty())
        .map(|line| {
            let parts: Vec<&str> = line.splitn(3, '\t').collect();
            let code = parts.first().copied().unwrap_or("M");
            let status = code[..1.min(code.len())].to_string();
            if status == "R" || status == "C" {
                ChangedFileSummary {
                    old_path: parts.get(1).map(|s| s.to_string()),
                    new_path: parts.get(2).map(|s| s.to_string()),
                    is_binary: false,
                    status,
                }
            } else {
                ChangedFileSummary {
                    old_path: None,
                    new_path: parts.get(1).map(|s| s.to_string()),
                    is_binary: false,
                    status,
                }
            }
        })
        .collect()
}

// ─── GitRepository implementation ─────────────────────────────────────────────

impl GitRepository for CliGitRepository {
    // ── Repository info ──────────────────────────────────────────────────────

    fn repo_info(&self) -> Result<RepoInfo> {
        let path_str = self.path.to_string_lossy().to_string();
        let name = self
            .path
            .file_name()
            .map(|n| n.to_string_lossy().to_string())
            .unwrap_or_else(|| path_str.clone());
        let head_branch = self
            .run(&["rev-parse", "--abbrev-ref", "HEAD"])
            .ok()
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty() && s != "HEAD");
        let head_oid = self
            .run(&["rev-parse", "HEAD"])
            .ok()
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty());
        Ok(RepoInfo {
            path: path_str,
            name,
            head_branch,
            head_oid,
        })
    }

    // ── Status & staging ─────────────────────────────────────────────────────

    fn get_status(&self) -> Result<Vec<StatusEntry>> {
        let raw = self.run(&["status", "--porcelain=v1", "-z"])?;
        Ok(parse_status(&raw))
    }

    fn list_tracked_files(&self) -> Result<Vec<String>> {
        let raw = self.run(&["ls-files"])?;
        Ok(raw
            .lines()
            .filter(|l| !l.is_empty())
            .map(|l| l.to_string())
            .collect())
    }

    fn stage_file(&self, path: &str) -> Result<()> {
        self.run(&["add", "--", path]).map(|_| ())
    }

    fn stage_paths(&self, paths: &[&str]) -> Result<()> {
        let mut args = vec!["add", "--"];
        args.extend_from_slice(paths);
        self.run(&args).map(|_| ())
    }

    fn write_and_stage_file(&self, path: &str, content: &str) -> Result<()> {
        let full = self.path.join(path);
        std::fs::write(&full, content)
            .map_err(|e| AppError::Other(format!("Écriture fichier : {e}")))?;
        self.stage_file(path)
    }

    fn unstage_file(&self, path: &str) -> Result<()> {
        self.run(&["restore", "--staged", "--", path]).map(|_| ())
    }

    fn unstage_paths(&self, paths: &[&str]) -> Result<()> {
        let mut args = vec!["restore", "--staged", "--"];
        args.extend_from_slice(paths);
        self.run(&args).map(|_| ())
    }

    fn discard_changes(&self, path: &str) -> Result<()> {
        self.run(&["restore", "--", path]).map(|_| ())
    }

    fn discard_all(&self) -> Result<()> {
        self.run(&["checkout", "--", "."]).map(|_| ())?;
        self.run(&["clean", "-fd"]).map(|_| ())
    }

    fn stage_all(&self) -> Result<()> {
        self.run(&["add", "-A"]).map(|_| ())
    }

    fn unstage_all(&self) -> Result<()> {
        self.run(&["restore", "--staged", "."]).map(|_| ())
    }

    fn reset_conflict_file(&self, path: &str) -> Result<()> {
        self.run(&["checkout", "--", path]).map(|_| ())
    }

    fn reset_staged_conflict_file(&self, path: &str) -> Result<()> {
        // CLI backend: not supported (requires complex index manipulation)
        Err(Self::unsupported(&format!(
            "reset_staged_conflict_file({path})"
        )))
    }

    fn reset_all_conflict_files(&self) -> Result<()> {
        self.run(&["checkout", "--", "."]).map(|_| ())
    }

    fn resolve_deletion_accept(&self, path: &str) -> Result<()> {
        self.run(&["rm", "--cached", "--", path]).map(|_| ())
    }

    fn resolve_deletion_restore(&self, path: &str) -> Result<()> {
        self.run(&["checkout", "MERGE_HEAD", "--", path])
            .map(|_| ())
    }

    fn resolve_deletion_accept_theirs(&self, path: &str) -> Result<()> {
        self.run(&["rm", "--", path]).map(|_| ())
    }

    fn resolve_deletion_keep_ours(&self, path: &str) -> Result<()> {
        self.run(&["add", "--", path]).map(|_| ())
    }

    fn stage_hunk(
        &self,
        _path: &str,
        _hunk_index: usize,
        _selected: Option<&[usize]>,
    ) -> Result<()> {
        Err(Self::unsupported("staging de hunk partiel"))
    }

    fn unstage_hunk(
        &self,
        _path: &str,
        _hunk_index: usize,
        _selected: Option<&[usize]>,
    ) -> Result<()> {
        Err(Self::unsupported("unstaging de hunk partiel"))
    }

    // ── Commit ───────────────────────────────────────────────────────────────

    fn create_commit(&self, message: &str) -> Result<CommitSummary> {
        self.run(&["commit", "-m", message])?;
        self.get_head_commit()
    }

    fn amend_commit(&self, message: &str) -> Result<CommitSummary> {
        self.run(&["commit", "--amend", "-m", message])?;
        self.get_head_commit()
    }

    fn get_head_commit(&self) -> Result<CommitSummary> {
        let raw = self.run(&["log", "-1", LOG_FORMAT])?;
        parse_log_output(&raw)
            .into_iter()
            .next()
            .ok_or_else(|| AppError::Other("Aucun commit trouvé".into()))
    }

    // ── History ──────────────────────────────────────────────────────────────

    fn get_log(
        &self,
        limit: usize,
        offset: usize,
        branch: Option<&str>,
        filters: Option<&LogFilters>,
    ) -> Result<Vec<CommitSummary>> {
        let limit_str = limit.to_string();
        let mut extra: Vec<String> = Vec::new();

        if offset > 0 {
            extra.push(format!("--skip={offset}"));
        }
        if let Some(f) = filters {
            if let Some(s) = &f.search {
                extra.push(format!("--grep={s}"));
                extra.push("--regexp-ignore-case".into());
            }
            if let Some(ts) = f.since {
                extra.push(format!("--after={ts}"));
            }
            if let Some(ts) = f.until {
                extra.push(format!("--before={ts}"));
            }
        }
        if let Some(b) = branch {
            extra.push(b.to_string());
        }
        if let Some(f) = filters {
            if let Some(p) = &f.path {
                extra.push("--".into());
                extra.push(p.clone());
            }
        }

        let mut args: Vec<&str> = vec!["log", LOG_FORMAT, "-n", &limit_str];
        for s in &extra {
            args.push(s);
        }
        let raw = self.run(&args)?;
        Ok(parse_log_output(&raw))
    }

    fn get_graph_log(&self, limit: usize, _show_all: bool) -> Result<Vec<CommitSummary>> {
        // parent_oids are included so the frontend can reconstruct topology
        self.get_log(limit, 0, None, None)
    }

    fn get_commit_detail(&self, oid: &str) -> Result<CommitDetail> {
        let meta_raw = self.run(&["log", "-1", LOG_FORMAT, oid])?;
        let summary = parse_log_output(&meta_raw)
            .into_iter()
            .next()
            .ok_or_else(|| AppError::Other(format!("Commit introuvable : {oid}")))?;

        let body_raw = self.run(&["log", "-1", "--format=%b", oid])?;
        let body = if body_raw.trim().is_empty() {
            None
        } else {
            Some(body_raw.trim().to_string())
        };

        // --root handles initial commits (no parents)
        let files_raw = self.run(&[
            "diff-tree",
            "--root",
            "--no-commit-id",
            "-r",
            "--name-status",
            oid,
        ])?;
        let changed_files = parse_name_status(&files_raw);

        Ok(CommitDetail {
            oid: summary.oid,
            short_oid: summary.short_oid,
            summary: summary.summary,
            body,
            author: summary.author,
            committer: summary.committer,
            parent_oids: summary.parent_oids,
            changed_files,
            is_signed: false, // CLI backend does not inspect GPG headers
        })
    }

    fn reset_to_commit(&self, oid: &str, mode: &str) -> Result<()> {
        let flag = match mode {
            "soft" => "--soft",
            "hard" => "--hard",
            _ => "--mixed",
        };
        self.run(&["reset", flag, oid]).map(|_| ())
    }

    fn revert_commit(&self, oid: &str) -> Result<CommitSummary> {
        self.run(&["revert", "--no-edit", oid])?;
        self.get_head_commit()
    }

    // ── Branches ─────────────────────────────────────────────────────────────

    fn list_branches(&self, _filter: Option<&str>) -> Result<Vec<BranchInfo>> {
        // Tab-separated: refname, refname:short, objectname:short, upstream:short, upstream:track, HEAD
        let fmt = "%(refname)\t%(refname:short)\t%(objectname:short)\t%(upstream:short)\t%(upstream:track)\t%(HEAD)";
        let raw = self.run(&[
            "for-each-ref",
            "--format",
            fmt,
            "refs/heads",
            "refs/remotes",
        ])?;

        let current = self
            .run(&["rev-parse", "--abbrev-ref", "HEAD"])
            .ok()
            .map(|s| s.trim().to_string())
            .unwrap_or_default();

        let mut branches = Vec::new();
        for line in raw.lines().filter(|l| !l.trim().is_empty()) {
            let parts: Vec<&str> = line.splitn(6, '\t').collect();
            if parts.len() < 6 {
                continue;
            }
            let refname = parts[0];
            let name = parts[1].to_string();
            let head_oid = if parts[2].is_empty() {
                None
            } else {
                Some(parts[2].to_string())
            };
            let upstream = if parts[3].is_empty() {
                None
            } else {
                Some(parts[3].to_string())
            };
            let (ahead, behind) = parse_ahead_behind(parts[4]);
            let is_remote = refname.starts_with("refs/remotes/");
            let is_head = !is_remote && name == current;
            branches.push(BranchInfo {
                name,
                is_remote,
                is_head,
                upstream,
                ahead,
                behind,
                head_oid,
            });
        }
        Ok(branches)
    }

    fn create_branch(&self, name: &str, from_ref: &str) -> Result<BranchInfo> {
        self.run(&["branch", name, from_ref])?;
        self.list_branches(None)?
            .into_iter()
            .find(|b| b.name == name)
            .ok_or_else(|| AppError::Other(format!("Branche '{name}' introuvable après création")))
    }

    fn checkout_branch(&self, name: &str) -> Result<()> {
        self.run(&["switch", name]).map(|_| ())
    }

    fn delete_branch(&self, name: &str, force: bool) -> Result<()> {
        let flag = if force { "-D" } else { "-d" };
        self.run(&["branch", flag, name]).map(|_| ())
    }

    fn rename_branch(&self, old_name: &str, new_name: &str) -> Result<BranchInfo> {
        self.run(&["branch", "-m", old_name, new_name])?;
        self.list_branches(None)?
            .into_iter()
            .find(|b| b.name == new_name)
            .ok_or_else(|| {
                AppError::Other(format!("Branche '{new_name}' introuvable après renommage"))
            })
    }

    fn checkout_remote_branch(&self, remote_branch_name: &str) -> Result<BranchInfo> {
        // "origin/feature/x" → local name "feature/x"
        let local_name = remote_branch_name
            .split_once('/')
            .map(|(_, b)| b)
            .unwrap_or(remote_branch_name);
        self.run(&["switch", "-c", local_name, "--track", remote_branch_name])?;
        self.list_branches(None)?
            .into_iter()
            .find(|b| b.name == local_name)
            .ok_or_else(|| AppError::Other("Branche locale introuvable après checkout".into()))
    }

    fn set_branch_upstream(&self, branch_name: &str, upstream: &str) -> Result<BranchInfo> {
        self.run(&[
            "branch",
            &format!("--set-upstream-to={upstream}"),
            branch_name,
        ])?;
        self.list_branches(None)?
            .into_iter()
            .find(|b| b.name == branch_name)
            .ok_or_else(|| {
                AppError::Other(format!(
                    "Branche '{branch_name}' introuvable après set-upstream"
                ))
            })
    }

    fn unset_branch_upstream(&self, branch_name: &str) -> Result<BranchInfo> {
        self.run(&["branch", "--unset-upstream", branch_name])?;
        self.list_branches(None)?
            .into_iter()
            .find(|b| b.name == branch_name)
            .ok_or_else(|| {
                AppError::Other(format!(
                    "Branche '{branch_name}' introuvable après unset-upstream"
                ))
            })
    }

    // ── Remotes ──────────────────────────────────────────────────────────────

    fn list_remotes(&self) -> Result<Vec<RemoteInfo>> {
        let raw = self.run(&["remote", "-v"])?;
        // Each line: "name\turl (fetch|push)"
        let mut map: std::collections::BTreeMap<String, (String, Option<String>)> =
            std::collections::BTreeMap::new();
        for line in raw.lines() {
            let Some((name_part, rest)) = line.split_once('\t') else {
                continue;
            };
            let name = name_part.trim().to_string();
            let url_part = rest.trim();
            if let Some(url) = url_part.strip_suffix(" (fetch)") {
                let e = map.entry(name).or_insert_with(|| (url.to_string(), None));
                e.0 = url.to_string();
            } else if let Some(push_url) = url_part.strip_suffix(" (push)") {
                let e = map
                    .entry(name)
                    .or_insert_with(|| (push_url.to_string(), None));
                if e.0 != push_url {
                    e.1 = Some(push_url.to_string());
                }
            }
        }
        Ok(map
            .into_iter()
            .map(|(name, (url, push_url))| RemoteInfo {
                name,
                url,
                push_url,
            })
            .collect())
    }

    fn add_remote(&self, name: &str, url: &str) -> Result<RemoteInfo> {
        self.run(&["remote", "add", name, url])?;
        Ok(RemoteInfo {
            name: name.to_string(),
            url: url.to_string(),
            push_url: None,
        })
    }

    fn remove_remote(&self, name: &str) -> Result<()> {
        self.run(&["remote", "remove", name]).map(|_| ())
    }

    fn fetch_remote(&self, remote_name: &str) -> Result<()> {
        self.run(&["fetch", remote_name]).map(|_| ())
    }

    fn fetch_all_remotes(&self) -> Vec<RemoteFetchResult> {
        let remote_names = match self.list_remotes() {
            Ok(remotes) => remotes.into_iter().map(|r| r.name).collect::<Vec<_>>(),
            Err(e) => {
                return vec![RemoteFetchResult {
                    remote: "*".into(),
                    ok: false,
                    error: Some(e.to_string()),
                }]
            }
        };
        remote_names
            .into_iter()
            .map(|name| match self.fetch_remote(&name) {
                Ok(()) => RemoteFetchResult {
                    remote: name,
                    ok: true,
                    error: None,
                },
                Err(e) => RemoteFetchResult {
                    remote: name,
                    ok: false,
                    error: Some(e.to_string()),
                },
            })
            .collect()
    }

    fn push_remote(&self, remote_name: &str, branch: &str) -> Result<()> {
        self.run(&["push", remote_name, branch]).map(|_| ())
    }

    fn push_force_with_lease(&self, remote_name: &str, branch: &str) -> Result<()> {
        crate::git::force_push::push_force_with_lease(&self.path, remote_name, branch)
    }

    fn pull_remote(&self, remote_name: &str, branch: &str) -> Result<()> {
        self.run(&["pull", remote_name, branch]).map(|_| ())
    }

    fn prune_remote(&self, remote_name: &str) -> Result<()> {
        self.run(&["remote", "prune", remote_name]).map(|_| ())
    }

    // ── Config ───────────────────────────────────────────────────────────────

    fn get_git_config(&self, key: &str, global: bool) -> Result<Option<String>> {
        let mut args = vec!["config"];
        if global {
            args.push("--global");
        }
        args.extend(["--get", key]);
        match self.run(&args) {
            Ok(val) => Ok(Some(val.trim().to_string())),
            Err(_) => Ok(None), // exit 1 = key not found
        }
    }

    fn set_git_config(&self, key: &str, value: &str, global: bool) -> Result<()> {
        let mut args = vec!["config"];
        if global {
            args.push("--global");
        }
        args.extend([key, value]);
        self.run(&args).map(|_| ())
    }

    // ── Unsupported ──────────────────────────────────────────────────────────

    fn get_reflog(&self, _refname: &str) -> Result<Vec<ReflogEntry>> {
        Err(Self::unsupported("reflog"))
    }

    fn get_blame(&self, _path: &str, _commit_oid: Option<&str>) -> Result<Vec<BlameLine>> {
        Err(Self::unsupported("blame"))
    }

    fn get_file_diff(
        &self,
        _path: &str,
        _staged: bool,
        _ignore_whitespace: bool,
    ) -> Result<FileDiff> {
        Err(Self::unsupported("diff de fichier"))
    }

    fn get_commit_diff(&self, _oid: &str, _ignore_whitespace: bool) -> Result<Vec<FileDiff>> {
        Err(Self::unsupported("diff de commit"))
    }

    fn get_commit_file_diff(
        &self,
        _commit_oid: &str,
        _path: &str,
        _ignore_whitespace: bool,
    ) -> Result<FileDiff> {
        Err(Self::unsupported("diff de fichier de commit"))
    }

    fn merge_branch(&self, _branch_name: &str, _no_ff: bool) -> Result<MergeStatus> {
        Err(Self::unsupported("merge"))
    }

    fn abort_merge(&self) -> Result<()> {
        Err(Self::unsupported("abort merge"))
    }

    fn get_repository_state(&self) -> Result<String> {
        // Resolve the actual .git directory (handles worktrees and submodules
        // where .git is a file pointing to the real git dir).
        let git_dir_raw = self.run(&["rev-parse", "--git-dir"])?;
        let git_dir_rel = git_dir_raw.trim();
        let git_dir = if std::path::Path::new(git_dir_rel).is_absolute() {
            std::path::PathBuf::from(git_dir_rel)
        } else {
            self.path.join(git_dir_rel)
        };

        // Priority order aligned with libgit2 Repository::state():
        // rebase > cherry_pick > merge > clean.
        // When both rebase-merge/ and MERGE_HEAD exist (mid rebase-merge),
        // rebase wins — matching git2_impl::get_repository_state().
        if git_dir.join("rebase-merge").is_dir() || git_dir.join("rebase-apply").is_dir() {
            return Ok("rebase".to_string());
        }
        if git_dir.join("CHERRY_PICK_HEAD").exists() {
            return Ok("cherry_pick".to_string());
        }
        if git_dir.join("MERGE_HEAD").exists() {
            return Ok("merge".to_string());
        }
        Ok("clean".to_string())
    }

    fn cherry_pick(&self, _oid: &str) -> Result<CherryPickStatus> {
        Err(Self::unsupported("cherry-pick"))
    }

    fn continue_cherry_pick(&self) -> Result<CommitSummary> {
        Err(Self::unsupported("continue cherry-pick"))
    }

    fn abort_cherry_pick(&self) -> Result<()> {
        Err(Self::unsupported("abort cherry-pick"))
    }

    fn rebase_branch(&self, _onto_branch: &str) -> Result<RebaseStatus> {
        Err(Self::unsupported("rebase"))
    }

    fn continue_rebase(&self) -> Result<RebaseStatus> {
        Err(Self::unsupported("continue rebase"))
    }

    fn abort_rebase(&self) -> Result<()> {
        Err(Self::unsupported("abort rebase"))
    }

    fn get_interactive_rebase_commits(
        &self,
        _upstream_oid: &str,
    ) -> Result<Vec<crate::git::types::RebaseEntry>> {
        Err(Self::unsupported("rebase interactif"))
    }

    fn apply_interactive_rebase(
        &self,
        _upstream_oid: &str,
        _steps: Vec<crate::git::types::RebaseStep>,
    ) -> Result<RebaseStatus> {
        Err(Self::unsupported("rebase interactif"))
    }

    fn list_tags(&self) -> Result<Vec<TagInfo>> {
        Err(Self::unsupported("tags"))
    }

    fn create_tag(
        &self,
        _name: &str,
        _target_oid: &str,
        _message: Option<&str>,
    ) -> Result<TagInfo> {
        Err(Self::unsupported("création de tag"))
    }

    fn delete_tag(&self, _name: &str) -> Result<()> {
        Err(Self::unsupported("suppression de tag"))
    }

    fn push_tag(&self, _remote_name: &str, _tag_name: &str) -> Result<()> {
        Err(Self::unsupported("push de tag"))
    }

    fn delete_remote_tag(&self, _remote_name: &str, _tag_name: &str) -> Result<()> {
        Err(Self::unsupported("suppression de tag distant"))
    }

    fn list_remote_tags(&self, _remote_name: &str) -> Result<Vec<String>> {
        Err(Self::unsupported("listing tags distants"))
    }

    fn stash_save(
        &self,
        _message: Option<&str>,
        _include_untracked: bool,
        _keep_index: bool,
    ) -> Result<String> {
        Err(Self::unsupported("stash"))
    }

    fn stash_list(&self) -> Result<Vec<StashEntry>> {
        Err(Self::unsupported("liste de stash"))
    }

    fn stash_apply(&self, _index: usize) -> Result<()> {
        Err(Self::unsupported("stash apply"))
    }

    fn stash_pop(&self, _index: usize) -> Result<()> {
        Err(Self::unsupported("stash pop"))
    }

    fn stash_drop(&self, _index: usize) -> Result<()> {
        Err(Self::unsupported("stash drop"))
    }

    fn get_gitflow_config(&self) -> Option<GitFlowConfig> {
        None
    }

    fn init_gitflow(&self, _config: &GitFlowConfig) -> Result<()> {
        Err(Self::unsupported("git-flow"))
    }

    fn start_gitflow_branch(&self, _kind: &str, _name: &str) -> Result<BranchInfo> {
        Err(Self::unsupported("git-flow"))
    }

    fn finish_gitflow_branch(&self, _kind: &str, _name: &str) -> Result<()> {
        Err(Self::unsupported("git-flow"))
    }

    fn list_submodules(&self) -> Result<Vec<SubmoduleInfo>> {
        Err(Self::unsupported("sous-modules"))
    }

    fn init_submodule(&self, _name: &str) -> Result<()> {
        Err(Self::unsupported("sous-modules"))
    }

    fn update_submodule(&self, _name: &str) -> Result<()> {
        Err(Self::unsupported("sous-modules"))
    }

    fn update_all_submodules(&self) -> Result<()> {
        Err(Self::unsupported("sous-modules"))
    }

    fn add_submodule(&self, _url: &str, _path: &str) -> Result<()> {
        Err(Self::unsupported("sous-modules"))
    }
}
