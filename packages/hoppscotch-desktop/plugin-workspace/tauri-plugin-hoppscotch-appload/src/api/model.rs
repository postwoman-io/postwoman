use serde::Deserialize;

#[derive(Debug, Clone, Deserialize)]
pub struct ApiResponse<T> {
    pub success: bool,
    #[serde(default)]
    pub error: Option<String>,
    pub data: T,
}
