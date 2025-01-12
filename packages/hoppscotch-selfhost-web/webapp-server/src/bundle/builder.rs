use rayon::prelude::*;
use std::io::{Cursor, Write};
use std::path::Path;
use walkdir::WalkDir;
use zip::{write::SimpleFileOptions, CompressionMethod, ZipWriter};

use super::error::{BundleError, Result};
use crate::model::FileEntry;

pub struct BundleBuilder {
    writer: ZipWriter<Cursor<Vec<u8>>>,
    files: Vec<FileEntry>,
}

impl BundleBuilder {
    pub fn new<P: AsRef<Path>>(frontend_path: P) -> Result<Self> {
        let frontend_path = frontend_path.as_ref();

        if !frontend_path.exists() {
            return Err(BundleError::Config(format!(
                "Frontend path {} does not exist",
                frontend_path.display()
            )));
        }

        struct FileInfo {
            relative_path: String,
            content: Vec<u8>,
            hash: blake3::Hash,
            size: u64,
            mime_type: Option<String>,
        }

        let file_infos: Vec<FileInfo> = WalkDir::new(frontend_path)
            .into_iter()
            .filter_map(|entry| entry.ok())
            .filter(|entry| entry.file_type().is_file())
            .par_bridge()
            .map(|entry| {
                let path = entry.path();
                let relative_path = path
                    .strip_prefix(frontend_path)
                    .unwrap()
                    .components()
                    .map(|comp| comp.as_os_str().to_string_lossy())
                    .collect::<Vec<_>>()
                    .join("/");

                let content = std::fs::read(path).map_err(|e| {
                    BundleError::Config(format!("Failed to read file {}: {}", path.display(), e))
                })?;

                let hash = blake3::hash(&content);
                let size = content.len() as u64;

                let mime_type = mime_guess::from_path(path)
                    .first()
                    .map(|mime| mime.to_string());

                Ok(FileInfo {
                    relative_path,
                    content,
                    hash,
                    size,
                    mime_type,
                })
            })
            .collect::<Result<Vec<_>>>()?;

        let mut builder = Self {
            writer: ZipWriter::new(Cursor::new(Vec::new())),
            files: Vec::with_capacity(file_infos.len()),
        };

        for file_info in file_infos {
            let options = SimpleFileOptions::default()
                .compression_method(CompressionMethod::Zstd)
                .unix_permissions(0o644);

            builder
                .writer
                .start_file(&file_info.relative_path, options)
                .map_err(|e| BundleError::Config(format!("Failed to start file in zip: {}", e)))?;

            builder
                .writer
                .write_all(&file_info.content)
                .map_err(|e| BundleError::Config(format!("Failed to write file to zip: {}", e)))?;

            builder.files.push(FileEntry {
                path: file_info.relative_path,
                size: file_info.size,
                hash: file_info.hash,
                mime_type: file_info.mime_type,
            });
        }

        Ok(builder)
    }

    pub fn finish(self) -> Result<(Vec<u8>, Vec<FileEntry>)> {
        let writer = self
            .writer
            .finish()
            .map_err(|e| BundleError::Config(format!("Failed to finish zip archive: {}", e)))?;

        Ok((writer.into_inner(), self.files))
    }
}
