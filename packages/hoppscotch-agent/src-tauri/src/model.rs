use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct HandshakeResponse {
    #[allow(non_snake_case)]
    pub __hoppscotch__agent__: bool,

    pub status: String,
    pub agent_version: String
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ConfirmedRegistrationRequest {
    pub registration: String,

    /// base16 (lowercase) encoded public key shared by the client
    /// to the agent so that the agent can establish a shared secret
    /// which will be used to encrypt traffic between agent
    /// and client after registration
    pub client_public_key_b16: String
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AuthKeyResponse {
    pub auth_key: String,
    pub created_at: DateTime<Utc>,

    /// base16 (lowercase) encoded public key shared by the
    /// agent so that the client can establish a shared secret
    /// which will be used to encrypt traffic between agent
    /// and client after registration
    pub agent_public_key_b16: String
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct KeyValuePair {
    pub key: String,
    pub value: String,
}

#[derive(Debug, Deserialize)]
pub enum FormDataValue {
    Text(String),
    File {
        filename: String,
        data: Vec<u8>,
        mime: String,
    },
}

#[derive(Debug, Deserialize)]
pub struct FormDataEntry {
    pub key: String,
    pub value: FormDataValue,
}

#[derive(Debug, Deserialize)]
pub enum BodyDef {
    Text(String),
    URLEncoded(Vec<KeyValuePair>),
    FormData(Vec<FormDataEntry>),
}

#[derive(Debug, Deserialize)]
pub struct RequestDef {
    pub req_id: usize,
    pub method: String,
    pub endpoint: String,
    pub headers: Vec<KeyValuePair>,
    pub body: Option<BodyDef>,
    pub validate_certs: bool,
    pub root_cert_bundle_files: Vec<Vec<u8>>,
    pub client_cert: Option<ClientCertDef>,
    pub proxy: Option<ProxyConfig>,
}

#[derive(Debug, Deserialize)]
pub struct ProxyConfig {
    pub url: String,
}

#[derive(Debug, Deserialize)]
pub enum ClientCertDef {
    PEMCert {
        certificate_pem: Vec<u8>,
        key_pem: Vec<u8>,
    },
    PFXCert {
        certificate_pfx: Vec<u8>,
        password: String,
    },
}

#[derive(Debug, Serialize, Deserialize)]
pub struct RunRequestResponse {
    pub status: u16,
    pub status_text: String,
    pub headers: Vec<KeyValuePair>,
    pub data: Vec<u8>,
    pub time_start_ms: u128,
    pub time_end_ms: u128,
}
