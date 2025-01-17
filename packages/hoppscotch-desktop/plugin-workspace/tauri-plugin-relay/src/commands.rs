use crate::{models::*, RelayExt, Result};
use tauri::{command, AppHandle, Runtime};

#[command]
pub(crate) async fn execute<R: Runtime>(
    app: AppHandle<R>,
    request: RunRequest,
) -> Result<ExecuteResponse> {
    tracing::debug!(?request, "Received execute command");
    let response = app.relay().execute(request).await;

    match &response {
        Ok(_) => {
            tracing::info!("Execute command completed successfully");
        }
        Err(e) => {
            tracing::error!(?e, "Execute command failed");
        }
    }

    response
}

#[command]
pub(crate) async fn cancel<R: Runtime>(
    app: AppHandle<R>,
    request_id: CancelRequest,
) -> Result<CancelResponse> {
    tracing::debug!(?request_id, "Received cancel command");
    let response = app.relay().cancel(request_id).await;

    match &response {
        Ok(_) => tracing::info!("Cancel command completed successfully"),
        Err(e) => tracing::error!(?e, "Cancel command failed"),
    }

    response
}
