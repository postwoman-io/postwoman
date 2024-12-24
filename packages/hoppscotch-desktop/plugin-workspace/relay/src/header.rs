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
    pub(crate) fn add_headers(
        &mut self,
        headers: Option<&HashMap<String, Vec<String>>>,
    ) -> Result<()> {
        let Some(headers) = headers else {
            tracing::trace!("No headers to add");
            return Ok(());
        };

        let mut list = List::new();
        for (key, values) in headers {
            for value in values {
                list.append(&format!("{}: {}", key, value)).map_err(|e| {
                    tracing::error!(error = %e, key = %key, "Failed to append header");
                    RelayError::Network {
                        message: "Failed to append header".into(),
                        cause: Some(e.to_string()),
                    }
                })?;
            }
        }

        self.handle.http_headers(list).map_err(|e| {
            tracing::error!(error = %e, "Failed to set headers");
            RelayError::Network {
                message: "Failed to set headers".into(),
                cause: Some(e.to_string()),
            }
        })
    }

    #[tracing::instrument(skip(self), level = "debug")]
    pub(crate) fn add_content_type(&mut self, content_type: &str) -> Result<()> {
        tracing::trace!(content_type = %content_type, "Setting content type header");
        let mut list = List::new();
        list.append(&format!("Content-Type: {}", content_type))
            .map_err(|e| {
                tracing::error!(error = %e, "Failed to set content type");
                RelayError::Network {
                    message: "Failed to set content type".into(),
                    cause: Some(e.to_string()),
                }
            })?;

        self.handle.http_headers(list).map_err(|e| {
            tracing::error!(error = %e, "Failed to set content type header");
            RelayError::Network {
                message: "Failed to set content type header".into(),
                cause: Some(e.to_string()),
            }
        })
    }
}
