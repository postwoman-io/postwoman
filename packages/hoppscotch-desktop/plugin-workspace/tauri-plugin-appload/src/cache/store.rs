use std::path::PathBuf;
use std::sync::Arc;
use std::time::Instant;

use dashmap::DashMap;
use lru::LruCache;
use tokio::sync::Mutex;

use super::{CacheError, Result};

pub struct FileStore {
    hot_cache: Arc<Mutex<LruCache<String, CacheEntry>>>,
    disk_cache: Arc<DashMap<String, PathBuf>>,
    cache_dir: PathBuf,
    max_memory: usize,
}

struct CacheEntry {
    content: Vec<u8>,
    last_accessed: Instant,
    size: usize,
}

impl FileStore {
    pub fn new(cache_dir: PathBuf, max_memory: usize) -> Self {
        tracing::info!(
            cache_dir = ?cache_dir,
            max_memory,
            "Initializing FileStore with cache directory and memory limit."
        );
        Self {
            hot_cache: Arc::new(Mutex::new(LruCache::new(
                std::num::NonZeroUsize::new(1000).unwrap(),
            ))),
            disk_cache: Arc::new(DashMap::new()),
            cache_dir,
            max_memory,
        }
    }

    pub async fn store(&self, key: &str, content: Vec<u8>) -> Result<()> {
        let size = content.len();
        tracing::info!(key, size, "Storing file in cache.");

        let mut cache = self.hot_cache.lock().await;
        let current_size = self.current_size(&cache);

        if current_size + size <= self.max_memory {
            tracing::debug!(key, size, "File fits in memory; adding to hot cache.");
            cache.put(
                key.to_string(),
                CacheEntry {
                    content,
                    last_accessed: Instant::now(),
                    size,
                },
            );
            return Ok(());
        }

        if size > self.max_memory {
            tracing::warn!(
                key,
                size,
                "File size exceeds maximum memory. Writing directly to disk."
            );
            let path = self.cache_dir.join(key);
            tokio::fs::write(&path, &content).await.map_err(|e| {
                tracing::error!(key, error = %e, "Failed to write file to disk.");
                e
            })?;
            self.disk_cache.insert(key.to_string(), path);
            return Ok(());
        }

        tracing::debug!(
            key,
            size,
            current_size,
            "Hot cache full; evicting files to make room."
        );
        while cache.len() > 0 && self.current_size(&cache) + size > self.max_memory {
            if let Some((evicted_key, entry)) = cache.pop_lru() {
                let path = self.cache_dir.join(&evicted_key);
                tracing::debug!(evicted_key, "Evicting file to disk.");
                tokio::fs::write(&path, &entry.content).await.map_err(|e| {
                    tracing::error!(
                        evicted_key,
                        error = %e,
                        "Failed to write evicted file to disk."
                    );
                    e
                })?;
                self.disk_cache.insert(evicted_key, path);
            }
        }

        tracing::debug!(key, "Adding file to hot cache after eviction.");
        cache.put(
            key.to_string(),
            CacheEntry {
                content,
                last_accessed: Instant::now(),
                size,
            },
        );
        Ok(())
    }

    pub async fn get(&self, key: &str) -> Result<Vec<u8>> {
        tracing::info!(key, "Retrieving file from cache.");

        if let Some(entry) = self.hot_cache.lock().await.get(key) {
            tracing::debug!(key, "File found in hot cache.");
            return Ok(entry.content.clone());
        }

        tracing::debug!(key, "File not found in hot cache. Checking disk cache.");
        if let Some(path) = self.disk_cache.get(key) {
            tracing::debug!(key, path = ?path, "File found in disk cache. Reading from disk.");
            let content = tokio::fs::read(path.value()).await.map_err(|e| {
                tracing::error!(key, error = %e, "Failed to read file from disk.");
                e
            })?;
            self.store(key, content.clone()).await?;
            return Ok(content);
        }

        tracing::warn!(key, "File not found in cache.");
        Err(CacheError::NotFound(key.to_string()))
    }

    fn current_size(&self, cache: &LruCache<String, CacheEntry>) -> usize {
        let size = cache.iter().map(|(_, entry)| entry.size).sum();
        tracing::debug!(current_size = size, "Calculating current hot cache size.");
        size
    }
}
