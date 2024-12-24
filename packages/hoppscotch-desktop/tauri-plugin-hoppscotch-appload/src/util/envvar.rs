use std::{collections::HashMap, env};

/// Collect environment variables that should be exposed to the web app
pub(super) fn collect_env_vars() -> HashMap<String, String> {
    env::vars()
        .filter(|(k, _)| k.starts_with("VITE_"))
        .collect()
}
