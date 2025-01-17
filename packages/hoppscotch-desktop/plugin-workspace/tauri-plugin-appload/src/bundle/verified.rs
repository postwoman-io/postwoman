use std::collections::HashMap;
use std::io::Cursor;

use rayon::iter::{IntoParallelRefIterator, ParallelIterator};
use zip::ZipArchive;

use super::Result;
use crate::verification::FileVerifier;
use crate::BundleMetadata;

#[derive(Debug)]
pub struct VerifiedFile {
    pub path: String,
    pub content: Vec<u8>,
}

#[derive(Debug)]
pub struct VerifiedBundle {
    pub metadata: BundleMetadata,
    pub content: Vec<u8>,
    pub files: HashMap<String, VerifiedFile>,
    pub total_size: usize,
}

impl VerifiedBundle {
    pub fn new(content: Vec<u8>, metadata: BundleMetadata) -> super::Result<Self> {
        tracing::info!(
            "Creating new verified bundle with {} files",
            metadata.manifest.files.len()
        );

        let mut archive = ZipArchive::new(Cursor::new(&content)).map_err(|e| {
            tracing::error!(error = %e, "Failed to read ZIP archive");
            super::BundleError::InvalidFormat(format!("Failed to read ZIP archive: {}", e))
        })?;

        tracing::debug!("Extracting all files from archive");
        let file_contents: HashMap<String, Vec<u8>> = metadata
            .manifest
            .files
            .iter()
            .map(|file_entry| {
                let path = file_entry.path.clone();
                tracing::debug!(path = %path, "Extracting file from archive");
                let mut content = Vec::new();
                match archive.by_name(&path) {
                    Ok(mut file) => {
                        if let Err(e) = std::io::Read::read_to_end(&mut file, &mut content) {
                            tracing::error!(path = %path, error = %e, "Failed to read file");
                            Err(super::BundleError::InvalidFormat(format!(
                                "Failed to read {}: {}",
                                path, e
                            )))
                        } else {
                            Ok((path, content))
                        }
                    }
                    Err(e) => {
                        tracing::error!(path = %path, error = %e, "File not found in archive");
                        Err(super::BundleError::InvalidFormat(format!(
                            "File not found in archive: {}",
                            path
                        )))
                    }
                }
            })
            .collect::<Result<_>>()?;

        tracing::debug!("Verifying files in parallel");
        let verified_files: Result<Vec<_>> = metadata
            .manifest
            .files
            .par_iter()
            .map(|file_entry| {
                let content = file_contents.get(&file_entry.path).ok_or_else(|| {
                    super::BundleError::InvalidFormat(format!("Missing content for {}", file_entry.path))
                })?;

                tracing::debug!(path = %file_entry.path, "Verifying file");
                FileVerifier::verify(content, &file_entry.hash).map_err(|e| {
                    tracing::error!(path = %file_entry.path, error = %e, "File verification failed");
                    super::BundleError::Verification(e)
                })?;

                Ok((
                    file_entry.path.clone(),
                    VerifiedFile {
                        path: file_entry.path.clone(),
                        content: content.clone(),
                    },
                ))
            })
            .collect();

        let files: HashMap<_, _> = verified_files?.into_iter().collect();
        let total_size = files.values().map(|f| f.content.len()).sum();

        tracing::info!(
            "Successfully verified bundle with {} files, total size {}",
            files.len(),
            total_size
        );

        Ok(Self {
            metadata,
            content,
            files,
            total_size,
        })
    }

    pub fn iter_files(&self) -> impl Iterator<Item = &VerifiedFile> {
        self.files.values()
    }
}
