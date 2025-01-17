use std::collections::HashMap;

use bytes::Bytes;
use http::{Method, StatusCode, Version};
use serde::{Deserialize, Serialize};
use strum::{Display, EnumString};
use time::OffsetDateTime;

#[derive(Debug, Serialize, Deserialize, Clone, Copy, PartialEq, Display, EnumString)]
pub enum MediaType {
    #[serde(rename = "text/plain")]
    #[strum(to_string = "text/plain")]
    TextPlain,
    #[serde(rename = "text/html")]
    #[strum(to_string = "text/html")]
    TextHtml,
    #[serde(rename = "text/css")]
    #[strum(to_string = "text/css")]
    TextCss,
    #[serde(rename = "text/csv")]
    #[strum(to_string = "text/csv")]
    TextCsv,
    #[serde(rename = "application/json")]
    #[strum(to_string = "application/json")]
    Json,
    #[serde(rename = "application/ld+json")]
    #[strum(to_string = "application/ld+json")]
    JsonLd,
    #[serde(rename = "application/xml")]
    #[strum(to_string = "application/xml")]
    Xml,
    #[serde(rename = "text/xml")]
    #[strum(to_string = "text/xml")]
    TextXml,
    #[serde(rename = "application/x-www-form-urlencoded")]
    #[strum(to_string = "application/x-www-form-urlencoded")]
    FormUrlEncoded,
    #[serde(rename = "multipart/form-data")]
    #[strum(to_string = "multipart/form-data")]
    MultipartFormData,
    #[serde(rename = "application/octet-stream")]
    #[strum(to_string = "application/octet-stream")]
    OctetStream,
    #[serde(other)]
    Other,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum FormValue {
    Text(String),
    #[serde(rename_all = "camelCase")]
    File {
        filename: String,
        content_type: MediaType,
        data: Bytes,
    },
}

pub type FormData = HashMap<String, Vec<FormValue>>;

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum ContentType {
    #[serde(rename_all = "camelCase")]
    Text {
        content: String,
        media_type: MediaType,
    },
    #[serde(rename_all = "camelCase")]
    Json {
        content: serde_json::Value,
        media_type: MediaType,
    },
    #[serde(rename_all = "camelCase")]
    Xml {
        content: String,
        media_type: MediaType,
    },
    #[serde(rename_all = "camelCase")]
    Form {
        content: FormData,
        media_type: MediaType,
    },
    #[serde(rename_all = "camelCase")]
    Binary {
        content: Bytes,
        media_type: MediaType,
        filename: Option<String>,
    },
    #[serde(rename_all = "camelCase")]
    Multipart {
        content: FormData,
        media_type: MediaType,
    },
    #[serde(rename_all = "camelCase")]
    Urlencoded {
        content: HashMap<String, String>,
        media_type: MediaType,
    },
}

#[derive(Debug, Serialize, Deserialize)]
pub struct TokenResponse {
    pub access_token: String,
    pub token_type: String,
    pub expires_in: Option<u64>,
    pub refresh_token: Option<String>,
    pub scope: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum GrantType {
    #[serde(rename_all = "camelCase")]
    AuthorizationCode {
        auth_endpoint: String,
        token_endpoint: String,
        client_id: String,
        client_secret: Option<String>,
    },
    #[serde(rename_all = "camelCase")]
    ClientCredentials {
        token_endpoint: String,
        client_id: String,
        client_secret: Option<String>,
    },
    #[serde(rename_all = "camelCase")]
    Password {
        token_endpoint: String,
        username: String,
        password: String,
    },
    #[serde(rename_all = "camelCase")]
    Implicit {
        auth_endpoint: String,
        client_id: String,
    },
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(tag = "kind", rename_all = "lowercase")]
pub enum AuthType {
    None,
    #[serde(rename_all = "camelCase")]
    Basic {
        username: String,
        password: String,
    },
    #[serde(rename_all = "camelCase")]
    Bearer {
        token: String,
    },
    #[serde(rename_all = "camelCase")]
    Digest {
        username: String,
        password: String,
        realm: Option<String>,
        nonce: Option<String>,
        opaque: Option<String>,
        algorithm: Option<DigestAlgorithm>,
        qop: Option<DigestQop>,
        nc: Option<String>,
        cnonce: Option<String>,
    },
    #[serde(rename_all = "camelCase")]
    OAuth2 {
        grant_type: GrantType,
        access_token: Option<String>,
        refresh_token: Option<String>,
    },
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
#[serde(rename_all = "SCREAMING-KEBAB-CASE")]
pub enum DigestAlgorithm {
    Md5,
    Sha256,
    Sha512,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
#[serde(rename_all = "kebab-case")]
pub enum DigestQop {
    Auth,
    AuthInt,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum CertificateType {
    Pem { cert: Bytes, key: Bytes },
    Pfx { data: Bytes, password: String },
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SecurityConfig {
    pub certificates: Option<CertificateConfig>,
    #[serde(rename = "validateCertificates")]
    pub validate_certificates: Option<bool>,
    #[serde(rename = "verifyHost")]
    pub verify_host: Option<bool>,
    #[serde(rename = "verifyPeer")]
    pub verify_peer: Option<bool>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CertificateConfig {
    pub client: Option<CertificateType>,
    pub ca: Option<Vec<Bytes>>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Request {
    pub id: i64,
    pub url: String,
    #[serde(with = "http_serde::method")]
    pub method: Method,
    #[serde(with = "http_serde::version")]
    pub version: Version,
    pub headers: Option<HashMap<String, String>>,
    pub params: Option<HashMap<String, String>>,
    pub content: Option<ContentType>,
    pub auth: Option<AuthType>,
    pub security: Option<SecurityConfig>,
    pub proxy: Option<ProxyConfig>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ResponseBody {
    pub body: Bytes,
    pub media_type: MediaType,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Response {
    pub id: i64,
    #[serde(with = "http_serde::status_code")]
    pub status: StatusCode,
    #[serde(rename = "statusText")]
    pub status_text: String,
    #[serde(with = "http_serde::version")]
    pub version: Version,
    pub headers: HashMap<String, String>,
    pub cookies: Option<Vec<Cookie>>,
    pub body: ResponseBody,
    pub meta: ResponseMeta,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ProxyConfig {
    pub url: String,
    pub auth: Option<ProxyAuth>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ProxyAuth {
    pub username: String,
    pub password: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Cookie {
    pub name: String,
    pub value: String,
    pub domain: Option<String>,
    pub path: Option<String>,
    pub expires: Option<OffsetDateTime>,
    pub secure: Option<bool>,
    #[serde(rename = "httpOnly")]
    pub http_only: Option<bool>,
    #[serde(rename = "sameSite")]
    pub same_site: Option<SameSite>,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
pub enum SameSite {
    Strict,
    Lax,
    None,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ResponseMeta {
    pub timing: TimingInfo,
    pub size: SizeInfo,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TimingInfo {
    pub start: u64,
    pub end: u64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SizeInfo {
    pub headers: u64,
    pub body: u64,
    pub total: u64,
}
