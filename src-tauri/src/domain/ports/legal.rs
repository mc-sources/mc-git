use crate::error::Result;

pub trait LegalDocuments: Send + Sync {
    fn get_legal_document(&self, name: &str) -> Result<String>;
    fn get_third_party_notices(&self, target: &str) -> Result<String>;
}
