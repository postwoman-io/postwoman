use std::sync::Arc;

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
use chrono::Utc;
use rand::Rng;
use serde_json::json;
use tauri::{AppHandle, Emitter};
use uuid::Uuid;
use x25519_dalek::{EphemeralSecret, PublicKey};

use crate::{
    error::{AgentError, AgentResult},
    global::NONCE,
    model::{
        AuthKeyResponse, ConfirmedRegistrationRequest, HandshakeResponse, LogEntry, LogLevel,
        MaskedRegistration, Registration,
    },
    state::AppState,
    util::{generate_auth_key_hash, EncryptedJson},
};

#[tracing::instrument]
fn generate_otp() -> String {
    let otp: u32 = rand::thread_rng().gen_range(0..1_000_000);
    let formatted = format!("{:06}", otp);
    tracing::debug!("Generated OTP: {}", formatted);
    formatted
}

#[tracing::instrument(skip(app_handle))]
pub async fn handshake(
    State((_, app_handle)): State<(Arc<AppState>, AppHandle)>,
) -> AgentResult<Json<HandshakeResponse>> {
    tracing::info!("Processing handshake request");
    let response = HandshakeResponse {
        status: "success".to_string(),
        __hoppscotch__agent__: true,
        agent_version: app_handle.package_info().version.to_string(),
    };
    tracing::info!("Handshake successful");
    Ok(Json(response))
}

#[tracing::instrument(skip(state, app_handle))]
pub async fn receive_registration(
    State((state, app_handle)): State<(Arc<AppState>, AppHandle)>,
) -> AgentResult<Json<serde_json::Value>> {
    let otp = generate_otp();
    tracing::info!("Generated new registration OTP");

    let mut active_registration_code = state.active_registration_code.write().await;

    if !active_registration_code.is_none() {
        tracing::warn!("Registration attempt while another registration is active");
        return Ok(Json(
            json!({ "message": "There is already an existing registration happening" }),
        ));
    }

    *active_registration_code = Some(otp.clone());

    match app_handle.emit("registration-received", otp) {
        Ok(_) => {
            tracing::info!("Registration event emitted successfully");
            Ok(Json(
                json!({ "message": "Registration received and stored" }),
            ))
        }
        Err(e) => {
            tracing::error!("Failed to emit registration event: {}", e);
            Err(AgentError::InternalServerError)
        }
    }
}

#[tracing::instrument(skip(state, _app_handle))]
pub async fn registration(
    State((state, _app_handle)): State<(Arc<AppState>, AppHandle)>,
    TypedHeader(auth_header): TypedHeader<Authorization<Bearer>>,
) -> AgentResult<EncryptedJson<MaskedRegistration>> {
    let token = auth_header.token();

    if !state.validate_access(token) {
        tracing::warn!("Unauthorized attempt to list registrations");
        return Err(AgentError::Unauthorized);
    }

    let registration = state
        .get_registration(token)
        .ok_or(AgentError::Unauthorized)?;

    let key_b16 = registration.shared_secret_b16;

    let registration = MaskedRegistration {
        registered_at: registration.registered_at,
        auth_key_hash: generate_auth_key_hash(token),
    };

    tracing::info!("Successfully retrieved registrations list");
    Ok(EncryptedJson {
        key_b16,
        data: registration,
    })
}

#[tracing::instrument(skip(state, app_handle), fields(auth_key))]
pub async fn verify_registration(
    State((state, app_handle)): State<(Arc<AppState>, AppHandle)>,
    Json(confirmed_registration): Json<ConfirmedRegistrationRequest>,
) -> AgentResult<Json<AuthKeyResponse>> {
    tracing::info!("Verifying registration request");

    if !state
        .validate_registration(&confirmed_registration.registration)
        .await
    {
        tracing::warn!("Invalid registration attempt");
        return Err(AgentError::InvalidRegistration);
    }

    let auth_key = Uuid::new_v4().to_string();
    let created_at = Utc::now();

    tracing::Span::current().record("auth_key", &auth_key.as_str());

    let auth_key_copy = auth_key.clone();
    let secret_key = EphemeralSecret::random();
    let public_key = PublicKey::from(&secret_key);

    let their_public_key = {
        let public_key_slice: &[u8; 32] =
            &base16::decode(&confirmed_registration.client_public_key_b16)
                .map_err(|_| AgentError::InvalidClientPublicKey)?[0..32]
                .try_into()
                .map_err(|_| AgentError::InvalidClientPublicKey)?;

        PublicKey::from(public_key_slice.to_owned())
    };

    let shared_secret = secret_key.diffie_hellman(&their_public_key);

    if let Err(e) = state.update_registrations(app_handle.clone(), |regs| {
        regs.insert(
            auth_key_copy,
            Registration {
                registered_at: created_at,
                shared_secret_b16: base16::encode_lower(shared_secret.as_bytes()),
            },
        );
    }) {
        tracing::error!("Failed to update registrations: {:?}", e);
        return Err(e);
    }

    let auth_payload = json!({
        "auth_key": auth_key,
        "created_at": created_at
    });

    if let Err(e) = app_handle.emit("authenticated", &auth_payload) {
        tracing::error!("Failed to emit authenticated event: {:?}", e);
        return Err(AgentError::InternalServerError);
    }

    let _ = state.clear_active_registration().await;

    tracing::info!("Registration verified successfully");
    Ok(Json(AuthKeyResponse {
        auth_key,
        created_at,
        agent_public_key_b16: base16::encode_lower(public_key.as_bytes()),
    }))
}

#[tracing::instrument(skip(state, app_handle), fields(auth_key = %auth_key))]
pub async fn delete_registration(
    State((state, app_handle)): State<(Arc<AppState>, AppHandle)>,
    TypedHeader(auth_header): TypedHeader<Authorization<Bearer>>,
    Path(auth_key): Path<String>,
) -> AgentResult<Json<serde_json::Value>> {
    if !state.validate_access(auth_header.token()) {
        tracing::warn!("Unauthorized deletion attempt");
        return Err(AgentError::Unauthorized);
    }

    let _removed = state.update_registrations(app_handle.clone(), |regs| {
        regs.remove(&auth_key);
    })?;

    tracing::info!("Registration deleted successfully");
    let message = format!("{} registration deleted successfully", auth_key);
    Ok(Json(json!({ "message": message })))
}

#[tracing::instrument(skip(state, body, _app_handle), fields(req_id))]
pub async fn execute(
    State((state, _app_handle)): State<(Arc<AppState>, AppHandle)>,
    TypedHeader(auth_header): TypedHeader<Authorization<Bearer>>,
    headers: HeaderMap,
    body: Bytes,
) -> AgentResult<EncryptedJson<relay::Response>> {
    let nonce = match headers.get(NONCE) {
        Some(n) => match n.to_str() {
            Ok(n) => n,
            Err(_) => {
                tracing::warn!("Invalid nonce header");
                return Err(AgentError::Unauthorized);
            }
        },
        None => {
            tracing::warn!("Missing nonce header");
            return Err(AgentError::Unauthorized);
        }
    };

    let request = match state.validate_access_and_get_data::<relay::Request>(
        auth_header.token(),
        nonce,
        &body,
    ) {
        Some(r) => r,
        None => {
            tracing::warn!("Invalid access or data");
            return Err(AgentError::Unauthorized);
        }
    };

    let request_id = request.id;

    tracing::Span::current().record("request_id", &request_id);

    let reg_info = match state.get_registration(auth_header.token()) {
        Some(r) => r,
        None => {
            tracing::warn!("Registration info not found");
            return Err(AgentError::Unauthorized);
        }
    };

    Ok(relay::execute(request)
        .await
        .map(|response| EncryptedJson {
            key_b16: reg_info.shared_secret_b16,
            data: response,
        })?)
}

/// Provides a way for registered clients to check if their
/// registration still holds, this route is supposed to return
/// an encrypted `true` value if the given auth_key is good.
/// Since its encrypted with the shared secret established during
/// registration, the client also needs the shared secret to verify
/// if the read fails, or the auth_key didn't validate and this route returns
/// undefined, we can count on the registration not being valid anymore.
#[tracing::instrument(skip(state, _app_handle))]
pub async fn registered_handshake(
    State((state, _app_handle)): State<(Arc<AppState>, AppHandle)>,
    TypedHeader(auth_header): TypedHeader<Authorization<Bearer>>,
) -> AgentResult<EncryptedJson<serde_json::Value>> {
    let reg_info = state.get_registration(auth_header.token());

    match reg_info {
        Some(reg) => {
            tracing::info!("Handshake successful");
            Ok(EncryptedJson {
                key_b16: reg.shared_secret_b16,
                data: json!(true),
            })
        }
        None => {
            tracing::warn!("Unauthorized handshake attempt");
            Err(AgentError::Unauthorized)
        }
    }
}

#[tracing::instrument(skip(state, _app_handle), fields(request_id = %request_id))]
pub async fn cancel(
    State((state, _app_handle)): State<(Arc<AppState>, AppHandle)>,
    TypedHeader(auth_header): TypedHeader<Authorization<Bearer>>,
    Path(request_id): Path<usize>,
) -> AgentResult<Json<serde_json::Value>> {
    if !state.validate_access(auth_header.token()) {
        tracing::warn!("Unauthorized cancellation attempt");
        return Err(AgentError::Unauthorized);
    }

    if let Ok(()) = relay::cancel(request_id.try_into().unwrap()).await {
        tracing::info!("Request cancelled successfully");
        Ok(Json(json!({"message": "Request cancelled successfully"})))
    } else {
        tracing::warn!("Request not found");
        Err(AgentError::RequestNotFound)
    }
}

#[tracing::instrument(skip_all)]
pub async fn log_sink(
    State((state, _app_handle)): State<(Arc<AppState>, AppHandle)>,
    TypedHeader(auth_header): TypedHeader<Authorization<Bearer>>,
    headers: HeaderMap,
    body: Bytes,
) -> AgentResult<Json<serde_json::Value>> {
    if !state.validate_access(auth_header.token()) {
        tracing::warn!("Unauthorized log sink access attempt");
        return Err(AgentError::Unauthorized);
    }

    let nonce = match headers.get(NONCE) {
        Some(n) => match n.to_str() {
            Ok(n) => n,
            Err(_) => {
                tracing::warn!("Invalid nonce header");
                return Err(AgentError::Unauthorized);
            }
        },
        None => {
            tracing::warn!("Missing nonce header");
            return Err(AgentError::Unauthorized);
        }
    };

    let log_entry: LogEntry =
        match state.validate_access_and_get_data(auth_header.token(), nonce, &body) {
            Some(entry) => entry,
            None => {
                tracing::warn!("Failed to decrypt or parse log entry");
                return Err(AgentError::BadRequest("Invalid log entry format".into()));
            }
        };

    let metadata_str = log_entry
        .metadata
        .map(|m| m.to_string())
        .unwrap_or_default();

    let correlation = log_entry.correlation_id.unwrap_or_default();

    match log_entry.level {
        LogLevel::Debug => {
            tracing::debug!(
                timestamp = %log_entry.timestamp,
                context = %log_entry.context,
                source = %log_entry.source,
                metadata = %metadata_str,
                correlation_id = %correlation,
                "{}",
                log_entry.message
            );
        }
        LogLevel::Info => {
            tracing::info!(
                timestamp = %log_entry.timestamp,
                context = %log_entry.context,
                source = %log_entry.source,
                metadata = %metadata_str,
                correlation_id = %correlation,
                "{}",
                log_entry.message
            );
        }
        LogLevel::Warn => {
            tracing::warn!(
                timestamp = %log_entry.timestamp,
                context = %log_entry.context,
                source = %log_entry.source,
                metadata = %metadata_str,
                correlation_id = %correlation,
                "{}",
                log_entry.message
            );
        }
        LogLevel::Error => {
            tracing::error!(
                timestamp = %log_entry.timestamp,
                context = %log_entry.context,
                source = %log_entry.source,
                metadata = %metadata_str,
                correlation_id = %correlation,
                "{}",
                log_entry.message
            );
        }
    }

    Ok(Json(json!({
        "status": "success",
        "message": "Log entry processed"
    })))
}
