use std::{collections::HashMap, str::FromStr, time::SystemTime};

use bytes::Bytes;
use http::{StatusCode, Version};
use mime::Mime;

use crate::{
    error::{RelayError, Result},
    interop::{MediaType, Response, ResponseBody, ResponseMeta, SizeInfo, TimingInfo},
};

pub(crate) struct ResponseHandler {
    id: i64,
    headers: HashMap<String, String>,
    body: Bytes,
    status: StatusCode,
    header_size: u64,
    start_time: SystemTime,
    end_time: SystemTime,
    version: Version,
}

impl ResponseHandler {
    pub(crate) fn new(
        id: i64,
        headers: HashMap<String, String>,
        body: Bytes,
        status: StatusCode,
        header_size: u64,
        start_time: SystemTime,
        end_time: SystemTime,
        version: Version,
    ) -> Self {
        Self {
            id,
            headers,
            body,
            status,
            header_size,
            start_time,
            end_time,
            version,
        }
    }

    #[tracing::instrument(skip(self), fields(request_id = self.id), level = "debug")]
    pub(crate) fn build(self) -> Result<Response> {
        tracing::debug!(status = %self.status, "Building response");
        let media_type = self.determine_media_type();
        let timing = self.calculate_timing()?;
        let size = SizeInfo {
            headers: self.header_size,
            body: self.body.len() as u64,
            total: self.header_size + self.body.len() as u64,
        };

        tracing::debug!(
            status = ?self.status,
            media_type = ?media_type,
            body_size = size.body,
            total_size = size.total,
            version = ?self.version,
            "Response built successfully"
        );

        let body = ResponseBody {
            body: self.body,
            media_type,
        };

        Ok(Response {
            id: self.id,
            status: self.status,
            status_text: self.status.to_string(),
            version: self.version,
            headers: self.headers,
            cookies: None,
            meta: ResponseMeta { timing, size },
            body,
        })
    }

    fn determine_media_type(&self) -> MediaType {
        tracing::trace!("Determining response content type");

        // TODO: Check for other capitalizations, `content-type` or `CONTENT-TYPE`
        self.headers
            .get("Content-Type")
            .and_then(|content_type| content_type.parse::<Mime>().ok())
            .and_then(|mime| match (mime.type_(), mime.subtype()) {
                (mime::APPLICATION, mime::JSON) => Some(MediaType::Json),
                (mime::APPLICATION, name) if name == "ld+json" => Some(MediaType::JsonLd),
                (mime::APPLICATION, mime::XML) => Some(MediaType::Xml),
                (mime::APPLICATION, mime::WWW_FORM_URLENCODED) => Some(MediaType::FormUrlEncoded),
                (mime::APPLICATION, mime::OCTET_STREAM) => Some(MediaType::OctetStream),
                (mime::TEXT, mime::PLAIN) => Some(MediaType::TextPlain),
                (mime::TEXT, mime::HTML) => Some(MediaType::TextHtml),
                (mime::TEXT, mime::CSS) => Some(MediaType::TextCss),
                (mime::TEXT, mime::CSV) => Some(MediaType::TextCsv),
                (mime::TEXT, mime::XML) => Some(MediaType::TextXml),
                (mime::MULTIPART, name) if name == "form-data" => {
                    Some(MediaType::MultipartFormData)
                }
                _ => None,
            })
            .or(infer::get(&self.body)
                .map(|kind| MediaType::from_str(kind.mime_type()).ok())
                .flatten())
            .unwrap_or(MediaType::TextPlain)
    }

    fn calculate_timing(&self) -> Result<TimingInfo> {
        let start_ms = self
            .start_time
            .duration_since(SystemTime::UNIX_EPOCH)
            .map_err(|e| {
                tracing::error!(error = %e, "Failed to get start time");
                RelayError::Parse {
                    message: "Failed to get start time".into(),
                    cause: Some(e.to_string()),
                }
            })?
            .as_millis() as u64;

        let end_ms = self
            .end_time
            .duration_since(SystemTime::UNIX_EPOCH)
            .map_err(|e| {
                tracing::error!(error = %e, "Failed to get end time");
                RelayError::Parse {
                    message: "Failed to get end time".into(),
                    cause: Some(e.to_string()),
                }
            })?
            .as_millis() as u64;

        tracing::trace!(
            start_ms = start_ms,
            end_ms = end_ms,
            duration_ms = end_ms - start_ms,
            "Calculated request timing"
        );

        Ok(TimingInfo {
            start: start_ms,
            end: end_ms,
        })
    }
}
