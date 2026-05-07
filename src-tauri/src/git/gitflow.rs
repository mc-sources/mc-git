use git2::{BranchType, Repository};

use crate::error::{AppError, Result};
use crate::git::branch::{checkout_branch, create_branch, delete_branch};
use crate::git::merge::merge_branch;
use crate::git::tag::create_tag;
use crate::git::types::{BranchInfo, GitFlowConfig};

pub fn read_gitflow_config(repo: &Repository) -> Option<GitFlowConfig> {
    let cfg = repo.config().ok()?;
    let master = cfg.get_string("gitflow.branch.master").ok()?;
    let develop = cfg.get_string("gitflow.branch.develop").ok()?;
    let feature_prefix = cfg
        .get_string("gitflow.prefix.feature")
        .unwrap_or_else(|_| "feature/".into());
    let release_prefix = cfg
        .get_string("gitflow.prefix.release")
        .unwrap_or_else(|_| "release/".into());
    let hotfix_prefix = cfg
        .get_string("gitflow.prefix.hotfix")
        .unwrap_or_else(|_| "hotfix/".into());
    let support_prefix = cfg
        .get_string("gitflow.prefix.support")
        .unwrap_or_else(|_| "support/".into());
    let version_tag_prefix = cfg
        .get_string("gitflow.prefix.versiontag")
        .unwrap_or_default();

    Some(GitFlowConfig {
        master,
        develop,
        feature_prefix,
        release_prefix,
        hotfix_prefix,
        support_prefix,
        version_tag_prefix,
    })
}

pub fn init_gitflow(repo: &Repository, config: &GitFlowConfig) -> Result<()> {
    let mut cfg = repo.config()?.open_level(git2::ConfigLevel::Local)?;
    cfg.set_str("gitflow.branch.master", &config.master)?;
    cfg.set_str("gitflow.branch.develop", &config.develop)?;
    cfg.set_str("gitflow.prefix.feature", &config.feature_prefix)?;
    cfg.set_str("gitflow.prefix.release", &config.release_prefix)?;
    cfg.set_str("gitflow.prefix.hotfix", &config.hotfix_prefix)?;
    cfg.set_str("gitflow.prefix.support", &config.support_prefix)?;
    cfg.set_str("gitflow.prefix.versiontag", &config.version_tag_prefix)?;

    // Create develop branch from master (or HEAD) if it doesn't exist yet
    if repo
        .find_branch(&config.develop, BranchType::Local)
        .is_err()
    {
        let base = if repo.find_branch(&config.master, BranchType::Local).is_ok() {
            config.master.clone()
        } else {
            "HEAD".to_string()
        };
        create_branch(repo, &config.develop, &base)?;
    }

    Ok(())
}

pub fn start_branch(
    repo: &Repository,
    kind: &str,
    name: &str,
    config: &GitFlowConfig,
) -> Result<BranchInfo> {
    let prefix = kind_prefix(kind, config)?;
    let branch_name = format!("{prefix}{name}");

    let base = match kind {
        "feature" | "release" => &config.develop,
        "hotfix" | "support" => &config.master,
        _ => return Err(AppError::Other(format!("Type git-flow inconnu : {kind}"))),
    };

    // REQ-GITFLOW-006: verify base branch exists
    if repo.find_branch(base, BranchType::Local).is_err() {
        return Err(AppError::Other(format!(
            "La branche de base '{}' n'existe pas. Corrigez la configuration git-flow ou créez cette branche manuellement.",
            base
        )));
    }

    let info = create_branch(repo, &branch_name, base)?;
    checkout_branch(repo, &branch_name)?;
    Ok(info)
}

pub fn finish_branch(
    repo: &Repository,
    kind: &str,
    name: &str,
    config: &GitFlowConfig,
) -> Result<()> {
    let prefix = kind_prefix(kind, config)?;
    let branch_name = format!("{prefix}{name}");

    match kind {
        "feature" => {
            checkout_branch(repo, &config.develop)?;
            let status = merge_branch(repo, &branch_name, true)?;
            if status.has_conflicts {
                return Err(AppError::Other(format!(
                    "La fusion de '{}' dans '{}' a des conflits. Résolvez-les d'abord.",
                    branch_name, config.develop
                )));
            }
            delete_branch(repo, &branch_name, true)?;
        }
        "release" | "hotfix" => {
            // 1. Merge into master
            checkout_branch(repo, &config.master)?;
            let status = merge_branch(repo, &branch_name, true)?;
            if status.has_conflicts {
                return Err(AppError::Other(format!(
                    "La fusion de '{}' dans '{}' a des conflits.",
                    branch_name, config.master
                )));
            }

            // 2. Tag on master
            let tag_name = format!("{}{name}", config.version_tag_prefix);
            if !tag_name.is_empty() {
                let head_oid = repo
                    .head()?
                    .target()
                    .ok_or_else(|| AppError::Other("HEAD sans cible".into()))?
                    .to_string();
                let _ = create_tag(repo, &tag_name, &head_oid, Some(&format!("Release {name}")));
            }

            // 3. Merge into develop
            checkout_branch(repo, &config.develop)?;
            let status2 = merge_branch(repo, &branch_name, true)?;
            if status2.has_conflicts {
                return Err(AppError::Other(format!(
                    "La fusion de '{}' dans '{}' a des conflits.",
                    branch_name, config.develop
                )));
            }

            // 4. Delete source branch
            delete_branch(repo, &branch_name, true)?;
        }
        "support" => {
            checkout_branch(repo, &config.master)?;
            let status = merge_branch(repo, &branch_name, true)?;
            if status.has_conflicts {
                return Err(AppError::Other(format!(
                    "La fusion de '{}' dans '{}' a des conflits.",
                    branch_name, config.master
                )));
            }
            delete_branch(repo, &branch_name, true)?;
        }
        _ => return Err(AppError::Other(format!("Type git-flow inconnu : {kind}"))),
    }

    Ok(())
}

fn kind_prefix(kind: &str, config: &GitFlowConfig) -> Result<String> {
    match kind {
        "feature" => Ok(config.feature_prefix.clone()),
        "release" => Ok(config.release_prefix.clone()),
        "hotfix" => Ok(config.hotfix_prefix.clone()),
        "support" => Ok(config.support_prefix.clone()),
        _ => Err(AppError::Other(format!("Type git-flow inconnu : {kind}"))),
    }
}
