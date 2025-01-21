mod error;
mod manager;
mod policy;
mod store;

pub use error::{CacheError, Result};
pub use manager::CacheManager;
pub use policy::CachePolicy;
pub use store::FileStore;

pub const DEFAULT_CACHE_SIZE: usize = 100 * 1024 * 1024; // 100MB
pub const DEFAULT_FILE_TTL: u64 = 3600; // 1 hour
