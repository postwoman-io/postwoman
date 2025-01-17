use std::time::Duration;

pub(crate) const BUNDLE_CLEANUP_INTERVAL: Duration = Duration::from_secs(3600); // 1 hr
pub(crate) const BUNDLE_MAX_AGE: Duration = Duration::from_secs(86400); // 24 hrs
