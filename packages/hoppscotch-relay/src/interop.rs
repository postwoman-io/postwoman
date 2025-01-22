use serde::{Deserialize, Serialize};

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
pub struct RequestWithMetadata {
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

impl RequestWithMetadata {
    pub fn new(
        req_id: usize,
        method: String,
        endpoint: String,
        headers: Vec<KeyValuePair>,
        body: Option<BodyDef>,
        validate_certs: bool,
        root_cert_bundle_files: Vec<Vec<u8>>,
        client_cert: Option<ClientCertDef>,
        proxy: Option<ProxyConfig>,
    ) -> Self {
        Self {
            req_id,
            method,
            endpoint,
            headers,
            body,
            validate_certs,
            root_cert_bundle_files,
            client_cert,
            proxy,
        }
    }
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

#[derive(Debug, Serialize)]
pub struct ResponseWithMetadata {
    pub status: u16,
    pub status_text: String,
    pub headers: Vec<KeyValuePair>,
    pub data: Vec<u8>,
    pub time_start_ms: u128,
    pub time_end_ms: u128,
}
