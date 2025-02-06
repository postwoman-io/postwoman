use axum::{
    routing::{delete, get, post},
    Router,
};
use std::sync::Arc;
use tauri::AppHandle;

use crate::{controller, state::AppState};

pub fn route(state: Arc<AppState>, app_handle: AppHandle) -> Router {
    Router::new()
        .route("/handshake", get(controller::handshake))
        .route(
            "/receive-registration",
            post(controller::receive_registration),
        )
        .route(
            "/verify-registration",
            post(controller::verify_registration),
        )
        .route(
            "/registered-handshake",
            get(controller::registered_handshake),
        )
        .route("/registration", get(controller::registration))
        .route(
            "/registrations/:auth_key",
            delete(controller::delete_registration),
        )
        .route("/execute", post(controller::execute))
        .route("/cancel/:req_id", post(controller::cancel))
        .route("/log-sink", post(controller::log_sink))
        .with_state((state, app_handle))
}
