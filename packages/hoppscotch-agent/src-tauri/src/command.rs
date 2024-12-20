use std::sync::Arc;

use crate::{
    model::{MaskedRegistration, RegistrationsList},
    state::AppState,
    util::generate_auth_key_hash,
};

#[tauri::command]
#[tracing::instrument(skip(state))]
pub async fn get_otp(state: tauri::State<'_, Arc<AppState>>) -> Result<Option<String>, ()> {
    tracing::debug!("Retrieving current OTP");
    let otp = state.active_registration_code.read().await.clone();
    if otp.is_some() {
        tracing::debug!("OTP found");
    } else {
        tracing::debug!("No active OTP");
    }
    Ok(otp)
}

#[tauri::command]
#[tracing::instrument(skip(state))]
pub fn list_registrations(state: tauri::State<'_, Arc<AppState>>) -> Result<RegistrationsList, ()> {
    tracing::debug!("Retrieving registrations list");

    let masked_registrations = state
        .get_registrations()
        .iter()
        .map(|entry| MaskedRegistration {
            registered_at: entry.value().registered_at,
            auth_key_hash: generate_auth_key_hash(entry.key()),
        })
        .collect();

    Ok(RegistrationsList {
        registrations: masked_registrations,
        total: state.get_registrations().len(),
    })
}
