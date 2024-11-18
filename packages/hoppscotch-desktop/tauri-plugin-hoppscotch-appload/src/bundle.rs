use dashmap::DashMap;
use std::path::PathBuf;
use std::sync::Arc;
use std::time::Instant;
use std::{fs::File, io::Read};

use super::replacer::Replacer;
use crate::{Error, Result};

type Content = Vec<u8>;

#[derive(Clone, Debug)]
struct FileWithMetadata {
    last_accessed: Instant,
    content: Content,
}

#[derive(Debug)]
pub struct SharedArchive {
    file_metadata: DashMap<String, FileWithMetadata>,
    last_accessed: Instant,
}

impl SharedArchive {
    fn read_file(&self, path: &str) -> Result<Content> {
        self.file_metadata
            .get_mut(path)
            .map(|mut entry| {
                entry.last_accessed = Instant::now();
                entry.content.clone()
            })
            .ok_or_else(|| {
                tracing::warn!("Cache miss for: {path}");
                Error::FileNotFound(path.to_string())
            })
    }
}

#[derive(Debug, Clone, Copy)]
pub struct BundleManagerStats {
    pub total_archives: usize,
    pub active_readers: usize,
}

#[derive(Debug)]
pub struct BundleManager {
    archives: DashMap<String, Arc<SharedArchive>>,
    app_data_path: Arc<std::sync::RwLock<PathBuf>>,
}

impl BundleManager {
    pub fn new(app_data_path: PathBuf) -> Self {
        Self {
            archives: DashMap::new(),
            app_data_path: Arc::new(std::sync::RwLock::new(app_data_path)),
        }
    }

    pub fn fetch(&self, host: &str, path: &str) -> Result<(Content, Option<&'static str>)> {
        let archive = self.get_archive(host)?;

        let path_to_try = if path.is_empty() || path == "/" {
            "index.html"
        } else {
            path
        };

        let try_path = |p: &str| -> Result<(Content, Option<&'static str>)> {
            let content = archive.read_file(p)?;
            let content = if p.ends_with("index.html") {
                self.process_index_html_content(&content)?
            } else {
                content
            };
            Ok((content, mime_infer::from_path(p).first_raw()))
        };

        try_path(path_to_try).or_else(|_| {
            (!path_to_try.ends_with("index.html"))
                .then(|| format!("{}/index.html", path_to_try.trim_end_matches('/')))
                .map(|index_path| {
                    tracing::debug!(?index_path, "Attempting index.html fallback");
                    try_path(&index_path)
                })
                .unwrap_or_else(|| Err(Error::FileNotFound(path_to_try.to_string())))
        })
    }

    fn process_index_html_content(&self, content: &[u8]) -> Result<Content> {
        let content_str = String::from_utf8_lossy(content);
        let replacer = Replacer::new();

        if !replacer.should_inject_env(&content_str) {
            tracing::debug!("No environment variable injection needed");
            return Ok(content.to_vec());
        }

        tracing::debug!("Processing HTML content with env injection");
        let env_vars = super::envvar::collect_env_vars();
        let processed = replacer.replace_all_placeholders(&content_str, &env_vars);

        tracing::debug!(
            ?processed,
            env_var_count = env_vars.len(),
            processed_length = processed.len(),
            "Processed HTML content"
        );

        Ok(processed.into_bytes())
    }

    pub fn get_archive(&self, host: &str) -> Result<Arc<SharedArchive>> {
        if let Some(archive) = self.archives.get(host) {
            tracing::debug!(?host, "Using existing in-memory archive");
            return Ok(archive.value().clone());
        }

        let path = self.app_data_path.read().unwrap();
        let bundle_path = path.join(format!("{}.zip", host));
        tracing::debug!(?bundle_path, "Creating new archive");

        let archive = self.create_shared_archive(bundle_path)?;
        let arc_archive = Arc::new(archive);

        self.archives.insert(host.to_string(), arc_archive.clone());
        tracing::debug!(?host, "Added new archive to in-memory cache");

        Ok(arc_archive)
    }

    fn create_shared_archive(&self, path: PathBuf) -> Result<SharedArchive> {
        tracing::debug!(?path, "Creating new shared archive with in-memory caching");

        let file = File::open(&path)?;
        let mut temp_archive = zip::ZipArchive::new(file)?;
        let file_metadata = DashMap::new();

        for i in 0..temp_archive.len() {
            let mut file = temp_archive.by_index(i)?;
            let mut content = Vec::with_capacity(file.size() as usize);
            file.read_to_end(&mut content)?;

            file_metadata.insert(
                file.name().to_string(),
                FileWithMetadata {
                    last_accessed: Instant::now(),
                    content,
                },
            );
        }

        Ok(SharedArchive {
            file_metadata,
            last_accessed: Instant::now(),
        })
    }

    pub fn cleanup_old_archives(&self, max_age: std::time::Duration) {
        tracing::debug!(?max_age, "Cleaning up old archives");
        let now = Instant::now();
        self.archives.retain(|host, archive| {
            let keep = now.duration_since(archive.last_accessed) < max_age;
            if !keep {
                tracing::debug!(?host, "Removing old archive from in-memory cache");
            }
            keep
        });
    }

    pub fn get_stats(&self) -> BundleManagerStats {
        BundleManagerStats {
            total_archives: self.archives.len(),
            active_readers: self
                .archives
                .iter()
                .filter(|e| e.value().last_accessed.elapsed().as_secs() < 60)
                .count(),
        }
    }
}
