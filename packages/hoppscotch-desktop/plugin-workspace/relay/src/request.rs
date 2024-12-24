use curl::easy::Easy;

use crate::{
    auth::AuthHandler,
    content::ContentHandler,
    error::{RelayError, Result},
    header::HeadersBuilder,
    interop::Request,
    security::SecurityHandler,
    util::ToCurlVersion,
};

pub(crate) struct CurlRequest<'a> {
    handle: &'a mut Easy,
    request: &'a Request,
}

impl<'a> CurlRequest<'a> {
    pub(crate) fn new(handle: &'a mut Easy, request: &'a Request) -> Self {
        tracing::debug!(
            request_id = request.id,
            url = %request.url,
            method = %request.method,
            "Creating new curl request"
        );
        Self { handle, request }
    }

    #[tracing::instrument(skip(self), fields(request_id = self.request.id), level = "debug")]
    fn setup_basics(&mut self) -> Result<()> {
        tracing::debug!("Setting up basic request parameters");

        self.handle
            .custom_request(&self.request.method.to_string())
            .map_err(|e| {
                tracing::error!(error = %e, "Failed to set request method");
                RelayError::Network {
                    message: "Failed to set request method".into(),
                    cause: Some(e.to_string()),
                }
            })?;

        self.handle.url(&self.request.url).map_err(|e| {
            tracing::error!(error = %e, "Failed to set URL");
            RelayError::Network {
                message: "Failed to set URL".into(),
                cause: Some(e.to_string()),
            }
        })?;

        self.handle
            .http_version(self.request.version.to_curl_version())
            .map_err(|e| {
                tracing::error!(error = %e, "Failed to set HTTP version");
                RelayError::Network {
                    message: "Failed to set HTTP version".into(),
                    cause: Some(e.to_string()),
                }
            })?;

        // NOTE: `""` corresponds to accept all,
        // see: https://curl.se/libcurl/c/CURLOPT_ACCEPT_ENCODING.html
        self.handle.accept_encoding("").map_err(|e| {
            tracing::error!(error = %e, "Failed to set accept-encoding");
            RelayError::Network {
                message: "Failed to set accept-encoding".into(),
                cause: Some(e.to_string()),
            }
        })?;

        if let Some(ref headers) = self.request.headers {
            tracing::trace!(headers = ?headers, "Adding request headers");
            HeadersBuilder::new(self.handle).add_headers(Some(headers))?;
        }

        Ok(())
    }

    #[tracing::instrument(skip(self), fields(request_id = self.request.id), level = "debug")]
    pub(crate) fn prepare(&mut self) -> Result<()> {
        tracing::debug!("Preparing request");
        self.setup_basics()?;

        if let Some(ref content) = self.request.content {
            tracing::trace!(content_type = ?content, "Setting request content");
            ContentHandler::new(self.handle).set_content(content)?;
        }

        if let Some(ref auth) = self.request.auth {
            tracing::trace!(auth_type = ?auth, "Configuring authentication");
            AuthHandler::new(self.handle).set_auth(auth)?;
        }

        if let Some(ref security) = self.request.security {
            tracing::trace!(
                verify_peer = ?security.validate_certificates,
                verify_host = ?security.verify_host,
                "Configuring security settings"
            );
            SecurityHandler::new(self.handle).configure(security)?;
        }

        if let Some(ref proxy) = self.request.proxy {
            tracing::trace!(proxy_url = %proxy.url, "Setting up proxy");
            self.handle
                .proxy(&proxy.url)
                .map_err(|e| RelayError::Network {
                    message: "Failed to set proxy".into(),
                    cause: Some(e.to_string()),
                })?;

            if let Some(ref auth) = proxy.auth {
                self.handle
                    .proxy_username(&auth.username)
                    .map_err(|e| RelayError::Network {
                        message: "Failed to set proxy username".into(),
                        cause: Some(e.to_string()),
                    })?;

                self.handle
                    .proxy_password(&auth.password)
                    .map_err(|e| RelayError::Network {
                        message: "Failed to set proxy password".into(),
                        cause: Some(e.to_string()),
                    })?;
            }
        }

        Ok(())
    }
}
