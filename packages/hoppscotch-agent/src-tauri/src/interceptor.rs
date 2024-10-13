use crate::{
    error::AppError,
    model::{BodyDef, ClientCertDef, FormDataValue, KeyValuePair, RequestDef, RunRequestResponse},
    util::get_status_text,
};
use curl::easy::{Easy, List};
use openssl::{pkcs12::Pkcs12, ssl::SslContextBuilder, x509::X509};
use openssl_sys::SSL_CTX;
use std::time::SystemTime;
use tokio_util::sync::CancellationToken;

pub(crate) fn run_request_task(
    req: &RequestDef,
    cancel_token: CancellationToken,
) -> Result<RunRequestResponse, AppError> {
    let mut curl_handle = Easy::new();

    curl_handle
        .progress(true)
        .map_err(|err| AppError::RequestRunError(err.description().to_string()))?;

    curl_handle
        .custom_request(&req.method)
        .map_err(|_| AppError::InvalidMethod)?;

    curl_handle
        .url(&req.endpoint)
        .map_err(|_| AppError::InvalidUrl)?;

    curl_handle
        .http_headers(get_headers_list(&req)?)
        .map_err(|_| AppError::InvalidHeaders)?;

    apply_body_to_curl_handle(&mut curl_handle, &req)?;

    curl_handle
        .ssl_verify_peer(req.validate_certs)
        .map_err(|err| AppError::RequestRunError(err.description().to_string()))?;

    curl_handle
        .ssl_verify_host(req.validate_certs)
        .map_err(|err| AppError::RequestRunError(err.description().to_string()))?;

    apply_client_cert_to_curl_handle(&mut curl_handle, &req)?;

    apply_proxy_config_to_curl_handle(&mut curl_handle, &req)?;

    let mut response_body = Vec::new();
    let mut response_headers = Vec::new();

    let (start_time_ms, end_time_ms) = {
        let mut transfer = curl_handle.transfer();

        transfer
            .ssl_ctx_function(|ssl_ctx_ptr| {
                let cert_list = get_x509_certs_from_root_cert_bundle(&req);

                if !cert_list.is_empty() {
                    let mut ssl_ctx_builder =
                        unsafe { SslContextBuilder::from_ptr(ssl_ctx_ptr as *mut SSL_CTX) };

                    let cert_store = ssl_ctx_builder.cert_store_mut();

                    for cert in cert_list {
                        if let Err(e) = cert_store.add_cert(cert) {
                            eprintln!("Failed writing cert into cert store: {}", e);
                        }
                    }
                }

                Ok(())
            })
            .map_err(|err| AppError::RequestRunError(err.description().to_string()))?;

        transfer
            .progress_function(|_, _, _, _| !cancel_token.is_cancelled())
            .map_err(|err| AppError::RequestRunError(err.description().to_string()))?;

        transfer
            .header_function(|header| {
                let header = String::from_utf8_lossy(header).into_owned();

                if let Some((key, value)) = header.split_once(':') {
                    response_headers.push(KeyValuePair {
                        key: key.trim().to_string(),
                        value: value.trim().to_string(),
                    });
                }

                true
            })
            .map_err(|err| AppError::RequestRunError(err.description().to_string()))?;

        transfer
            .write_function(|data| {
                response_body.extend_from_slice(data);
                Ok(data.len())
            })
            .map_err(|err| AppError::RequestRunError(err.description().to_string()))?;

        let start_time_ms = SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_millis();

        transfer
            .perform()
            .map_err(|err| AppError::RequestRunError(err.description().to_string()))?;

        let end_time_ms = SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_millis();

        (start_time_ms, end_time_ms)
    };

    let response_status = curl_handle
        .response_code()
        .map_err(|err| AppError::RequestRunError(err.description().to_string()))?
        as u16;

    let response_status_text = get_status_text(response_status).to_string();

    Ok(RunRequestResponse {
        status: response_status,
        status_text: response_status_text,
        headers: response_headers,
        data: response_body,
        time_start_ms: start_time_ms,
        time_end_ms: end_time_ms,
    })
}

fn get_headers_list(req: &RequestDef) -> Result<List, AppError> {
    let mut result = List::new();

    for KeyValuePair { key, value } in &req.headers {
        result
            .append(&format!("{}: {}", key, value))
            .map_err(|err| AppError::RequestRunError(err.description().to_string()))?;
    }

    Ok(result)
}

fn apply_body_to_curl_handle(curl_handle: &mut Easy, req: &RequestDef) -> Result<(), AppError> {
    match &req.body {
        Some(BodyDef::Text(text)) => {
            curl_handle
                .post_fields_copy(text.as_bytes())
                .map_err(|err| {
                    AppError::RequestRunError(format!(
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
                    AppError::RequestRunError(format!(
                        "Error while setting body: {}",
                        err.description()
                    ))
                })?;
            }

            curl_handle.httppost(form).map_err(|err| {
                AppError::RequestRunError(format!(
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
                    AppError::RequestRunError(format!(
                        "Error while setting body: {}",
                        err.description()
                    ))
                })?;
        }
        None => {}
    };

    Ok(())
}

fn apply_client_cert_to_curl_handle(handle: &mut Easy, req: &RequestDef) -> Result<(), AppError> {
    match &req.client_cert {
        Some(ClientCertDef::PEMCert {
            certificate_pem,
            key_pem,
        }) => {
            handle.ssl_cert_type("PEM").map_err(|err| {
                AppError::RequestRunError(format!(
                    "Failed setting PEM Cert Type: {}",
                    err.description()
                ))
            })?;

            handle.ssl_cert_blob(certificate_pem).map_err(|err| {
                AppError::RequestRunError(format!(
                    "Failed setting PEM Cert Blob: {}",
                    err.description()
                ))
            })?;

            handle.ssl_key_type("PEM").map_err(|err| {
                AppError::RequestRunError(format!(
                    "Failed setting PEM key type: {}",
                    err.description()
                ))
            })?;

            handle.ssl_key_blob(key_pem).map_err(|err| {
                AppError::RequestRunError(format!(
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
                AppError::RequestRunError(format!(
                    "Failed to parse PFX certificate from DER: {}",
                    err
                ))
            })?;

            let parsed = pkcs12.parse2(password).map_err(|err| {
                AppError::RequestRunError(format!(
                    "Failed to parse PFX certificate with provided password: {}",
                    err
                ))
            })?;

            if let (Some(cert), Some(key)) = (parsed.cert, parsed.pkey) {
                let certificate_pem = cert.to_pem().map_err(|err| {
                    AppError::RequestRunError(format!(
                        "Failed to convert PFX certificate to PEM format: {}",
                        err
                    ))
                })?;

                let key_pem = key.private_key_to_pem_pkcs8().map_err(|err| {
                    AppError::RequestRunError(format!(
                        "Failed to convert PFX private key to PEM format: {}",
                        err
                    ))
                })?;

                handle.ssl_cert_type("PEM").map_err(|err| {
                    AppError::RequestRunError(format!(
                        "Failed setting PEM Cert Type for converted PFX: {}",
                        err.description()
                    ))
                })?;

                handle.ssl_cert_blob(&certificate_pem).map_err(|err| {
                    AppError::RequestRunError(format!(
                        "Failed setting PEM Cert Blob for converted PFX: {}",
                        err.description()
                    ))
                })?;

                handle.ssl_key_type("PEM").map_err(|err| {
                    AppError::RequestRunError(format!(
                        "Failed setting PEM key type for converted PFX: {}",
                        err.description()
                    ))
                })?;

                handle.ssl_key_blob(&key_pem).map_err(|err| {
                    AppError::RequestRunError(format!(
                        "Failed setting PEM key blob for converted PFX: {}",
                        err.description()
                    ))
                })?;
            } else {
                return Err(AppError::RequestRunError(
                    "PFX certificate parsing succeeded, but either cert or private key is missing"
                        .to_string(),
                ));
            }
        }
        None => {}
    };

    Ok(())
}

fn get_x509_certs_from_root_cert_bundle(req: &RequestDef) -> Vec<X509> {
    req.root_cert_bundle_files
        .iter()
        .map(|pem_bundle| openssl::x509::X509::stack_from_pem(pem_bundle))
        .filter_map(|certs| {
            if let Ok(certs) = certs {
                Some(certs)
            } else {
                None
            }
        })
        .flatten()
        .collect()
}

fn apply_proxy_config_to_curl_handle(handle: &mut Easy, req: &RequestDef) -> Result<(), AppError> {
    if let Some(proxy_config) = &req.proxy {
        handle
            .proxy_auth(curl::easy::Auth::new().auto(true))
            .map_err(|err| {
                AppError::RequestRunError(format!(
                    "Failed to set proxy Auth Mode: {}",
                    err.description()
                ))
            })?;

        handle.proxy(&proxy_config.url).map_err(|err| {
            AppError::RequestRunError(format!("Failed to set proxy URL: {}", err.description()))
        })?;
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use crate::model::FormDataEntry;

    use super::*;
    use mockito::Server;

    #[test]
    fn test_run_request_task_success() {
        let mut server = Server::new();
        let mock = server
            .mock("GET", "/test")
            .with_status(200)
            .with_header("content-type", "text/plain")
            .with_body("Hello, World!")
            .create();

        let req = RequestDef {
            req_id: 1,
            method: "GET".to_string(),
            endpoint: format!("{}/test", server.url()),
            headers: vec![],
            body: None,
            validate_certs: false,
            root_cert_bundle_files: vec![],
            client_cert: None,
            proxy: None,
        };
        let cancel_token = CancellationToken::new();

        let result = run_request_task(&req, cancel_token);
        assert!(result.is_ok());

        let response = result.unwrap();
        assert_eq!(response.status, 200);
        assert_eq!(response.status_text, "OK");
        assert!(response
            .headers
            .iter()
            .any(|h| h.key == "content-type" && h.value == "text/plain"));
        assert_eq!(response.data, b"Hello, World!");

        mock.assert();
    }

    #[test]
    fn test_run_request_task_with_headers() {
        let mut server = Server::new();
        let mock = server
            .mock("GET", "/test")
            .match_header("X-Custom-Header", "TestValue")
            .with_status(200)
            .create();

        let req = RequestDef {
            req_id: 1,
            method: "GET".to_string(),
            endpoint: format!("{}/test", server.url()),
            headers: vec![KeyValuePair {
                key: "X-Custom-Header".to_string(),
                value: "TestValue".to_string(),
            }],
            body: None,
            validate_certs: false,
            root_cert_bundle_files: vec![],
            client_cert: None,
            proxy: None,
        };
        let cancel_token = CancellationToken::new();

        let result = run_request_task(&req, cancel_token);
        assert!(result.is_ok());

        mock.assert();
    }

    #[test]
    fn test_run_request_task_with_body() {
        let mut server = Server::new();
        let mock = server
            .mock("POST", "/test")
            .match_body("test_body")
            .with_status(201)
            .create();

        let req = RequestDef {
            req_id: 1,
            method: "POST".to_string(),
            endpoint: format!("{}/test", server.url()),
            headers: vec![],
            body: Some(BodyDef::Text("test_body".to_string())),
            validate_certs: false,
            root_cert_bundle_files: vec![],
            client_cert: None,
            proxy: None,
        };
        let cancel_token = CancellationToken::new();

        let result = run_request_task(&req, cancel_token);
        assert!(result.is_ok());
        assert_eq!(result.unwrap().status, 201);

        mock.assert();
    }

    #[test]
    fn test_run_request_task_with_url_encoded_body() {
        let mut server = Server::new();
        let mock = server
            .mock("POST", "/test")
            .match_body("key1=value1&key2=value2")
            .with_status(200)
            .create();

        let req = RequestDef {
            req_id: 1,
            method: "POST".to_string(),
            endpoint: format!("{}/test", server.url()),
            headers: vec![],
            body: Some(BodyDef::URLEncoded(vec![
                KeyValuePair {
                    key: "key1".to_string(),
                    value: "value1".to_string(),
                },
                KeyValuePair {
                    key: "key2".to_string(),
                    value: "value2".to_string(),
                },
            ])),
            validate_certs: false,
            root_cert_bundle_files: vec![],
            client_cert: None,
            proxy: None,
        };
        let cancel_token = CancellationToken::new();

        let result = run_request_task(&req, cancel_token);
        assert!(result.is_ok());

        mock.assert();
    }

    #[test]
    fn test_run_request_task_with_invalid_url() {
        let req = RequestDef {
            req_id: 1,
            method: "GET".to_string(),
            endpoint: "invalid_url".to_string(),
            headers: vec![],
            body: None,
            validate_certs: false,
            root_cert_bundle_files: vec![],
            client_cert: None,
            proxy: None,
        };
        let cancel_token = CancellationToken::new();

        let result = run_request_task(&req, cancel_token);

        assert!(result.is_err());
    }

    #[test]
    fn test_run_request_task_with_form_data() {
        let mut server = Server::new();
        let mock = server
            .mock("POST", "/test")
            .match_header(
                "content-type",
                mockito::Matcher::Regex("multipart/form-data.*".to_string()),
            )
            .with_status(200)
            .create();

        let req = RequestDef {
            req_id: 1,
            method: "POST".to_string(),
            endpoint: format!("{}/test", server.url()),
            headers: vec![],
            body: Some(BodyDef::FormData(vec![
                FormDataEntry {
                    key: "text_field".to_string(),
                    value: FormDataValue::Text("text_value".to_string()),
                },
                FormDataEntry {
                    key: "file_field".to_string(),
                    value: FormDataValue::File {
                        filename: "test.txt".to_string(),
                        data: b"file_content".to_vec(),
                        mime: "text/plain".to_string(),
                    },
                },
            ])),
            validate_certs: false,
            root_cert_bundle_files: vec![],
            client_cert: None,
            proxy: None,
        };
        let cancel_token = CancellationToken::new();

        let result = run_request_task(&req, cancel_token);
        assert!(result.is_ok());

        mock.assert();
    }
}
