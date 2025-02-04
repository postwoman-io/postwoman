use chrono::{DateTime, Utc};
use ed25519_dalek::Signature;
use serde::Serialize;

use crate::model::Manifest;

#[derive(Debug, Serialize)]
pub struct ApiResponse<T> {
    pub success: bool,
    pub data: T,
}

impl<T> ApiResponse<T> {
    pub fn ok(data: T) -> Self {
        Self {
            success: true,
            data,
        }
    }
}

#[derive(Debug, Serialize)]
pub struct BundleManifest {
    pub version: String,
    pub created_at: DateTime<Utc>,
    #[serde(with = "signature_serde")]
    pub signature: Signature,
    pub manifest: Manifest,
}

#[derive(Debug, Serialize)]
pub struct PublicKeyInfo {
    pub key: String,
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
}
