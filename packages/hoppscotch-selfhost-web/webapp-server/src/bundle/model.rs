use chrono::{DateTime, Utc};
use ed25519_dalek::Signature;
use serde::{Deserialize, Serialize};

use crate::model::{FileEntry, Manifest};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BundleMetadata {
    pub version: String,
    pub created_at: DateTime<Utc>,
    #[serde(with = "signature_serde")]
    pub signature: Signature,
    pub manifest: Manifest,
}

mod signature_serde {
    use super::*;
    use base64::{engine::general_purpose::STANDARD, Engine};

    pub fn serialize<S>(sig: &Signature, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&STANDARD.encode(sig.to_bytes()))
    }

    pub fn deserialize<'de, D>(deserializer: D) -> Result<Signature, D::Error>
    where
        D: serde::Deserializer<'de>,
    {
        use serde::de::Error;
        let s = String::deserialize(deserializer)?;
        let bytes = STANDARD.decode(&s).map_err(D::Error::custom)?;
        let bytes: [u8; 64] = bytes
            .try_into()
            .map_err(|_| D::Error::custom("invalid signature length"))?;
        Ok(Signature::from_bytes(&bytes))
    }
}

#[derive(Debug, Clone)]
pub struct Bundle {
    pub metadata: BundleMetadata,
    pub content: Vec<u8>,
}

impl Bundle {
    pub fn new(content: Vec<u8>, signature: Signature, files: Vec<FileEntry>) -> Self {
        let metadata = BundleMetadata {
            version: env!("CARGO_PKG_VERSION").to_string(),
            created_at: Utc::now(),
            signature,
            manifest: Manifest { files },
        };

        Self { metadata, content }
    }
}
