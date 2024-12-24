use std::io::Read;
use std::path::PathBuf;

use super::{envvar::collect_env_vars, replacer::Replacer};
use crate::Result;

/// Handles reading and processing app bundles from the filesystem
pub struct Bundle {
    archive: zip::ZipArchive<std::fs::File>,
}

impl Bundle {
    /// Create a new bundle handler for the given app
    pub fn new(app_data_path: PathBuf, host: &str) -> Result<Self> {
        tracing::debug!(?app_data_path, ?host, "Creating new bundle handler");

        let bundle_path = app_data_path.join(format!("{}.zip", host));
        tracing::debug!(?bundle_path, "Looking for bundle file");

        let bundle_file = match std::fs::File::open(&bundle_path) {
            Ok(file) => {
                tracing::debug!("Successfully opened bundle file");
                file
            }
            Err(e) => {
                tracing::error!(?e, ?bundle_path, "Failed to open bundle file");
                return Err(e.into());
            }
        };

        let archive = match zip::ZipArchive::new(bundle_file) {
            Ok(archive) => {
                tracing::debug!(file_count = archive.len(), "Successfully opened ZIP archive");
                archive
            }
            Err(e) => {
                tracing::error!(?e, "Failed to read ZIP archive");
                return Err(e.into());
            }
        };

        Ok(Self { archive })
    }

    /// Handle a file request for the bundle
    pub fn handle_file(&mut self, path: &str) -> Result<(Vec<u8>, Option<&'static str>)> {
        tracing::debug!(?path, "Handling file request");

        if let Ok(mut content) = self.read_file(path) {
            if path.ends_with("index.html") {
                tracing::debug!("Processing index.html content");
                content = self.process_html_content(&content)?;
            }
            let mime_type = mime_infer::from_path(path).first_raw();
            tracing::debug!(?mime_type, content_length = content.len(), "Successfully handled file request");
            return Ok((content, mime_type));
        }

        // Try index.html fallback
        let index_path = format!("{}/index.html", path.trim_end_matches('/'));
        tracing::debug!(?index_path, "Attempting index.html fallback");

        match self.read_file(&index_path) {
            Ok(content) => {
                tracing::debug!(content_length = content.len(), "Successfully read index.html fallback");
                Ok((content, Some("text/html")))
            }
            Err(e) => {
                tracing::error!(?e, ?index_path, "Failed to read index.html fallback");
                Err(e)
            }
        }
    }

    fn read_file(&mut self, path: &str) -> Result<Vec<u8>> {
        tracing::debug!(?path, "Reading file from archive");

        let mut content = Vec::new();
        match self.archive.by_name(path) {
            Ok(mut file) => {
                if let Err(e) = file.read_to_end(&mut content) {
                    tracing::error!(?e, ?path, "Failed to read file content");
                    return Err(e.into());
                }
                tracing::debug!(content_length = content.len(), "Successfully read file content");
                Ok(content)
            }
            Err(e) => {
                tracing::error!(?e, ?path, "Failed to find file in archive");
                Err(e.into())
            }
        }
    }

    fn process_html_content(&self, content: &[u8]) -> Result<Vec<u8>> {
        tracing::debug!(content_length = content.len(), "Processing HTML content");

        let content_str = String::from_utf8_lossy(content);
        let replacer = Replacer::new();

        if replacer.should_inject_env(&content_str) {
            tracing::debug!("Injecting environment variables");
            let env_vars = collect_env_vars();
            tracing::debug!(env_var_count = env_vars.len(), "Collected environment variables");

            let processed = replacer.replace_all_placeholders(&content_str, &env_vars);
            tracing::debug!(processed_length = processed.len(), "Successfully processed HTML content");
            Ok(processed.into_bytes())
        } else {
            tracing::debug!("No environment variable injection needed");
            Ok(content.to_vec())
        }
    }
}
