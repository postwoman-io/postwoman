use curl::easy::{Easy, List};
use openssl::{pkcs12::Pkcs12, ssl::SslContextBuilder, x509::X509};
use openssl_sys::SSL_CTX;
use std::time::SystemTime;
use tokio_util::sync::CancellationToken;

use crate::{
    error::RelayError,
    interop::{
        BodyDef, ClientCertDef, FormDataValue, KeyValuePair, RequestWithMetadata,
        ResponseWithMetadata,
    },
    util::get_status_text,
};

pub fn run_request_task(
    req: &RequestWithMetadata,
    cancel_token: CancellationToken,
) -> Result<ResponseWithMetadata, RelayError> {
    log::info!(
        "Starting request task: [Method: {}] [URL: {}] [Validate Certs: {}] [Has Body: {}] [Proxy Enabled: {}]",
        req.method,
        req.endpoint,
        req.validate_certs,
        req.body.is_some(),
        req.proxy.is_some()
    );

    let mut curl_handle = Easy::new();
    log::debug!("Initialized new curl handle with default settings");

    match curl_handle.progress(true) {
        Ok(_) => log::debug!("Progress tracking enabled for request monitoring"),
        Err(err) => {
            log::error!(
                "Critical failure enabling progress tracking: {}\nError details: {:?}",
                err,
                err
            );
            return Err(RelayError::RequestRunError(err.description().to_string()));
        }
    }

    match curl_handle.custom_request(&req.method) {
        Ok(_) => log::debug!("HTTP method set: {}", req.method),
        Err(err) => {
            log::error!("Failed to set HTTP method '{}'. Error: {}", req.method, err);
            return Err(RelayError::InvalidMethod);
        }
    }

    match curl_handle.url(&req.endpoint) {
        Ok(_) => log::debug!("Target URL configured: {}", req.endpoint),
        Err(err) => {
            log::error!(
                "URL configuration failed for '{}'\nError: {}",
                req.endpoint,
                err
            );
            return Err(RelayError::InvalidUrl);
        }
    }

    let headers = match get_headers_list(&req) {
        Ok(headers) => {
            log::debug!("Generated headers list");
            headers
        }
        Err(err) => {
            log::error!("Header generation failed:\nError: {:?}", err);
            return Err(err);
        }
    };

    match curl_handle.http_headers(headers) {
        Ok(_) => log::debug!("Successfully configured request headers"),
        Err(err) => {
            log::error!("Failed to set HTTP headers: {}", err);
            return Err(RelayError::InvalidHeaders);
        }
    }

    if let Err(err) = apply_body_to_curl_handle(&mut curl_handle, &req) {
        log::error!(
            "Request body application failed:\nError: {:?}\nContent-Type: {:?}",
            err,
            req.headers
                .iter()
                .find(|h| h.key.to_lowercase() == "content-type")
                .map(|h| &h.value)
        );
        return Err(err);
    }
    log::debug!("Request body configured successfully");

    match curl_handle.ssl_verify_peer(req.validate_certs) {
        Ok(_) => log::debug!(
            "SSL peer verification setting applied: {}",
            req.validate_certs
        ),
        Err(err) => {
            log::error!(
                "SSL peer verification configuration failed: {}\nRequested setting: {}",
                err,
                req.validate_certs
            );
            return Err(RelayError::RequestRunError(err.description().to_string()));
        }
    }

    match curl_handle.ssl_verify_host(req.validate_certs) {
        Ok(_) => log::debug!(
            "SSL host verification setting applied: {}",
            req.validate_certs
        ),
        Err(err) => {
            log::error!(
                "SSL host verification configuration failed: {}\nRequested setting: {}",
                err,
                req.validate_certs
            );
            return Err(RelayError::RequestRunError(err.description().to_string()));
        }
    }

    if let Err(err) = apply_client_cert_to_curl_handle(&mut curl_handle, &req) {
        log::error!(
            "Client certificate configuration failed:\nError: {:?}\nCert Info: {:#?}",
            err,
            req.client_cert.as_ref()
        );
        return Err(err);
    }
    log::debug!("Client certificate configuration successful");

    if let Err(err) = apply_proxy_config_to_curl_handle(&mut curl_handle, &req) {
        log::error!(
            "Proxy configuration failed:\nError: {:?}\nProxy Info: {:?}",
            err,
            req.proxy.as_ref()
        );
        return Err(err);
    }
    log::debug!("Proxy configuration applied successfully");

    let mut response_body = Vec::new();
    let mut response_headers = Vec::new();
    let (start_time_ms, end_time_ms) = {
        let mut transfer = curl_handle.transfer();
        log::debug!("Created curl transfer object for request execution");

        match transfer.ssl_ctx_function(|ssl_ctx_ptr| {
            let cert_list = match get_x509_certs_from_root_cert_bundle_safe(&req) {
                Ok(certs) => {
                    log::debug!("Found {} certificates in root bundle", certs.len());
                    certs
                }
                Err(e) => {
                    log::error!("Failed to load certificates from bundle: {:?}", e);
                    return Ok(());
                }
            };

            if !cert_list.is_empty() {
                let mut ssl_ctx_builder =
                    unsafe { SslContextBuilder::from_ptr(ssl_ctx_ptr as *mut SSL_CTX) };

                let cert_store = ssl_ctx_builder.cert_store_mut();

                for (index, cert) in cert_list.iter().enumerate() {
                    log::debug!(
                        "Processing certificate {}: Subject: {:?}, Not Before: {:?}, Not After: {:?}",
                        index,
                        cert.subject_name(),
                        cert.not_before(),
                        cert.not_after()
                    );

                    if let Err(e) = cert_store.add_cert(cert.clone()) {
                        log::warn!(
                            "Failed to add certificate {} to store\nError: {}\nCert details: {:?}",
                            index,
                            e,
                            cert.subject_name()
                        );
                    } else {
                        log::debug!(
                            "Successfully added certificate {} to store\nSubject: {:?}",
                            index,
                            cert.subject_name()
                        );
                    }
                }

                // SAFETY: We need to prevent Rust from dropping the `SslContextBuilder` because
                // the underlying `SSL_CTX` pointer is owned and managed by curl, not us.
                // From curl docs: "libcurl does not guarantee the lifetime of the passed in
                // object once this callback function has returned"
                // and `SslContextBuilder` is just a safe wrapper around curl's `SSL_CTX` from
                // `openssl_sys::SSL_CTX`.
                // If dropped, Rust would try to free the `SSL_CTX` which curl still needs.
                //
                // This intentional "leak" is safe because:
                // - We're only leaking the thin Rust wrapper
                // - Curl manages the actual `SSL_CTX` memory
                // - Curl will free the `SSL_CTX` during connection cleanup
                //
                // See: https://curl.se/libcurl/c/CURLOPT_SSL_CTX_FUNCTION.html
                std::mem::forget(ssl_ctx_builder);
            }

            Ok(())
        }) {
            Ok(_) => log::debug!("SSL context function configured successfully"),
            Err(err) => {
                log::error!("SSL context function setup failed: {}", err);
                return Err(RelayError::RequestRunError(err.description().to_string()));
            }
        }

        match transfer.progress_function(|dltotal, dlnow, ultotal, ulnow| {
            let cancelled = cancel_token.is_cancelled();
            if cancelled {
                log::warn!(
                    "Request cancelled by user\nDownload: {}/{} bytes\nUpload: {}/{} bytes",
                    dlnow,
                    dltotal,
                    ulnow,
                    ultotal
                );
            } else {
                log::debug!(
                    "Progress - Download: {}/{} bytes, Upload: {}/{} bytes",
                    dlnow,
                    dltotal,
                    ulnow,
                    ultotal
                );
            }
            !cancelled
        }) {
            Ok(_) => log::debug!("Progress monitoring function configured"),
            Err(err) => {
                log::error!("Progress function setup failed: {}", err);
                return Err(RelayError::RequestRunError(err.description().to_string()));
            }
        }

        match transfer.header_function(|header| {
            let header = String::from_utf8_lossy(header).into_owned();
            if let Some((key, value)) = header.split_once(':') {
                log::debug!("Received header: [{}] = [{}]", key.trim(), value.trim());
                response_headers.push(KeyValuePair {
                    key: key.trim().to_string(),
                    value: value.trim().to_string(),
                });
            } else {
                log::debug!("Received header line (no key-value): {}", header.trim());
            }
            true
        }) {
            Ok(_) => log::debug!("Header processing function configured"),
            Err(err) => {
                log::error!("Header function setup failed: {}", err);
                return Err(RelayError::RequestRunError(err.description().to_string()));
            }
        }

        match transfer.write_function(|data| {
            let chunk_size = data.len();
            response_body.extend_from_slice(data);
            log::debug!(
                "Received response chunk: {} bytes (Total size so far: {} bytes)",
                chunk_size,
                response_body.len()
            );
            Ok(chunk_size)
        }) {
            Ok(_) => log::debug!("Response body processing function configured"),
            Err(err) => {
                log::error!("Write function setup failed: {}", err);
                return Err(RelayError::RequestRunError(err.description().to_string()));
            }
        }

        let start_time_ms = SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_millis();
        log::info!(
            "Initiating request transfer at timestamp: {}",
            start_time_ms
        );

        if let Err(err) = transfer.perform() {
            log::error!(
                "Request transfer failed:\nError: {}\nTime elapsed: {}ms",
                err,
                SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .unwrap()
                    .as_millis()
                    - start_time_ms,
            );
            return Err(RelayError::RequestRunError(err.description().to_string()));
        }

        let end_time_ms = SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_millis();

        log::info!(
            "Request transfer completed:\nDuration: {}ms",
            end_time_ms - start_time_ms,
        );

        (start_time_ms, end_time_ms)
    };

    let response_status = match curl_handle.response_code() {
        Ok(status) => {
            let status = status as u16;
            log::info!(
                "Response status code: {} ({})",
                status,
                get_status_text(status)
            );
            status
        }
        Err(err) => {
            log::error!("Failed to retrieve response code: {}", err);
            return Err(RelayError::RequestRunError(err.description().to_string()));
        }
    };

    let response_status_text = get_status_text(response_status).to_string();
    log::info!(
        "Request completed successfully:\nStatus: {} ({})\nDuration: {}ms\n\
         Response size: {} bytes\nHeaders: {} received\nEndpoint: {}",
        response_status,
        response_status_text,
        end_time_ms - start_time_ms,
        response_body.len(),
        response_headers.len(),
        req.endpoint
    );

    Ok(ResponseWithMetadata {
        status: response_status,
        status_text: response_status_text,
        headers: response_headers,
        data: response_body,
        time_start_ms: start_time_ms,
        time_end_ms: end_time_ms,
    })
}

fn get_headers_list(req: &RequestWithMetadata) -> Result<List, RelayError> {
    let mut result = List::new();

    for KeyValuePair { key, value } in &req.headers {
        result
            .append(&format!("{}: {}", key, value))
            .map_err(|err| RelayError::RequestRunError(err.description().to_string()))?;
    }

    Ok(result)
}

fn apply_body_to_curl_handle(
    curl_handle: &mut Easy,
    req: &RequestWithMetadata,
) -> Result<(), RelayError> {
    match &req.body {
        Some(BodyDef::Text(text)) => {
            curl_handle
                .post_fields_copy(text.as_bytes())
                .map_err(|err| {
                    RelayError::RequestRunError(format!(
                        "Error while setting body: {}",
                        err.description()
                    ))
                })?;
        }
        Some(BodyDef::FormData(entries)) => {
            let mut form = curl::easy::Form::new();

            for entry in entries {
                let mut part = form.part(&entry.key);

                match &entry.value {
                    FormDataValue::Text(data) => {
                        part.contents(data.as_bytes());
                    }
                    FormDataValue::File {
                        filename,
                        data,
                        mime,
                    } => {
                        part.buffer(filename, data.clone()).content_type(mime);
                    }
                };

                part.add().map_err(|err| {
                    RelayError::RequestRunError(format!(
                        "Error while setting body: {}",
                        err.description()
                    ))
                })?;
            }

            curl_handle.httppost(form).map_err(|err| {
                RelayError::RequestRunError(format!(
                    "Error while setting body: {}",
                    err.description()
                ))
            })?;
        }
        Some(BodyDef::URLEncoded(entries)) => {
            let data = entries
                .iter()
                .map(|KeyValuePair { key, value }| {
                    format!(
                        "{}={}",
                        &url_escape::encode_www_form_urlencoded(key),
                        url_escape::encode_www_form_urlencoded(value)
                    )
                })
                .collect::<Vec<String>>()
                .join("&");

            curl_handle
                .post_fields_copy(data.as_bytes())
                .map_err(|err| {
                    RelayError::RequestRunError(format!(
                        "Error while setting body: {}",
                        err.description()
                    ))
                })?;
        }
        None => {}
    };

    Ok(())
}

fn apply_client_cert_to_curl_handle(
    handle: &mut Easy,
    req: &RequestWithMetadata,
) -> Result<(), RelayError> {
    match &req.client_cert {
        Some(ClientCertDef::PEMCert {
            certificate_pem,
            key_pem,
        }) => {
            handle.ssl_cert_type("PEM").map_err(|err| {
                RelayError::RequestRunError(format!(
                    "Failed setting PEM Cert Type: {}",
                    err.description()
                ))
            })?;

            handle.ssl_cert_blob(certificate_pem).map_err(|err| {
                RelayError::RequestRunError(format!(
                    "Failed setting PEM Cert Blob: {}",
                    err.description()
                ))
            })?;

            handle.ssl_key_type("PEM").map_err(|err| {
                RelayError::RequestRunError(format!(
                    "Failed setting PEM key type: {}",
                    err.description()
                ))
            })?;

            handle.ssl_key_blob(key_pem).map_err(|err| {
                RelayError::RequestRunError(format!(
                    "Failed setting PEM Cert blob: {}",
                    err.description()
                ))
            })?;
        }
        Some(ClientCertDef::PFXCert {
            certificate_pfx,
            password,
        }) => {
            let pkcs12 = Pkcs12::from_der(&certificate_pfx).map_err(|err| {
                RelayError::RequestRunError(format!(
                    "Failed to parse PFX certificate from DER: {}",
                    err
                ))
            })?;

            let parsed = pkcs12.parse2(password).map_err(|err| {
                RelayError::RequestRunError(format!(
                    "Failed to parse PFX certificate with provided password: {}",
                    err
                ))
            })?;

            if let (Some(cert), Some(key)) = (parsed.cert, parsed.pkey) {
                let certificate_pem = cert.to_pem().map_err(|err| {
                    RelayError::RequestRunError(format!(
                        "Failed to convert PFX certificate to PEM format: {}",
                        err
                    ))
                })?;

                let key_pem = key.private_key_to_pem_pkcs8().map_err(|err| {
                    RelayError::RequestRunError(format!(
                        "Failed to convert PFX private key to PEM format: {}",
                        err
                    ))
                })?;

                handle.ssl_cert_type("PEM").map_err(|err| {
                    RelayError::RequestRunError(format!(
                        "Failed setting PEM Cert Type for converted PFX: {}",
                        err.description()
                    ))
                })?;

                handle.ssl_cert_blob(&certificate_pem).map_err(|err| {
                    RelayError::RequestRunError(format!(
                        "Failed setting PEM Cert Blob for converted PFX: {}",
                        err.description()
                    ))
                })?;

                handle.ssl_key_type("PEM").map_err(|err| {
                    RelayError::RequestRunError(format!(
                        "Failed setting PEM key type for converted PFX: {}",
                        err.description()
                    ))
                })?;

                handle.ssl_key_blob(&key_pem).map_err(|err| {
                    RelayError::RequestRunError(format!(
                        "Failed setting PEM key blob for converted PFX: {}",
                        err.description()
                    ))
                })?;
            } else {
                return Err(RelayError::RequestRunError(
                    "PFX certificate parsing succeeded, but either cert or private key is missing"
                        .to_string(),
                ));
            }
        }
        None => {}
    };

    Ok(())
}

fn get_x509_certs_from_root_cert_bundle_safe(
    req: &RequestWithMetadata,
) -> Result<Vec<X509>, openssl::error::ErrorStack> {
    let mut certs = Vec::new();

    for pem_bundle in &req.root_cert_bundle_files {
        match openssl::x509::X509::stack_from_pem(pem_bundle) {
            Ok(mut bundle_certs) => certs.append(&mut bundle_certs),
            Err(e) => {
                log::warn!("Failed to parse certificate bundle: {:?}", e);
            }
        }
    }

    Ok(certs)
}

fn apply_proxy_config_to_curl_handle(
    handle: &mut Easy,
    req: &RequestWithMetadata,
) -> Result<(), RelayError> {
    if let Some(proxy_config) = &req.proxy {
        handle
            .proxy_auth(curl::easy::Auth::new().auto(true))
            .map_err(|err| {
                RelayError::RequestRunError(format!(
                    "Failed to set proxy Auth Mode: {}",
                    err.description()
                ))
            })?;

        handle.proxy(&proxy_config.url).map_err(|err| {
            RelayError::RequestRunError(format!("Failed to set proxy URL: {}", err.description()))
        })?;
    }

    Ok(())
}
