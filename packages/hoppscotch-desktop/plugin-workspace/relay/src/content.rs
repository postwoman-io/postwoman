use curl::easy::Easy;
use http::HeaderName;
use std::{collections::HashMap, path::Path};

use crate::{
    error::{RelayError, Result},
    interop::{ContentType, FormValue, MediaType},
};

pub(crate) struct ContentHandler<'a> {
    handle: &'a mut Easy,
    headers: &'a mut HashMap<String, String>,
}

impl<'a> ContentHandler<'a> {
    pub(crate) fn new(handle: &'a mut Easy, headers: &'a mut HashMap<String, String>) -> Self {
        tracing::debug!("Creating new ContentHandler with headers: {:?}", headers);
        Self { handle, headers }
    }

    fn merge_headers(&mut self, new_headers: HashMap<String, String>) {
        tracing::info!(
            original_headers = ?self.headers,
            new_headers = ?new_headers,
            "Merging headers"
        );

        for (key, value) in new_headers {
            if let Ok(header_name) = HeaderName::from_bytes(key.as_bytes()) {
                let canonical_name = header_name.to_string();
                self.headers.insert(canonical_name, value);
            } else {
                self.headers.insert(key, value);
            }
        }

        tracing::info!(merged_headers = ?self.headers, "Headers merged");
    }

    #[tracing::instrument(skip(self), level = "debug")]
    pub(crate) fn set_content(&mut self, content: &ContentType) -> Result<()> {
        match content {
            ContentType::Text {
                content,
                media_type,
            } => {
                tracing::info!(content_length = content.len(), "Setting text content");
                self.set_text_content(content, media_type)
            }
            ContentType::Json {
                content,
                media_type,
            } => {
                tracing::info!("Setting JSON content");
                self.set_json_content(content, media_type)
            }
            ContentType::Form {
                content,
                media_type,
            } => {
                tracing::info!(field_count = content.len(), "Setting form content");
                self.set_form_content(content, media_type)
            }
            ContentType::Binary {
                content,
                media_type,
                filename,
            } => {
                tracing::info!(
                    content_length = content.len(),
                    filename = ?filename,
                    "Setting binary content"
                );
                self.set_binary_content(content, media_type, filename.as_deref())
            }
            ContentType::Multipart {
                content,
                media_type,
            } => {
                tracing::info!(field_count = content.len(), "Setting multipart content");
                self.set_multipart_content(content, media_type)
            }
            ContentType::Xml {
                content,
                media_type,
            } => {
                tracing::info!("Setting XML content");
                self.set_text_content(content, media_type)
            }
            ContentType::Urlencoded {
                content,
                media_type,
            } => {
                tracing::info!(field_count = content.len(), "Setting URL-encoded content");
                self.set_urlencoded_content(content, media_type)
            }
        }
    }

    fn set_text_content(&mut self, content: &str, media_type: &MediaType) -> Result<()> {
        let mut headers = HashMap::new();
        headers.insert("content-type".to_string(), media_type.to_string());

        self.merge_headers(headers);

        self.handle
            .post_fields_copy(content.as_bytes())
            .map_err(|e| {
                tracing::error!(error = %e, "Failed to set text content");
                RelayError::Network {
                    message: "Failed to set text content".into(),
                    cause: Some(e.to_string()),
                }
            })?;

        tracing::debug!("Text content set successfully");
        Ok(())
    }

    fn set_json_content(
        &mut self,
        content: &serde_json::Value,
        media_type: &MediaType,
    ) -> Result<()> {
        let json_str = serde_json::to_string(content).map_err(|e| {
            tracing::error!(error = %e, "Failed to serialize JSON");
            RelayError::Parse {
                message: "Failed to serialize JSON".into(),
                cause: Some(e.to_string()),
            }
        })?;

        let mut headers = HashMap::new();
        headers.insert("content-type".to_string(), media_type.to_string());

        self.merge_headers(headers);

        self.handle
            .post_fields_copy(json_str.as_bytes())
            .map_err(|e| {
                tracing::error!(error = %e, "Failed to set JSON content");
                RelayError::Network {
                    message: "Failed to set JSON content".into(),
                    cause: Some(e.to_string()),
                }
            })?;

        tracing::debug!("JSON content set successfully");
        Ok(())
    }

    fn set_binary_content(
        &mut self,
        content: &[u8],
        media_type: &MediaType,
        filename: Option<&str>,
    ) -> Result<()> {
        let mut headers = HashMap::new();

        if let Some(name) = filename {
            let safe_name = Path::new(name)
                .file_name()
                .and_then(|n| n.to_str())
                .unwrap_or(name);

            headers.insert("content-type".to_string(), media_type.to_string());
            headers.insert(
                "Content-Disposition".to_string(),
                format!("attachment; filename=\"{}\"", safe_name),
            );
        } else {
            headers.insert("content-type".to_string(), media_type.to_string());
        }

        self.merge_headers(headers);

        self.handle.post_fields_copy(content).map_err(|e| {
            tracing::error!(error = %e, "Failed to set binary content");
            RelayError::Network {
                message: "Failed to set binary content".into(),
                cause: Some(e.to_string()),
            }
        })?;

        tracing::debug!("Binary content set successfully");
        Ok(())
    }

    fn set_form_content(
        &mut self,
        content: &HashMap<String, Vec<FormValue>>,
        media_type: &MediaType,
    ) -> Result<()> {
        let mut headers = HashMap::new();
        headers.insert("content-type".to_string(), media_type.to_string());

        self.merge_headers(headers);

        let mut form = curl::easy::Form::new();

        for (key, values) in content {
            for value in values {
                match value {
                    FormValue::Text(text) => {
                        tracing::debug!(key = %key, text_length = text.len(), "Adding form text field");
                        form.part(key)
                            .contents(text.as_bytes())
                            .add()
                            .map_err(|e| {
                                tracing::error!(error = %e, key = %key, "Failed to add form text field");
                                RelayError::Network {
                                    message: format!("Failed to add form text field: {}", key),
                                    cause: Some(e.to_string()),
                                }
                            })?;
                    }
                    FormValue::File {
                        filename,
                        content_type,
                        data,
                    } => {
                        tracing::debug!(
                            key = %key,
                            filename = %filename,
                            content_type = ?content_type,
                            data_length = data.len(),
                            "Adding form file field"
                        );
                        form.part(key)
                            .buffer(&filename, data.to_vec())
                            .content_type(&content_type.to_string())
                            .add()
                            .map_err(|e| {
                                tracing::error!(
                                    error = %e,
                                    key = %key,
                                    filename = %filename,
                                    "Failed to add form file field"
                                );
                                RelayError::Network {
                                    message: format!(
                                        "Failed to add form file field: {} ({})",
                                        key, filename
                                    ),
                                    cause: Some(e.to_string()),
                                }
                            })?;
                    }
                }
            }
        }

        self.handle.httppost(form).map_err(|e| {
            tracing::error!(error = %e, "Failed to set form data");
            RelayError::Network {
                message: "Failed to set form data".into(),
                cause: Some(e.to_string()),
            }
        })?;

        tracing::debug!("Form content set successfully");
        Ok(())
    }

    fn set_multipart_content(
        &mut self,
        content: &HashMap<String, Vec<FormValue>>,
        media_type: &MediaType,
    ) -> Result<()> {
        self.set_form_content(content, media_type)
    }

    fn set_urlencoded_content(&mut self, content: &String, media_type: &MediaType) -> Result<()> {
        let mut headers = HashMap::new();
        headers.insert("content-type".to_string(), media_type.to_string());

        self.merge_headers(headers);

        tracing::debug!(content_length = content.len(), "URL-encoded form data");

        self.handle
            .post_fields_copy(content.as_bytes())
            .map_err(|e| {
                tracing::error!(error = %e, "Failed to set urlencoded content");
                RelayError::Network {
                    message: "Failed to set urlencoded content".into(),
                    cause: Some(e.to_string()),
                }
            })?;

        tracing::debug!("URL-encoded content set successfully");
        Ok(())
    }
}
