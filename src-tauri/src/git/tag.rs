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

        let Ok(obj) = repo.find_object(oid, None) else { return true; };

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
                tags.push(TagInfo { name, target_oid, is_annotated: true, message, tagger });
            }
        } else {
            // Lightweight tag — peel to commit for the real OID
            let target_oid = obj.peel_to_commit()
                .map(|c| c.id().to_string())
                .unwrap_or_else(|_| oid.to_string());
            tags.push(TagInfo { name, target_oid, is_annotated: false, message: None, tagger: None });
        }

        true
    })?;

    tags.sort_by(|a, b| a.name.cmp(&b.name));
    Ok(tags)
}

pub fn create_tag(repo: &Repository, name: &str, target_oid: &str, message: Option<&str>) -> Result<TagInfo> {
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
    tags.into_iter()
        .find(|t| t.name == name)
        .ok_or_else(|| crate::error::AppError::Other(format!("Tag '{name}' not found after creation")))
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
    remote.push(&[refspec.as_str()], Some(&mut push_opts))
        .map_err(|e| remap_cert_error(e, &cert_err))?;
    Ok(())
}

pub fn delete_remote_tag(repo: &Repository, remote_name: &str, tag_name: &str) -> Result<()> {
    let mut remote = repo.find_remote(remote_name)?;
    let (callbacks, cert_err) = build_callbacks();
    let mut push_opts = git2::PushOptions::new();
    push_opts.remote_callbacks(callbacks);
    let refspec = format!(":refs/tags/{tag_name}");
    remote.push(&[refspec.as_str()], Some(&mut push_opts))
        .map_err(|e| remap_cert_error(e, &cert_err))?;
    Ok(())
}
