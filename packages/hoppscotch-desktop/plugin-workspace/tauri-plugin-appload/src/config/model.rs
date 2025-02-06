use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::time::Duration;

use crate::cache::DEFAULT_CACHE_SIZE;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Config {
    #[serde(default)]
    pub api: ApiConfig,
    #[serde(default)]
    pub cache: CacheConfig,
    #[serde(default)]
    pub storage: StorageConfig,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiConfig {
    pub server_url: String,
    #[serde(with = "humantime_serde")]
    pub timeout: Duration,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CacheConfig {
    pub max_size: usize,
    #[serde(with = "humantime_serde")]
    pub file_ttl: Duration,
    pub hot_ratio: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StorageConfig {
    pub root_dir: PathBuf,
    pub max_bundle_size: usize,
}

impl Default for Config {
    fn default() -> Self {
        Self {
            api: ApiConfig::default(),
            cache: CacheConfig::default(),
            storage: StorageConfig::default(),
        }
    }
}

impl Default for ApiConfig {
    fn default() -> Self {
        Self {
            server_url: "http://localhost:3200".to_string(),
            timeout: Duration::from_secs(30),
        }
    }
}

impl Default for CacheConfig {
    fn default() -> Self {
        Self {
            max_size: DEFAULT_CACHE_SIZE,
            file_ttl: Duration::from_secs(3600),
            hot_ratio: 0.2,
        }
    }
}

impl Default for StorageConfig {
    fn default() -> Self {
        Self {
            root_dir: PathBuf::from("data"),
            max_bundle_size: 50 * 1024 * 1024, // 50MB
        }
    }
}
