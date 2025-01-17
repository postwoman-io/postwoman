use std::collections::HashMap;

use curl::easy::{Easy, List};

use crate::error::{RelayError, Result};

pub(crate) struct HeadersBuilder<'a> {
    handle: &'a mut Easy,
}

impl<'a> HeadersBuilder<'a> {
    pub(crate) fn new(handle: &'a mut Easy) -> Self {
        Self { handle }
    }

    #[tracing::instrument(skip(self), level = "debug")]
    pub(crate) fn add_headers(&mut self, headers: Option<&HashMap<String, String>>) -> Result<()> {
        let Some(headers) = headers else {
            tracing::debug!("No headers provided");
            return Ok(());
        };

        let header_count = headers.len();
        tracing::info!(header_count, "Building header list");

        let list = headers
            .iter()
            .map(|(key, value)| {
                tracing::debug!(
                    ?key,
                    value_count = value.len(),
                    ?value,
                    "Processing headers"
                );
                let header = format!("{key}: {value}");
                tracing::debug!(%header, "Adding header");
                header
            })
            .try_fold(List::new(), |mut list, header| {
                list.append(&header).map_err(|e| {
                    tracing::error!(%e, "Failed to append header: {header}");
                    RelayError::Network {
                        message: format!("Failed to append header: {header}"),
                        cause: Some(e.to_string()),
                    }
                })?;
                Ok(list)
            })?;

        self.handle.http_headers(list).map_err(|e| {
            tracing::error!(%e, "Failed to set headers");
            RelayError::Network {
                message: "Failed to set headers".into(),
                cause: Some(e.to_string()),
            }
        })
    }

    #[tracing::instrument(skip(self), level = "debug")]
    pub(crate) fn add_content_type(&mut self, content_type: &str) -> Result<()> {
        tracing::info!(content_type = %content_type, "Adding content-type header");
        let mut headers = HashMap::new();
        headers.insert("Content-Type".to_string(), content_type.to_string());
        self.add_headers(Some(&headers))
    }
}
