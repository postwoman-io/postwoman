use serde::{ser::Serializer, Serialize};
use std::time::SystemTimeError;

pub type Result<T> = std::result::Result<T, Error>;

#[derive(Debug, thiserror::Error)]
pub enum Error {
    #[error(transparent)]
    UrlParse(#[from] url::ParseError),

    #[error(transparent)]
    Network(#[from] reqwest::Error),

    #[error(transparent)]
    Io(#[from] std::io::Error),

    #[error("Path access error: {0}")]
    PathAccess(String),

    #[error(transparent)]
    Archive(#[from] zip::result::ZipError),

    #[error(transparent)]
    Tauri(#[from] tauri::Error),

    #[error("File not found in archive: {0}")]
    FileNotFound(String),

    #[error("Unsupported compression method")]
    UnsupportedCompression,

    #[error("Failed to read file metadata: {0}")]
    MetadataError(String),

    #[error("Cache error: {0}")]
    CacheError(String),

    #[error("Failed to acquire lock: {0}")]
    LockError(String),

    #[error(transparent)]
    TimeError(#[from] SystemTimeError),

    #[error(transparent)]
    Utf8Error(#[from] std::string::FromUtf8Error),

    #[error("Environment variable error: {0}")]
    EnvVarError(String),

    #[error("Bundle validation error: {0}")]
    ValidationError(String),

    #[cfg(mobile)]
    #[error(transparent)]
    PluginInvoke(#[from] tauri::plugin::mobile::PluginInvokeError),
}

impl Serialize for Error {
    fn serialize<S>(&self, serializer: S) -> std::result::Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        serializer.serialize_str(self.to_string().as_ref())
    }
}

/// Result type alias with error context
#[derive(Debug)]
pub struct ErrorContext {
    /// The error that occurred
    pub error: Error,
    /// Additional context about where/why the error occurred
    pub context: String,
    /// Timestamp when the error occurred
    pub timestamp: std::time::SystemTime,
}

impl ErrorContext {
    /// Create a new error context
    pub fn new(error: Error, context: impl Into<String>) -> Self {
        Self {
            error,
            context: context.into(),
            timestamp: std::time::SystemTime::now(),
        }
    }

    /// Log the error context using tracing
    pub fn log(&self) {
        tracing::error!(
            error = ?self.error,
            context = %self.context,
            timestamp = ?self.timestamp,
            "Error occurred"
        );
    }
}

/// Extension trait for adding context to Results
pub trait ResultExt<T> {
    /// Add context to a Result
    fn context(self, context: impl Into<String>) -> std::result::Result<T, ErrorContext>;
}

impl<T> ResultExt<T> for Result<T> {
    fn context(self, context: impl Into<String>) -> std::result::Result<T, ErrorContext> {
        self.map_err(|error| ErrorContext::new(error, context))
    }
}
