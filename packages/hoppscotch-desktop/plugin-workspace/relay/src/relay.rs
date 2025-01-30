use std::{
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc,
    },
    time::SystemTime,
};

use curl::easy::Easy;
use dashmap::DashMap;
use http::StatusCode;
use tokio_util::sync::CancellationToken;

use crate::{
    error::{RelayError, Result},
    interop::{Request, Response},
    request::CurlRequest,
    response::ResponseHandler,
    transfer::TransferHandler,
};

lazy_static::lazy_static! {
    static ref ACTIVE_REQUESTS: DashMap<i64, Arc<AtomicBool>> = DashMap::new();
}

#[tracing::instrument(skip(request), fields(request_id = request.id), level = "debug")]
fn execute_request(request: &Request, cancel_token: &CancellationToken) -> Result<Response> {
    tracing::info!(
        method = %request.method,
        url = %request.url,
        "Executing request"
    );

    let id = request.id;
    let mut handle = Easy::new();
    let start_time = SystemTime::now();

    let mut curl_request = CurlRequest::new(&mut handle, request);
    curl_request.prepare()?;

    tracing::debug!(request = ?request, "Full request details before sending");

    handle.verbose(true).map_err(|e| RelayError::Network {
        message: "Failed to set verbose mode".into(),
        cause: Some(e.to_string()),
    })?;

    handle
        .debug_function(|info_type, data| {
            if let Ok(s) = std::str::from_utf8(data) {
                tracing::debug!(info_type = ?info_type, s = ?s, "cURL debug fn");
            }
        })
        .map_err(|e| RelayError::Network {
            message: "Failed to set debug function".into(),
            cause: Some(e.to_string()),
        })?;

    let mut transfer_handler = TransferHandler::new();
    transfer_handler.handle_transfer(&mut handle, cancel_token)?;

    let status = handle.response_code().map_err(|e| {
        tracing::error!(error = %e, "Failed to get response code");
        RelayError::Network {
            message: "Failed to get response code".into(),
            cause: Some(e.to_string()),
        }
    })? as u16;

    let header_size = handle.header_size().map_err(|e| {
        tracing::error!(error = %e, "Failed to get header size");
        RelayError::Network {
            message: "Failed to get header size".into(),
            cause: Some(e.to_string()),
        }
    })?;

    let (body, headers) = transfer_handler.into_parts();

    tracing::info!(
        status = status,
        body_size = body.len(),
        header_size = header_size,
        "Request completed"
    );

    // NOTE: If this fails, something has gone very wrong.
    let status_code = StatusCode::from_u16(status).unwrap();

    ResponseHandler::new(
        id,
        headers,
        body,
        status_code,
        header_size,
        start_time,
        SystemTime::now(),
        request.version.clone(),
    )
    .build()
}

#[tracing::instrument(skip(request), fields(request_id = request.id), level = "debug")]
pub async fn execute(request: Request) -> Result<Response> {
    let request_id = request.id;
    let cancelled = Arc::new(AtomicBool::new(false));

    tracing::info!(
        method = %request.method,
        url = %request.url,
        "Starting request execution"
    );

    ACTIVE_REQUESTS.insert(request_id, Arc::clone(&cancelled));

    let cancel_token = CancellationToken::new();
    let cancel_token_clone = cancel_token.clone();
    let cancelled_clone = Arc::clone(&cancelled);

    let handle = std::thread::spawn(move || {
        let result = execute_request(&request, &cancel_token);
        if cancel_token_clone.is_cancelled() {
            cancelled_clone.store(true, Ordering::SeqCst);
        }
        result
    });

    let result = match handle.join() {
        Ok(result) => {
            if cancelled.load(Ordering::SeqCst) {
                tracing::info!("Request was cancelled by user");
                Err(RelayError::Abort {
                    message: "Request cancelled by user".into(),
                })
            } else {
                tracing::debug!("Request completed normally");
                result
            }
        }
        Err(_) => {
            tracing::error!("Request thread panicked");
            Err(RelayError::Network {
                message: "Request thread panicked".into(),
                cause: None,
            })
        }
    };

    ACTIVE_REQUESTS.remove(&request_id);
    tracing::debug!("Request execution completed");

    tracing::debug!("Result {:#?}", result);

    result
}

#[tracing::instrument(level = "debug")]
pub async fn cancel(request_id: i64) -> Result<()> {
    tracing::debug!(request_id = request_id, "Attempting to cancel request");

    if let Some(cancelled) = ACTIVE_REQUESTS.get(&request_id) {
        cancelled.store(true, Ordering::SeqCst);
        tracing::info!(request_id = request_id, "Request cancelled successfully");
        Ok(())
    } else {
        tracing::warn!(
            request_id = request_id,
            "Request not found for cancellation"
        );
        Err(RelayError::Network {
            message: "Request not found".into(),
            cause: None,
        })
    }
}
