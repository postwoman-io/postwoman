use dashmap::DashMap;
use hoppscotch_relay::{RequestWithMetadata, ResponseWithMetadata};
use serde::Serialize;
use tauri::{
    plugin::{Builder, TauriPlugin},
    Manager, Runtime, State,
};
use thiserror::Error;
use tokio_util::sync::CancellationToken;

#[derive(Default)]
struct InterceptorState {
    cancellation_tokens: DashMap<usize, CancellationToken>,
}

#[derive(Debug, Serialize, Error)]
pub enum RunRequestError {
    #[error("Request cancelled")]
    RequestCancelled,
    #[error("Internal server error")]
    InternalServerError,
    #[error("Relay error: {0}")]
    Relay(#[from] hoppscotch_relay::RelayError),
}

#[tauri::command]
async fn run_request(
    req: RequestWithMetadata,
    state: State<'_, InterceptorState>,
) -> Result<ResponseWithMetadata, RunRequestError> {
    let req_id = req.req_id;
    let cancel_token = CancellationToken::new();
    // NOTE: This will drop reference to an existing cancellation token
    // if you send a request with the same request id as an existing one,
    // thereby, dropping any means to cancel a running operation with the old token.
    // This is done so because, on FE side, we may lose cancel token info upon reloads
    // and this allows us to work around that.
    state
        .cancellation_tokens
        .insert(req_id, cancel_token.clone());

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
        res = tokio::task::spawn_blocking(move || hoppscotch_relay::run_request_task(&req, cancel_token_clone)) => {
            match res {
                Ok(task_result) => Ok(task_result?),
                Err(_) => Err(RunRequestError::InternalServerError),
            }
        },
        _ = cancel_token.cancelled() => {
          Err(RunRequestError::RequestCancelled)
        }
    };

    state.cancellation_tokens.remove(&req_id);

    result
}

#[tauri::command]
fn cancel_request(req_id: usize, state: State<'_, InterceptorState>) {
    if let Some((_, cancel_token)) = state.cancellation_tokens.remove(&req_id) {
        cancel_token.cancel();
    }
}

pub fn init<R: Runtime>() -> TauriPlugin<R> {
    Builder::new("hopp_native_interceptor")
        .invoke_handler(tauri::generate_handler![run_request, cancel_request])
        .setup(|app_handle| {
            app_handle.manage(InterceptorState::default());

            Ok(())
        })
        .build()
}
