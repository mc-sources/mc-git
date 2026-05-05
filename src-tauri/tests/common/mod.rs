use std::path::PathBuf;
use tempfile::TempDir;
use mcgit_lib::infrastructure::git2_impl::Git2Repository;
use mcgit_lib::infrastructure::cli_impl::CliGitRepository;

/// Ephemeral git repository for integration tests.
pub struct TestRepo {
    _tmp: TempDir,
    _bare_tmp: Option<TempDir>,
    pub path: PathBuf,
}

impl TestRepo {
    /// Create a new empty git repo with user.name/email configured.
    pub fn new() -> Self {
        let tmp = tempfile::tempdir().expect("failed to create tempdir");
        let path = tmp.path().to_owned();

        let repo = git2::Repository::init(&path).expect("failed to init repo");
        {
            let mut config = repo.config().expect("failed to open config");
            config.set_str("user.name", "mcgit test").expect("set user.name");
            config.set_str("user.email", "test@mcgit.local").expect("set user.email");
        }
        drop(repo);

        Self { _tmp: tmp, _bare_tmp: None, path }
    }

    /// Write a file in the worktree.
    pub fn write_file(&self, name: &str, content: &str) {
        let file_path = self.path.join(name);
        if let Some(parent) = file_path.parent() {
            std::fs::create_dir_all(parent).expect("create parent dirs");
        }
        std::fs::write(&file_path, content).expect("write file");
    }

    /// Read a file from the worktree.
    pub fn read_file(&self, name: &str) -> String {
        std::fs::read_to_string(self.path.join(name)).expect("read file")
    }

    /// Create a bare repo in an isolated tempdir to use as a local remote.
    pub fn create_local_remote(&mut self) -> PathBuf {
        let bare_tmp = tempfile::tempdir().expect("failed to create bare tempdir");
        let bare_path = bare_tmp.path().join("remote.git");
        git2::Repository::init_bare(&bare_path).expect("failed to init bare repo");
        self._bare_tmp = Some(bare_tmp);
        bare_path
    }

    /// Open as Git2Repository.
    pub fn open_git2(&self) -> Git2Repository {
        Git2Repository::open(self.path.to_str().unwrap()).expect("open Git2Repository")
    }

    /// Open as CliGitRepository. Panics if git is not available.
    pub fn open_cli(&self) -> CliGitRepository {
        CliGitRepository::open(self.path.to_str().unwrap()).expect("open CliGitRepository")
    }
}

/// Skip the calling test if `git` binary is not available.
macro_rules! skip_if_no_git {
    () => {
        if !mcgit_lib::git::git_available() {
            eprintln!("git binary not available – skipping CLI integration test");
            return;
        }
    };
}
pub(crate) use skip_if_no_git;

pub mod scenarios;
