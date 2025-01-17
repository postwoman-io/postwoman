use std::time::Duration;

#[derive(Debug, Clone)]
pub struct CachePolicy {
    pub max_size: usize,
    pub file_ttl: Duration,
    pub hot_ratio: f32,
}

impl CachePolicy {
    pub fn new(max_size: usize, file_ttl: Duration, hot_ratio: f32) -> Self {
        Self {
            max_size,
            file_ttl,
            hot_ratio: hot_ratio.clamp(0.0, 1.0),
        }
    }

    pub fn hot_cache_size(&self) -> usize {
        (self.max_size as f32 * self.hot_ratio) as usize
    }

    pub fn disk_cache_size(&self) -> usize {
        self.max_size - self.hot_cache_size()
    }
}

impl Default for CachePolicy {
    fn default() -> Self {
        Self {
            max_size: super::DEFAULT_CACHE_SIZE,
            file_ttl: Duration::from_secs(super::DEFAULT_FILE_TTL),
            hot_ratio: 0.2,
        }
    }
}
