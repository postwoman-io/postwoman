use ed25519_dalek::{SigningKey, VerifyingKey};
use serde::{Deserialize, Serialize};

use crate::signing::SigningKeyPair;

pub const DEFAULT_MAX_BUNDLE_SIZE: usize = 50 * 1024 * 1024; // 50MB
pub const DEFAULT_PORT: u16 = 3200;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServerConfig {
    #[serde(default = "default_port")]
    pub port: u16,

    #[serde(default = "default_max_bundle_size")]
    pub max_bundle_size: usize,

    #[serde(default)]
    pub csp_directives: Option<String>,

    #[serde(skip)]
    pub signing_key: Option<SigningKey>,

    #[serde(skip)]
    pub verifying_key: Option<VerifyingKey>,

    #[serde(default = "default_frontend_path")]
    pub frontend_path: String,

    #[serde(default = "default_is_dev")]
    pub is_dev: bool,
}

fn default_port() -> u16 {
    DEFAULT_PORT
}

fn default_max_bundle_size() -> usize {
    DEFAULT_MAX_BUNDLE_SIZE
}

fn default_frontend_path() -> String {
    "/site/selfhost-web".to_string()
}

fn default_is_dev() -> bool {
    false
}

impl Default for ServerConfig {
    fn default() -> Self {
        Self {
            port: default_port(),
            max_bundle_size: default_max_bundle_size(),
            csp_directives: None,
            signing_key: None,
            verifying_key: None,
            frontend_path: default_frontend_path(),
            is_dev: default_is_dev(),
        }
    }
}

impl ServerConfig {
    pub fn load(key_pair: SigningKeyPair) -> Self {
        let frontend_path = if cfg!(debug_assertions) {
            "../dist".to_string()
        } else {
            "/site/selfhost-web".to_string()
        };

        Self {
            signing_key: Some(key_pair.signing_key),
            verifying_key: Some(key_pair.verifying_key),
            frontend_path,
            is_dev: cfg!(debug_assertions),
            ..Default::default()
        }
    }

    pub fn frontend_path(&self) -> &str {
        &self.frontend_path
    }
}
