use crate::{models::*, Result};
use serde::de::DeserializeOwned;
use tauri::{plugin::PluginApi, AppHandle, Runtime};

pub fn init<R: Runtime, C: DeserializeOwned>(
    app: &AppHandle<R>,
    _api: PluginApi<R, C>,
) -> Result<Relay<R>> {
    tracing::debug!("Initializing Relay for desktop platform");
    Ok(Relay(app.clone()))
}

pub struct Relay<R: Runtime>(AppHandle<R>);

impl<R: Runtime> Relay<R> {
    pub async fn execute(&self, request: RunRequest) -> Result<ExecuteResponse> {
        tracing::debug!(?request, "Executing request");

        match relay::execute(request).await {
            Ok(response) => {
                tracing::debug!("Request executed successfully");
                Ok(ExecuteResponse::Success { response })
            }
            Err(error) => {
                tracing::error!(?error, "Request execution failed");
                Ok(ExecuteResponse::Error { error })
            }
        }
    }

    pub async fn cancel(&self, request_id: CancelRequest) -> Result<CancelResponse> {
        tracing::debug!(?request_id, "Cancelling request");

        if let Err(e) = relay::cancel(request_id).await {
            tracing::error!(?e, "Request cancellation failed");
            return Err(e.into());
        }

        tracing::debug!("Request cancelled successfully");
        Ok(())
    }
}
