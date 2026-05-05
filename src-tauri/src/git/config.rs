use git2::{Config, Repository};

use crate::error::Result;

pub fn get_config(repo: &Repository, key: &str, global: bool) -> Result<Option<String>> {
    let config = if global {
        Config::open_default()?
    } else {
        repo.config()?
    };

    match config.get_string(key) {
        Ok(value) => Ok(Some(value)),
        Err(e) if e.code() == git2::ErrorCode::NotFound => Ok(None),
        Err(e) => Err(e.into()),
    }
}

pub fn set_config(repo: &Repository, key: &str, value: &str, global: bool) -> Result<()> {
    let mut config = if global {
        Config::open_default()?
    } else {
        repo.config()?
    };

    config.set_str(key, value)?;
    Ok(())
}
