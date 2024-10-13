use axum::{
    body::Bytes,
    extract::{Path, State},
    http::HeaderMap,
    Json,
};
use axum_extra::{
    headers::{authorization::Bearer, Authorization},
    TypedHeader,
};
use std::sync::Arc;
use tauri::{AppHandle, Emitter};
use x25519_dalek::{EphemeralSecret, PublicKey};

use crate::{
    error::{AppError, AppResult},
    model::{
        AuthKeyResponse, ConfirmedRegistrationRequest, HandshakeResponse, RequestDef,
        RunRequestResponse,
    },
    state::{AppState, Registration},
    util::EncryptedJson,
};
use chrono::Utc;
use rand::Rng;
use serde_json::json;
use uuid::Uuid;

fn generate_otp() -> String {
  let otp: u32 = rand::thread_rng().gen_range(0..1_000_000);

  format!("{:06}", otp)
}

pub async fn handshake(
  State((_, app_handle)): State<(Arc<AppState>, AppHandle)>
) -> AppResult<Json<HandshakeResponse>> {
    Ok(Json(HandshakeResponse {
        status: "success".to_string(),
        __hoppscotch__agent__: true,
        agent_version: app_handle.package_info().version.to_string()

    }))
}

pub async fn receive_registration(
    State((state, app_handle)): State<(Arc<AppState>, AppHandle)>,
) -> AppResult<Json<serde_json::Value>> {
    let otp = generate_otp();

    let mut active_registration_code = state.active_registration_code.write().await;

    if !active_registration_code.is_none() {
        return Ok(Json(
            json!({ "message": "There is already an existing registration happening" }),
        ));
    }

    *active_registration_code = Some(otp.clone());

    app_handle
        .emit("registration_received", otp)
        .map_err(|_| AppError::InternalServerError)?;

    Ok(Json(
        json!({ "message": "Registration received and stored" }),
    ))
}

pub async fn verify_registration(
    State((state, app_handle)): State<(Arc<AppState>, AppHandle)>,
    Json(confirmed_registration): Json<ConfirmedRegistrationRequest>,
) -> AppResult<Json<AuthKeyResponse>> {
    state
        .validate_registration(&confirmed_registration.registration)
        .await
        .then_some(())
        .ok_or(AppError::InvalidRegistration)?;

    let auth_key = Uuid::new_v4().to_string();
    let created_at = Utc::now();

    let auth_key_copy = auth_key.clone();

    let agent_secret_key = EphemeralSecret::random();
    let agent_public_key = PublicKey::from(&agent_secret_key);

    let their_public_key = {
        let public_key_slice: &[u8; 32] = &base16::decode(&confirmed_registration.client_public_key_b16)
          .map_err(|_| AppError::InvalidClientPublicKey)?
          [0..32]
          .try_into()
          .map_err(|_| AppError::InvalidClientPublicKey)?;

        PublicKey::from(public_key_slice.to_owned())
    };

    let shared_secret = agent_secret_key.diffie_hellman(&their_public_key);

    let _ = state.update_registrations(app_handle.clone(), |regs| {
      regs.insert(auth_key_copy, Registration {
        registered_at: created_at,
        shared_secret_b16: base16::encode_lower(shared_secret.as_bytes())
      });
    })?;

    let auth_payload = json!({
        "auth_key": auth_key,
        "created_at": created_at
    });

    app_handle
        .emit("authenticated", &auth_payload)
        .map_err(|_| AppError::InternalServerError)?;

    Ok(Json(AuthKeyResponse {
        auth_key,
        created_at,
        agent_public_key_b16: base16::encode_lower(agent_public_key.as_bytes()),
    }))
}

pub async fn run_request<T>(
    State((state, _app_handle)): State<(Arc<AppState>, T)>,
    TypedHeader(auth_header): TypedHeader<Authorization<Bearer>>,
    headers: HeaderMap,
    body: Bytes
) -> AppResult<EncryptedJson<RunRequestResponse>> {
    let nonce = headers.get("X-Hopp-Nonce")
      .ok_or(AppError::Unauthorized)?
      .to_str()
      .map_err(|_| AppError::Unauthorized)?;

    let req: RequestDef = state.validate_access_and_get_data(auth_header.token(), nonce, &body)
        .ok_or(AppError::Unauthorized)?;

    let reg_info = state.get_registration_info(auth_header.token())
        .ok_or(AppError::Unauthorized)?;

    let cancel_token = tokio_util::sync::CancellationToken::new();
    state.add_cancellation_token(req.req_id, cancel_token.clone());

    let req_id = req.req_id;
    let cancel_token_clone = cancel_token.clone();

    // Execute the HTTP request in a blocking thread pool and handles cancellation.
    //
    // It:
    // 1. Uses `spawn_blocking` to run the sync `run_request_task`
    //    without blocking the main Tokio runtime.
    // 2. Uses `select!` to concurrently wait for either
    //      a. the task to complete,
    //      b. or a cancellation signal.
    //
    // Why spawn_blocking?
    // - `run_request_task` uses synchronous curl operations which would block
    //   the async runtime if not run in a separate thread.
    // - `spawn_blocking` moves this operation to a thread pool designed for
    //   blocking tasks, so other async operations to continue unblocked.
    let result = tokio::select! {
        res = tokio::task::spawn_blocking(move || crate::interceptor::run_request_task(&req, cancel_token_clone)) => {
            match res {
                Ok(task_result) => task_result,
                Err(_) => Err(AppError::InternalServerError),
            }
        },
        _ = cancel_token.cancelled() => {
            Err(AppError::RequestCancelled)
        }
    };

    state.remove_cancellation_token(req_id);

    result.map(|val| {
      EncryptedJson {
        key_b16: reg_info.shared_secret_b16,
        data: val
      }
    })
}

/// Provides a way for registered clients to check if their
/// registration still holds, this route is supposed to return
/// an encrypted `true` value if the given auth_key is good.
/// Since its encrypted with the shared secret established during
/// registration, the client also needs the shared secret to verify
/// if the read fails, or the auth_key didn't validate and this route returns
/// undefined, we can count on the registration not being valid anymore.
pub async fn registered_handshake(
    State((state, _)): State<(Arc<AppState>, AppHandle)>,
    TypedHeader(auth_header): TypedHeader<Authorization<Bearer>>,
) -> AppResult<EncryptedJson<serde_json::Value>> {
    let reg_info = state.get_registration_info(auth_header.token());

    match reg_info {
        Some(reg) => Ok(EncryptedJson {
            key_b16: reg.shared_secret_b16,
            data: json!(true),
        }),
        None => Err(AppError::Unauthorized),
    }
}

pub async fn cancel_request<T>(
    State((state, _app_handle)): State<(Arc<AppState>, T)>,
    TypedHeader(auth_header): TypedHeader<Authorization<Bearer>>,
    Path(req_id): Path<usize>,
) -> AppResult<Json<serde_json::Value>> {
    if !state.validate_access(auth_header.token()) {
        return Err(AppError::Unauthorized);
    }

    if let Some((_, token)) = state.remove_cancellation_token(req_id) {
        token.cancel();
        Ok(Json(json!({"message": "Request cancelled successfully"})))
    } else {
        Err(AppError::RequestNotFound)
    }
}
