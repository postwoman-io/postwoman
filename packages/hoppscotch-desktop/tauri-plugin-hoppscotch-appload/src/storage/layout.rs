use std::path::PathBuf;

pub struct StorageLayout {
    root: PathBuf,
}

impl StorageLayout {
    pub fn new(root: PathBuf) -> Self {
        Self { root }
    }

    pub fn bundles_dir(&self) -> PathBuf {
        self.root.join("bundles")
    }

    pub fn bundle_path(&self, name: &str) -> PathBuf {
        self.bundles_dir().join(format!("{}.zip", name))
    }

    pub fn bundle_meta_path(&self, name: &str) -> PathBuf {
        self.bundles_dir().join(format!("{}.meta.json", name))
    }

    pub fn cache_dir(&self) -> PathBuf {
        self.root.join("cache")
    }

    pub fn temp_dir(&self) -> PathBuf {
        self.root.join("temp")
    }

    pub fn keys_dir(&self) -> PathBuf {
        self.root.join("keys")
    }
}
