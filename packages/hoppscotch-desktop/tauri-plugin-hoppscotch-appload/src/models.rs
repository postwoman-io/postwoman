use std::collections::HashMap;

use blake3::Hash;
use chrono::{DateTime, Utc};
use ed25519_dalek::Signature;
use serde::{Deserialize, Serialize};
use url::Url;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BundleMetadata {
    pub version: String,
    pub created_at: DateTime<Utc>,
    #[serde(with = "signature_serde")]
    pub signature: Signature,
    pub manifest: Manifest,
    #[serde(default)]
    pub properties: HashMap<String, String>,
}

mod signature_serde {
    use super::*;
    use base64::{engine::general_purpose::STANDARD, Engine};
    use serde::{de::Error, Deserializer, Serializer};

    pub fn serialize<S>(sig: &Signature, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        serializer.serialize_str(&STANDARD.encode(sig.to_bytes()))
    }

    pub fn deserialize<'de, D>(deserializer: D) -> Result<Signature, D::Error>
    where
        D: Deserializer<'de>,
    {
        let s = String::deserialize(deserializer)?;
        let bytes = STANDARD.decode(&s).map_err(D::Error::custom)?;
        let bytes: [u8; 64] = bytes
            .try_into()
            .map_err(|_| D::Error::custom("invalid signature length"))?;
        Ok(Signature::from_bytes(&bytes))
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileEntry {
    pub path: String,
    pub size: u64,
    #[serde(with = "hash_serde")]
    pub hash: Hash,
    pub mime_type: Option<String>,
}

mod hash_serde {
    use super::*;
    use base64::{engine::general_purpose::STANDARD, Engine};
    use blake3::Hash;

    pub fn serialize<S>(sig: &Hash, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&STANDARD.encode(sig.as_bytes()))
    }

    pub fn deserialize<'de, D>(deserializer: D) -> Result<Hash, D::Error>
    where
        D: serde::Deserializer<'de>,
    {
        use serde::de::Error;
        let s = String::deserialize(deserializer)?;
        let bytes = STANDARD.decode(&s).map_err(D::Error::custom)?;
        let bytes: [u8; 32] = bytes
            .try_into()
            .map_err(|_| D::Error::custom("invalid signature length"))?;
        Ok(Hash::from_bytes(bytes))
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Manifest {
    pub files: Vec<FileEntry>,
}

impl Manifest {
    pub fn total_size(&self) -> u64 {
        self.files.iter().map(|f| f.size).sum()
    }

    pub fn get_file(&self, path: &str) -> Option<&FileEntry> {
        self.files.iter().find(|f| f.path == path)
    }
}

#[derive(Debug, Clone, Deserialize)]
pub struct ApiResponse<T> {
    pub success: bool,
    #[serde(default)]
    pub error: Option<String>,
    pub data: T,
}

#[derive(Debug, Clone, Deserialize)]
pub struct BundleList {
    pub bundles: Vec<BundleSummary>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct BundleSummary {
    pub name: String,
    pub version: String,
    pub created_at: DateTime<Utc>,
    pub file_count: usize,
}

#[derive(Debug, Clone, Deserialize)]
pub struct VerificationResponse {
    pub status: String,
    pub created_at: DateTime<Utc>,
    pub version: String,
    pub file_count: usize,
}

#[derive(Debug, Clone, Deserialize)]
pub struct PublicKeyInfo {
    pub key: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DownloadOptions {
    pub server_url: Url,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DownloadResponse {
    pub success: bool,
    pub bundle_name: String,
    pub server_url: Url,
    pub version: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LoadOptions {
    pub bundle_name: String,
    #[serde(default)]
    pub inline: bool,
    #[serde(default)]
    pub window: WindowOptions,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LoadResponse {
    pub success: bool,
    pub window_label: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WindowOptions {
    #[serde(default = "default_window_title")]
    pub title: String,
    #[serde(default = "default_window_width")]
    pub width: f64,
    #[serde(default = "default_window_height")]
    pub height: f64,
    #[serde(default = "default_resizable")]
    pub resizable: bool,
}

fn default_window_title() -> String {
    "Hoppscotch".into()
}

fn default_window_width() -> f64 {
    800.0
}

fn default_window_height() -> f64 {
    600.0
}

fn default_resizable() -> bool {
    true
}

impl Default for WindowOptions {
    fn default() -> Self {
        Self {
            title: default_window_title(),
            width: default_window_width(),
            height: default_window_height(),
            resizable: default_resizable(),
        }
    }
}
