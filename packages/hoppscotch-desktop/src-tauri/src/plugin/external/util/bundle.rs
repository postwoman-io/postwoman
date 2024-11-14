use std::io::Read;
use std::path::PathBuf;

use crate::plugin::external::error::ExternalResult;

use super::{envvar::collect_env_vars, replacer::Replacer};

pub struct Bundle {
    app_data_path: PathBuf,
    host: String,
    archive: zip::ZipArchive<std::fs::File>,
}

impl Bundle {
    pub fn new(app_data_path: PathBuf, host: &str) -> ExternalResult<Self> {
        let bundle_path = app_data_path.join(format!("{}.zip", host));
        let bundle_file = std::fs::File::open(bundle_path)?;
        let archive = zip::ZipArchive::new(bundle_file)?;

        Ok(Self {
            app_data_path,
            host: host.to_string(),
            archive,
        })
    }

    pub fn handle_file(&mut self, path: &str) -> ExternalResult<(Vec<u8>, Option<&'static str>)> {
        if let Ok(mut content) = self.read_file(path) {
            if path.ends_with("index.html") {
                content = self.process_html_content(&content)?;
            }
            return Ok((content, mime_infer::from_path(path).first_raw()));
        }

        let index_path = format!("{}/index.html", path.trim_end_matches('/'));
        self.read_file(&index_path)
            .map(|content| (content, Some("text/html")))
    }

    fn read_file(&mut self, path: &str) -> ExternalResult<Vec<u8>> {
        let mut content = Vec::new();
        self.archive.by_name(path)?.read_to_end(&mut content)?;
        Ok(content)
    }

    fn process_html_content(&self, content: &[u8]) -> ExternalResult<Vec<u8>> {
        let content_str = String::from_utf8_lossy(content);
        let replacer = Replacer::new();

        if replacer.should_inject_env(&content_str) {
            let env_vars = collect_env_vars();
            Ok(replacer
                .replace_all_placeholders(&content_str, &env_vars)
                .into_bytes())
        } else {
            Ok(content.to_vec())
        }
    }
}
