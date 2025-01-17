mod bundle;
mod error;
mod file;
mod key;

pub use bundle::BundleVerifier;
pub use error::VerificationError;
pub use file::FileVerifier;
pub use key::KeyManager;

pub const VERIFICATION_VERSION: &str = "1.0.0";
