use base64::{engine::general_purpose::STANDARD, Engine};
use blake3::Hash;

use super::error::{Result, VerificationError};

#[derive(Debug)]
pub struct FileVerifier;

impl FileVerifier {
    pub fn verify(data: &[u8], expected_hash: &Hash) -> Result<()> {
        tracing::debug!("Starting hash verification of file data.");
        let actual_hash = blake3::hash(data);

        if actual_hash != *expected_hash {
            let expected_hash_b64 = STANDARD.encode(expected_hash.as_bytes());
            let actual_hash_b64 = STANDARD.encode(actual_hash.as_bytes());

            tracing::error!(
                expected_hash = %expected_hash_b64,
                actual_hash = %actual_hash_b64,
                "Hash verification failed."
            );

            return Err(VerificationError::InvalidHash {
                expected: expected_hash_b64,
                actual: actual_hash_b64,
            });
        }

        tracing::debug!("Hash verification succeeded.");
        Ok(())
    }

    pub fn hash(data: &[u8]) -> Hash {
        tracing::debug!("Calculating hash for given data.");
        blake3::hash(data)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_file_verification() {
        let data = b"test data";
        let hash = FileVerifier::hash(data);

        assert!(FileVerifier::verify(data, &hash).is_ok());
        assert!(FileVerifier::verify(b"wrong data", &hash).is_err());
    }
}
