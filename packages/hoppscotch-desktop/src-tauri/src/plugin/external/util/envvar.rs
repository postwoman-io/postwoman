use std::{collections::HashMap, env};

pub(super) fn collect_env_vars() -> HashMap<String, String> {
    env::vars()
        .filter(|(k, _)| k.starts_with("VITE_"))
        .collect()
}
