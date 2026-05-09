use git2::{ObjectType, Repository};

use crate::error::{AppError, Result};
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

/// Retourne l'OID du commit ciblé par `refs/tags/{tag_name}` côté remote, ou
/// `None` si le tag n'existe pas. Stratégie hybride :
/// - URL `file://` : ouverture directe du repo bare et lecture de la ref ;
/// - autres protocoles : `Remote::connect_auth + list` avec priorité au peeled
///   ref `refs/tags/X^{}` (commit cible des annotated tags) puis fallback sur
///   `refs/tags/X` (cas lightweight).
fn remote_tag_commit_oid(
    repo: &Repository,
    remote_name: &str,
    tag_name: &str,
) -> Result<Option<String>> {
    let url = repo
        .find_remote(remote_name)?
        .url()
        .map(|s| s.to_string())
        .unwrap_or_default();

    if let Some(path) = url.strip_prefix("file://") {
        return Ok(match git2::Repository::open(path) {
            Ok(remote_repo) => match remote_repo.find_reference(&format!("refs/tags/{tag_name}")) {
                Ok(r) => r.peel_to_commit().ok().map(|c| c.id().to_string()),
                Err(_) => None,
            },
            Err(_) => None,
        });
    }

    let mut probe_remote = repo.find_remote(remote_name)?;
    let (probe_callbacks, probe_cert_err) = build_callbacks();
    probe_remote
        .connect_auth(git2::Direction::Fetch, Some(probe_callbacks), None)
        .map_err(|e| remap_cert_error(e, &probe_cert_err))?;

    let direct_ref = format!("refs/tags/{tag_name}");
    let peeled_ref = format!("refs/tags/{tag_name}^{{}}");
    let mut remote_oid_direct: Option<String> = None;
    let mut remote_oid_peeled: Option<String> = None;
    for head in probe_remote.list()?.iter() {
        let n = head.name();
        if n == direct_ref {
            remote_oid_direct = Some(head.oid().to_string());
        } else if n == peeled_ref {
            remote_oid_peeled = Some(head.oid().to_string());
        }
    }
    probe_remote.disconnect()?;

    Ok(remote_oid_peeled.or(remote_oid_direct))
}

/// Pousse un tag local vers un remote.
///
/// Si `force = false`, un pré-check via `Remote::list()` détecte si le tag
/// existe déjà côté remote avec un OID de commit différent, auquel cas la
/// fonction retourne `AppError::TagRemoteDivergent` sans tenter le push.
/// Cette détection structurée évite de devoir parser un message d'erreur git
/// fragile pour donner un retour utile à l'UI (dialog force-push).
///
/// Si `force = true`, le pré-check est skippé et le push est fait avec un
/// refspec préfixé `+` (overwrite remote ref). C'est l'utilisateur qui assume,
/// après avoir confirmé via le dialog UI dédié.
pub fn push_tag(repo: &Repository, remote_name: &str, tag_name: &str, force: bool) -> Result<()> {
    if !force {
        // Pré-check de divergence : on compare le commit ciblé localement et
        // distantement. Si le remote est `file://`, on inspecte le bare repo
        // directement (rapide, pas de re-négociation réseau, et contourne un
        // crash UB de libgit2 0.19 lors de connect_auth+list répétés sur file://
        // dans un même process). Pour les autres protocoles (https/ssh), on
        // utilise Remote::list, qui pour les annotated tags advertise à la fois
        // refs/tags/X et refs/tags/X^{} (le peeled commit OID, prioritaire).
        let local_ref_name = format!("refs/tags/{tag_name}");
        let local_commit_oid = repo
            .find_reference(&local_ref_name)?
            .peel_to_commit()?
            .id()
            .to_string();

        let remote_commit_oid = remote_tag_commit_oid(repo, remote_name, tag_name)?;
        if let Some(remote_oid) = remote_commit_oid {
            if remote_oid != local_commit_oid {
                return Err(AppError::TagRemoteDivergent {
                    remote: remote_name.to_string(),
                    tag: tag_name.to_string(),
                    remote_oid,
                    local_oid: local_commit_oid,
                });
            }
        }
    }

    let mut remote = repo.find_remote(remote_name)?;
    let (callbacks, cert_err) = build_callbacks();
    let mut push_opts = git2::PushOptions::new();
    push_opts.remote_callbacks(callbacks);
    let refspec = if force {
        format!("+refs/tags/{tag_name}:refs/tags/{tag_name}")
    } else {
        format!("refs/tags/{tag_name}:refs/tags/{tag_name}")
    };
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
            vec![
                "v0.1.0".to_string(),
                "v0.2.0".to_string(),
                "v0.3.0".to_string()
            ]
        );
    }

    /// Setup helper for push_tag tests: bare remote + local repo with a commit
    /// and the requested annotated tags configured to point to HEAD.
    fn setup_local_with_bare_remote(
        annotated_tags: &[&str],
    ) -> (TempDir, TempDir, git2::Repository) {
        let bare_tmp = tempfile::tempdir().unwrap();
        let bare_path = bare_tmp.path().join("remote.git");
        git2::Repository::init_bare(&bare_path).unwrap();

        let (local_tmp, local_repo) = setup_repo_with_commit();
        {
            let head_oid = local_repo.head().unwrap().target().unwrap();
            let head_obj = local_repo.find_object(head_oid, None).unwrap();
            let sig = local_repo.signature().unwrap();
            for name in annotated_tags {
                local_repo
                    .tag(name, &head_obj, &sig, &format!("annotated {name}"), false)
                    .unwrap();
            }
        }

        local_repo
            .remote("origin", &format!("file://{}", bare_path.display()))
            .unwrap();

        (local_tmp, bare_tmp, local_repo)
    }

    /// Move a tag locally to a brand-new commit, returning the new commit OID.
    fn move_tag_to_new_commit(repo: &git2::Repository, tag_name: &str) -> git2::Oid {
        let workdir = repo.workdir().unwrap().to_owned();
        std::fs::write(workdir.join("README.md"), "second commit").unwrap();
        let mut index = repo.index().unwrap();
        index.add_path(std::path::Path::new("README.md")).unwrap();
        index.write().unwrap();
        let tree_oid = index.write_tree().unwrap();
        let tree = repo.find_tree(tree_oid).unwrap();
        let parent = repo.head().unwrap().peel_to_commit().unwrap();
        let sig = repo.signature().unwrap();
        let new_oid = repo
            .commit(Some("HEAD"), &sig, &sig, "second", &tree, &[&parent])
            .unwrap();
        let new_obj = repo.find_object(new_oid, None).unwrap();
        repo.tag_delete(tag_name).unwrap();
        repo.tag(tag_name, &new_obj, &sig, "moved", false).unwrap();
        new_oid
    }

    #[test]
    fn push_tag_succeeds_when_tag_absent_remote() {
        let (_local_tmp, _bare_tmp, local_repo) = setup_local_with_bare_remote(&["v1.0.0"]);
        push_tag(&local_repo, "origin", "v1.0.0", false).unwrap();

        let tags = list_remote_tags(&local_repo, "origin").unwrap();
        assert!(tags.contains(&"v1.0.0".to_string()));
    }

    #[test]
    fn push_tag_idempotent_when_remote_oid_matches() {
        // Pousser deux fois le même tag (sans modif locale) doit rester un succès
        // — le pré-check trouve l'OID identique et laisse passer le push.
        let (_local_tmp, _bare_tmp, local_repo) = setup_local_with_bare_remote(&["v1.0.0"]);
        push_tag(&local_repo, "origin", "v1.0.0", false).unwrap();
        push_tag(&local_repo, "origin", "v1.0.0", false).unwrap();
    }

    #[test]
    fn push_tag_detects_divergent_remote() {
        let (_local_tmp, _bare_tmp, local_repo) = setup_local_with_bare_remote(&["v1.0.0"]);
        push_tag(&local_repo, "origin", "v1.0.0", false).unwrap();

        let new_commit_oid = move_tag_to_new_commit(&local_repo, "v1.0.0");

        let err = push_tag(&local_repo, "origin", "v1.0.0", false).unwrap_err();
        match err {
            AppError::TagRemoteDivergent {
                remote,
                tag,
                remote_oid,
                local_oid,
            } => {
                assert_eq!(remote, "origin");
                assert_eq!(tag, "v1.0.0");
                assert_eq!(local_oid, new_commit_oid.to_string());
                assert_ne!(remote_oid, local_oid);
            }
            other => panic!("expected TagRemoteDivergent, got {other:?}"),
        }
    }

    #[test]
    fn push_tag_force_overwrites_divergent_remote() {
        let (_local_tmp, _bare_tmp, local_repo) = setup_local_with_bare_remote(&["v1.0.0"]);
        push_tag(&local_repo, "origin", "v1.0.0", false).unwrap();

        let new_commit_oid = move_tag_to_new_commit(&local_repo, "v1.0.0");

        // Sans force : divergence
        let err = push_tag(&local_repo, "origin", "v1.0.0", false).unwrap_err();
        assert!(matches!(err, AppError::TagRemoteDivergent { .. }));

        // Avec force : le push réussit et le tag remote pointe sur le nouveau commit
        push_tag(&local_repo, "origin", "v1.0.0", true).unwrap();

        let mut remote = local_repo.find_remote("origin").unwrap();
        let (callbacks, _cert_err) = build_callbacks();
        remote
            .connect_auth(git2::Direction::Fetch, Some(callbacks), None)
            .unwrap();
        let heads = remote.list().unwrap();
        let peeled = "refs/tags/v1.0.0^{}".to_string();
        let advertised = heads
            .iter()
            .find(|h| h.name() == peeled)
            .map(|h| h.oid().to_string())
            .expect("peeled ref present after force push");
        remote.disconnect().unwrap();

        assert_eq!(advertised, new_commit_oid.to_string());
    }
}
