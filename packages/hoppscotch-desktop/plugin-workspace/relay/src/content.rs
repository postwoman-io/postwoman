use std::{collections::HashMap, path::Path};

use curl::easy::Easy;

use crate::{
    error::{RelayError, Result},
    header::HeadersBuilder,
    interop::{ContentType, FormValue, MediaType},
};

pub(crate) struct ContentHandler<'a> {
    handle: &'a mut Easy,
}

impl<'a> ContentHandler<'a> {
    pub(crate) fn new(handle: &'a mut Easy) -> Self {
        Self { handle }
    }

    #[tracing::instrument(skip(self), level = "debug")]
    pub(crate) fn set_content(&mut self, content: &ContentType) -> Result<()> {
        match content {
            ContentType::Text {
                content,
                media_type,
            } => {
                tracing::trace!(content_length = content.len(), "Setting text content");
                self.set_text_content(content, media_type)
            }
            ContentType::Json {
                content,
                media_type,
            } => {
                tracing::trace!("Setting JSON content");
                self.set_json_content(content, media_type)
            }
            ContentType::Form {
                content,
                media_type,
            } => {
                tracing::trace!(field_count = content.len(), "Setting form content");
                self.set_form_content(content, media_type)
            }
            ContentType::Binary {
                content,
                media_type,
                filename,
            } => {
                tracing::trace!(
                    content_length = content.len(),
                    media_type = ?media_type,
                    filename = ?filename,
                    "Setting binary content"
                );
                self.set_binary_content(content, media_type, filename.as_deref())
            }
            ContentType::Multipart {
                content,
                media_type,
            } => {
                tracing::trace!(field_count = content.len(), "Setting multipart content");
                self.set_multipart_content(content, media_type)
            }
            ContentType::Xml {
                content,
                media_type,
            } => {
                tracing::trace!("Setting XML content");
                self.set_xml_content(content, media_type)
            }
            ContentType::Urlencoded {
                content,
                media_type,
            } => {
                tracing::trace!(field_count = content.len(), "Setting URL-encoded content");
                self.set_urlencoded_content(content, media_type)
            }
        }
    }

    fn set_text_content(&mut self, content: &str, media_type: &MediaType) -> Result<()> {
        HeadersBuilder::new(self.handle).add_content_type(&media_type.to_string())?;

        self.handle
            .post_fields_copy(content.as_bytes())
            .map_err(|e| RelayError::Network {
                message: "Failed to set text content".into(),
                cause: Some(e.to_string()),
            })
    }

    fn set_json_content(
        &mut self,
        content: &serde_json::Value,
        media_type: &MediaType,
    ) -> Result<()> {
        HeadersBuilder::new(self.handle).add_content_type(&media_type.to_string())?;

        let json_str = serde_json::to_string(content).map_err(|e| RelayError::Parse {
            message: "Failed to serialize JSON".into(),
            cause: Some(e.to_string()),
        })?;

        self.handle
            .post_fields_copy(json_str.as_bytes())
            .map_err(|e| RelayError::Network {
                message: "Failed to set JSON content".into(),
                cause: Some(e.to_string()),
            })
    }

    fn set_binary_content(
        &mut self,
        content: &[u8],
        media_type: &MediaType,
        filename: Option<&str>,
    ) -> Result<()> {
        if let Some(name) = filename {
            let safe_name = Path::new(name)
                .file_name()
                .and_then(|n| n.to_str())
                .unwrap_or(name);

            HeadersBuilder::new(self.handle).add_headers(Some(&HashMap::from([
                ("Content-Type".to_string(), vec![media_type.to_string()]),
                (
                    "Content-Disposition".to_string(),
                    vec![format!("attachment; filename=\"{}\"", safe_name)],
                ),
            ])))?;
        } else {
            HeadersBuilder::new(self.handle).add_content_type(&media_type.to_string())?;
        }

        self.handle
            .post_fields_copy(content)
            .map_err(|e| RelayError::Network {
                message: "Failed to set binary content".into(),
                cause: Some(e.to_string()),
            })
    }

    fn set_form_content(
        &mut self,
        content: &HashMap<String, Vec<FormValue>>,
        media_type: &MediaType,
    ) -> Result<()> {
        let mut form = curl::easy::Form::new();

        for (key, values) in content {
            for value in values {
                match value {
                    FormValue::Text(text) => {
                        form.part(key)
                            .contents(text.as_bytes())
                            .add()
                            .map_err(|e| RelayError::Network {
                                message: "Failed to add form text field".into(),
                                cause: Some(e.to_string()),
                            })?;
                    }
                    FormValue::File {
                        filename,
                        content_type,
                        data,
                    } => {
                        form.part(key)
                            .buffer(&filename, data.to_vec())
                            .content_type(&content_type.to_string())
                            .add()
                            .map_err(|e| RelayError::Network {
                                message: "Failed to add form file field".into(),
                                cause: Some(e.to_string()),
                            })?;
                    }
                }
            }
        }

        HeadersBuilder::new(self.handle).add_content_type(&media_type.to_string())?;

        self.handle.httppost(form).map_err(|e| RelayError::Network {
            message: "Failed to set form data".into(),
            cause: Some(e.to_string()),
        })
    }

    fn set_multipart_content(
        &mut self,
        content: &HashMap<String, Vec<FormValue>>,
        media_type: &MediaType,
    ) -> Result<()> {
        self.set_form_content(content, media_type)
    }

    fn set_xml_content(&mut self, content: &str, media_type: &MediaType) -> Result<()> {
        self.set_text_content(content, media_type)
    }

    fn set_urlencoded_content(
        &mut self,
        content: &HashMap<String, String>,
        media_type: &MediaType,
    ) -> Result<()> {
        HeadersBuilder::new(self.handle).add_content_type(&media_type.to_string())?;

        let encoded: String = content
            .iter()
            .map(|(k, v)| format!("{}={}", urlencoding::encode(k), urlencoding::encode(v)))
            .collect::<Vec<_>>()
            .join("&");

        self.handle
            .post_fields_copy(encoded.as_bytes())
            .map_err(|e| RelayError::Network {
                message: "Failed to set urlencoded content".into(),
                cause: Some(e.to_string()),
            })
    }
}
