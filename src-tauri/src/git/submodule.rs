use git2::{Repository, SubmoduleIgnore};

use crate::error::Result;
use crate::git::credentials::{build_callbacks, remap_cert_error};
use crate::git::types::{SubmoduleInfo, SubmoduleStatus};

pub fn list_submodules(repo: &Repository) -> Result<Vec<SubmoduleInfo>> {
    let submodules = repo.submodules()?;
    let mut result = Vec::new();

    for sub in &submodules {
        let name = sub.name().unwrap_or("").to_string();
        let path = sub.path().to_string_lossy().to_string();
        let url = sub.url().map(|u| u.to_string());
        let head_oid = sub.head_id().map(|oid| oid.to_string());

        let status = match repo.submodule_status(&name, SubmoduleIgnore::None) {
            Ok(s) => {
                if s.is_wd_uninitialized() || !s.is_in_wd() {
                    SubmoduleStatus::Uninitialized
                } else if s.is_index_modified() || s.is_wd_modified() || s.is_wd_wd_modified() {
                    SubmoduleStatus::Modified
                } else {
                    SubmoduleStatus::UpToDate
                }
            }
            Err(_) => SubmoduleStatus::Uninitialized,
        };

        result.push(SubmoduleInfo { name, path, url, head_oid, status });
    }

    Ok(result)
}

pub fn init_submodule(repo: &Repository, name: &str) -> Result<()> {
    let mut sub = repo.find_submodule(name)?;
    sub.init(false)?;
    sub.update(true, None)?;
    Ok(())
}

pub fn update_submodule(repo: &Repository, name: &str) -> Result<()> {
    let mut sub = repo.find_submodule(name)?;
    sub.update(true, None)?;
    Ok(())
}

pub fn update_all_submodules(repo: &Repository) -> Result<()> {
    let submodules = repo.submodules()?;
    for mut sub in submodules {
        sub.update(true, None)?;
    }
    Ok(())
}

pub fn add_submodule(repo: &Repository, url: &str, path: &str) -> Result<()> {
    let mut sub = repo.submodule(url, std::path::Path::new(path), false)?;
    let (callbacks, cert_err) = build_callbacks();
    let mut fetch_opts = git2::FetchOptions::new();
    fetch_opts.remote_callbacks(callbacks);
    let mut opts = git2::SubmoduleUpdateOptions::new();
    opts.fetch(fetch_opts);
    sub.clone(Some(&mut opts))
        .map_err(|e| remap_cert_error(e, &cert_err))?;
    sub.add_finalize()?;
    Ok(())
}
