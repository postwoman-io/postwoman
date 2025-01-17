use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use tokio::fs;
use url::Url;

use super::error::Result;
use super::layout::StorageLayout;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Registry {
    pub version: u32,
    pub servers: HashMap<String, ServerEntry>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServerEntry {
    pub bundle_name: String,
    pub version: String,
    pub created_at: DateTime<Utc>,
    pub last_accessed: DateTime<Utc>,
}

impl Registry {
    pub async fn load(layout: &StorageLayout) -> Result<Self> {
        if !layout.registry_path().exists() {
            return Ok(Self {
                version: 1,
                servers: HashMap::new(),
            });
        }

        let content = fs::read_to_string(layout.registry_path()).await?;
        Ok(serde_json::from_str(&content)?)
    }

    pub async fn save(&self, layout: &StorageLayout) -> Result<()> {
        let content = serde_json::to_string_pretty(self)?;
        fs::write(layout.registry_path(), content).await?;
        Ok(())
    }

    pub fn get_bundle_for_server(&self, server_url: &str) -> Option<&ServerEntry> {
        let normalized_url = Self::normalize_url(server_url).ok()?;
        self.servers.get(&normalized_url)
    }

    pub fn update_server_entry(&mut self, server_url: &str, entry: ServerEntry) -> Result<()> {
        let normalized_url = Self::normalize_url(server_url)?;
        self.servers.insert(normalized_url, entry);
        Ok(())
    }

    pub fn remove_server_entry(&mut self, server_url: &str) -> Result<Option<ServerEntry>> {
        let normalized_url = Self::normalize_url(server_url)?;
        Ok(self.servers.remove(&normalized_url))
    }

    fn normalize_url(url: &str) -> Result<String> {
        let parsed = if !url.starts_with("http://") && !url.starts_with("https://") {
            Url::parse(&format!("https://{}", url))
        } else {
            Url::parse(url)
        }?;

        Ok(parsed.to_string().trim_end_matches('/').to_string())
    }
}
