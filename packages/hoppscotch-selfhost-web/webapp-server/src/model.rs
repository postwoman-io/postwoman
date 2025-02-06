use blake3::Hash;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileEntry {
    pub path: String,
    pub size: u64,
    #[serde(with = "hash_serde")]
    pub hash: Hash,
    pub mime_type: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Manifest {
    pub files: Vec<FileEntry>,
}

mod hash_serde {
    use super::*;
    use base64::{engine::general_purpose::STANDARD, Engine};
    use blake3::Hash;

    pub fn serialize<S>(hash: &Hash, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&STANDARD.encode(hash.as_bytes()))
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
            .map_err(|_| D::Error::custom("invalid hash length"))?;
        Ok(Hash::from_bytes(bytes))
    }
}
