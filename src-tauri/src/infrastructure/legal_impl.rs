use crate::domain::ports::legal::LegalDocuments;
use crate::error::{AppError, Result};

const TERMS_OF_USE_EN: &str = include_str!("../../../docs/legal/terms-of-use.en.md");
const PRIVACY_POLICY_EN: &str = include_str!("../../../docs/legal/privacy-policy.en.md");
const NOTICES_RUST: &str = include_str!("../../../docs/THIRD-PARTY-NOTICES-rust.md");
const NOTICES_NPM: &str = include_str!("../../../docs/THIRD-PARTY-NOTICES-npm.md");

pub struct EmbeddedLegalDocuments;

impl EmbeddedLegalDocuments {
    pub fn new() -> Self {
        Self
    }
}

impl Default for EmbeddedLegalDocuments {
    fn default() -> Self {
        Self::new()
    }
}

impl LegalDocuments for EmbeddedLegalDocuments {
    fn get_legal_document(&self, name: &str) -> Result<String> {
        match name {
            "terms-of-use" => Ok(TERMS_OF_USE_EN.to_string()),
            "privacy-policy" => Ok(PRIVACY_POLICY_EN.to_string()),
            other => Err(AppError::Other(format!("Unknown legal document: {other}"))),
        }
    }

    fn get_third_party_notices(&self, target: &str) -> Result<String> {
        match target {
            "rust" => Ok(NOTICES_RUST.to_string()),
            "npm" => Ok(NOTICES_NPM.to_string()),
            other => Err(AppError::Other(format!(
                "Unknown third-party notices target: {other}"
            ))),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn returns_terms_of_use() {
        let docs = EmbeddedLegalDocuments::new();
        let content = docs.get_legal_document("terms-of-use").unwrap();
        assert!(content.contains("# Terms of Use"));
    }

    #[test]
    fn returns_privacy_policy() {
        let docs = EmbeddedLegalDocuments::new();
        let content = docs.get_legal_document("privacy-policy").unwrap();
        assert!(content.contains("# Privacy Policy"));
    }

    #[test]
    fn rejects_unknown_legal_document() {
        let docs = EmbeddedLegalDocuments::new();
        let err = docs.get_legal_document("unknown").unwrap_err();
        assert!(err.to_string().contains("Unknown legal document"));
    }

    #[test]
    fn returns_rust_notices() {
        let docs = EmbeddedLegalDocuments::new();
        let content = docs.get_third_party_notices("rust").unwrap();
        assert!(!content.is_empty());
    }

    #[test]
    fn returns_npm_notices() {
        let docs = EmbeddedLegalDocuments::new();
        let content = docs.get_third_party_notices("npm").unwrap();
        assert!(!content.is_empty());
    }

    #[test]
    fn rejects_unknown_notices_target() {
        let docs = EmbeddedLegalDocuments::new();
        let err = docs.get_third_party_notices("python").unwrap_err();
        assert!(err.to_string().contains("Unknown third-party notices"));
    }
}
