use git2::{ObjectType, Repository};

use crate::error::Result;
use crate::git::credentials::{build_callbacks, remap_cert_error};
use crate::git::types::{Signature, TagInfo};

pub fn list_tags(repo: &Repository) -> Result<Vec<TagInfo>> {
    let mut tags: Vec<TagInfo> = Vec::new();

    repo.tag_foreach(|oid, name_bytes| {
        let name = String::from_utf8_lossy(name_bytes)
            .trim_start_matches("refs/tags/")
            .to_string();

        let Ok(obj) = repo.find_object(oid, None) else {
            return true;
        };

        if obj.kind() == Some(ObjectType::Tag) {
            // Annotated tag
            if let Ok(tag) = obj.into_tag() {
                let target_oid = tag.target_id().to_string();
                let message = tag.message().map(|m| m.trim_end().to_string());
                let tagger = tag.tagger().map(|s| Signature {
                    name: s.name().unwrap_or("").to_string(),
                    email: s.email().unwrap_or("").to_string(),
                    when: s.when().seconds(),
                });
                tags.push(TagInfo {
                    name,
                    target_oid,
                    is_annotated: true,
                    message,
                    tagger,
                });
            }
        } else {
            // Lightweight tag — peel to commit for the real OID
            let target_oid = obj
                .peel_to_commit()
                .map(|c| c.id().to_string())
                .unwrap_or_else(|_| oid.to_string());
            tags.push(TagInfo {
                name,
                target_oid,
                is_annotated: false,
                message: None,
                tagger: None,
            });
        }

        true
    })?;

    tags.sort_by(|a, b| a.name.cmp(&b.name));
    Ok(tags)
}

pub fn create_tag(
    repo: &Repository,
    name: &str,
    target_oid: &str,
    message: Option<&str>,
) -> Result<TagInfo> {
    let oid = git2::Oid::from_str(target_oid)?;
    let obj = repo.find_object(oid, None)?;

    if let Some(msg) = message {
        let sig = repo.signature()?;
        repo.tag(name, &obj, &sig, msg, false)?;
    } else {
        repo.tag_lightweight(name, &obj, false)?;
    }

    // Return the created tag info
    let tags = list_tags(repo)?;
    tags.into_iter().find(|t| t.name == name).ok_or_else(|| {
        crate::error::AppError::Other(format!("Tag '{name}' not found after creation"))
    })
}

pub fn delete_tag(repo: &Repository, name: &str) -> Result<()> {
    repo.tag_delete(name)?;
    Ok(())
}

pub fn push_tag(repo: &Repository, remote_name: &str, tag_name: &str) -> Result<()> {
    let mut remote = repo.find_remote(remote_name)?;
    let (callbacks, cert_err) = build_callbacks();
    let mut push_opts = git2::PushOptions::new();
    push_opts.remote_callbacks(callbacks);
    let refspec = format!("refs/tags/{tag_name}:refs/tags/{tag_name}");
    remote
        .push(&[refspec.as_str()], Some(&mut push_opts))
        .map_err(|e| remap_cert_error(e, &cert_err))?;
    Ok(())
}

pub fn delete_remote_tag(repo: &Repository, remote_name: &str, tag_name: &str) -> Result<()> {
    let mut remote = repo.find_remote(remote_name)?;
    let (callbacks, cert_err) = build_callbacks();
    let mut push_opts = git2::PushOptions::new();
    push_opts.remote_callbacks(callbacks);
    let refspec = format!(":refs/tags/{tag_name}");
    remote
        .push(&[refspec.as_str()], Some(&mut push_opts))
        .map_err(|e| remap_cert_error(e, &cert_err))?;
    Ok(())
}

/// Lists tags advertised by a remote (`git ls-remote --tags <remote>` equivalent).
///
/// Strips the `refs/tags/` prefix and filters out peeled refs (`^{}` suffix)
/// that libgit2 advertises for annotated tags — only the canonical name is kept.
/// The result is sorted and deduplicated.
pub fn list_remote_tags(repo: &Repository, remote_name: &str) -> Result<Vec<String>> {
    let mut remote = repo.find_remote(remote_name)?;
    let (callbacks, cert_err) = build_callbacks();
    remote
        .connect_auth(git2::Direction::Fetch, Some(callbacks), None)
        .map_err(|e| remap_cert_error(e, &cert_err))?;

    let mut tags: Vec<String> = remote
        .list()?
        .iter()
        .filter_map(|head| {
            let name = head.name();
            if name.starts_with("refs/tags/") && !name.ends_with("^{}") {
                Some(name.trim_start_matches("refs/tags/").to_string())
            } else {
                None
            }
        })
        .collect();

    remote.disconnect()?;

    tags.sort();
    tags.dedup();
    Ok(tags)
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    fn setup_repo_with_commit() -> (TempDir, git2::Repository) {
        let tmp = tempfile::tempdir().unwrap();
        let repo = git2::Repository::init(tmp.path()).unwrap();
        let mut config = repo.config().unwrap();
        config.set_str("user.name", "mcgit test").unwrap();
        config.set_str("user.email", "test@mcgit.local").unwrap();
        drop(config);
        let workdir = repo.workdir().unwrap().to_owned();
        std::fs::write(workdir.join("README.md"), "init").unwrap();
        {
            let mut index = repo.index().unwrap();
            index.add_path(std::path::Path::new("README.md")).unwrap();
            index.write().unwrap();
            let tree_oid = index.write_tree().unwrap();
            let tree = repo.find_tree(tree_oid).unwrap();
            let sig = repo.signature().unwrap();
            repo.commit(Some("HEAD"), &sig, &sig, "init", &tree, &[])
                .unwrap();
        }
        (tmp, repo)
    }

    fn setup_remote_repo_with_tags(annotated: &[&str], lightweight: &[&str]) -> TempDir {
        let (tmp, repo) = setup_repo_with_commit();
        let head_oid = repo.head().unwrap().target().unwrap();
        let head_obj = repo.find_object(head_oid, None).unwrap();
        let sig = repo.signature().unwrap();
        for name in annotated {
            repo.tag(name, &head_obj, &sig, &format!("annotated {name}"), false)
                .unwrap();
        }
        for name in lightweight {
            repo.tag_lightweight(name, &head_obj, false).unwrap();
        }
        tmp
    }

    fn file_url(tmp: &TempDir) -> String {
        format!("file://{}", tmp.path().display())
    }

    #[test]
    fn list_remote_tags_returns_remote_tags() {
        let remote_tmp = setup_remote_repo_with_tags(&["v0.1.0", "v0.2.0"], &["v1.0.0-rc1"]);
        let (_local_tmp, local_repo) = setup_repo_with_commit();
        local_repo.remote("origin", &file_url(&remote_tmp)).unwrap();

        let tags = list_remote_tags(&local_repo, "origin").unwrap();

        assert_eq!(tags.len(), 3, "expected 3 tags, got {tags:?}");
        assert!(tags.contains(&"v0.1.0".to_string()));
        assert!(tags.contains(&"v0.2.0".to_string()));
        assert!(tags.contains(&"v1.0.0-rc1".to_string()));
    }

    #[test]
    fn list_remote_tags_empty_when_no_tags() {
        let (remote_tmp, _) = setup_repo_with_commit();
        let (_local_tmp, local_repo) = setup_repo_with_commit();
        local_repo.remote("origin", &file_url(&remote_tmp)).unwrap();

        let tags = list_remote_tags(&local_repo, "origin").unwrap();

        assert!(tags.is_empty(), "expected no tags, got {tags:?}");
    }

    #[test]
    fn list_remote_tags_fails_for_unknown_remote() {
        let (_local_tmp, local_repo) = setup_repo_with_commit();
        let result = list_remote_tags(&local_repo, "non_existent_remote");
        assert!(result.is_err(), "expected error for unknown remote");
    }

    #[test]
    fn list_remote_tags_strips_peeled_suffix_for_annotated() {
        // Annotated tags are advertised with both refs/tags/X and refs/tags/X^{}
        // by libgit2's Remote::list. The function must keep only the canonical name.
        let remote_tmp = setup_remote_repo_with_tags(&["v1.0.0"], &[]);
        let (_local_tmp, local_repo) = setup_repo_with_commit();
        local_repo.remote("origin", &file_url(&remote_tmp)).unwrap();

        let tags = list_remote_tags(&local_repo, "origin").unwrap();

        assert_eq!(tags, vec!["v1.0.0".to_string()]);
        assert!(!tags.iter().any(|t| t.contains("^{}")));
    }

    #[test]
    fn list_remote_tags_returns_sorted_unique() {
        let remote_tmp = setup_remote_repo_with_tags(&["v0.3.0", "v0.1.0", "v0.2.0"], &[]);
        let (_local_tmp, local_repo) = setup_repo_with_commit();
        local_repo.remote("origin", &file_url(&remote_tmp)).unwrap();

        let tags = list_remote_tags(&local_repo, "origin").unwrap();

        assert_eq!(
            tags,
            vec!["v0.1.0".to_string(), "v0.2.0".to_string(), "v0.3.0".to_string()]
        );
    }
}
