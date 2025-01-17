use std::collections::HashMap;

use bytes::{Bytes, BytesMut};
use curl::easy::Easy;
use tokio_util::sync::CancellationToken;

use crate::error::{RelayError, Result};

pub(crate) struct TransferHandler {
    body: BytesMut,
    headers: HashMap<String, String>,
}

impl TransferHandler {
    pub(crate) fn new() -> Self {
        Self {
            body: BytesMut::new(),
            headers: HashMap::new(),
        }
    }

    #[tracing::instrument(skip(self, handle), level = "debug")]
    pub(crate) fn handle_transfer(
        &mut self,
        handle: &mut Easy,
        cancel_token: &CancellationToken,
    ) -> Result<()> {
        tracing::debug!("Setting up transfer handlers");
        let mut transfer = handle.transfer();

        let body = &mut self.body;
        let headers = &mut self.headers;

        transfer
            .write_function(move |data| {
                body.extend_from_slice(data);
                tracing::trace!(bytes = data.len(), "Received response data chunk");
                Ok(data.len())
            })
            .map_err(|e| {
                tracing::error!(error = %e, "Failed to set write callback");
                RelayError::Network {
                    message: "Failed to set write callback".into(),
                    cause: Some(e.to_string()),
                }
            })?;

        transfer
            .header_function(move |header| {
                if let Ok(header_str) = String::from_utf8(header.to_vec()) {
                    if let Some(idx) = header_str.find(':') {
                        let (key, value) = header_str.split_at(idx);
                        let key = key.trim().to_string();
                        let value = value[1..].trim().to_string();

                        headers.entry(key).or_insert(value);
                    }
                }
                true
            })
            .map_err(|e| {
                tracing::error!(error = %e, "Failed to set header callback");
                RelayError::Network {
                    message: "Failed to set header callback".into(),
                    cause: Some(e.to_string()),
                }
            })?;

        transfer
            .progress_function(|_, _, _, _| {
                let cancelled = cancel_token.is_cancelled();
                if cancelled {
                    tracing::warn!("Request cancelled by user");
                }
                !cancelled
            })
            .map_err(|e| {
                tracing::error!(error = %e, "Failed to set progress callback");
                RelayError::Network {
                    message: "Failed to set progress callback".into(),
                    cause: Some(e.to_string()),
                }
            })?;

        tracing::debug!("Starting transfer");
        transfer.perform().map_err(|e| {
            tracing::error!(error = %e, "Failed to perform request");
            RelayError::Network {
                message: "Failed to perform request".into(),
                cause: Some(e.to_string()),
            }
        })?;

        tracing::debug!("Transfer completed successfully");
        Ok(())
    }

    pub(crate) fn into_parts(self) -> (Bytes, HashMap<String, String>) {
        (self.body.into(), self.headers)
    }
}
