pub fn get_status_text(status: u16) -> &'static str {
    http::StatusCode::from_u16(status)
        .map(|status| status.canonical_reason())
        .unwrap_or(Some("Unknown Status"))
        .unwrap_or("Unknown Status")
}
