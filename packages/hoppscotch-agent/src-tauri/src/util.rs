use std::process::{Command, Stdio};

use aes_gcm::{aead::Aead, AeadCore, Aes256Gcm, KeyInit};
use axum::{
    body::Body,
    response::{IntoResponse, Response},
};
use rand::rngs::OsRng;
use serde::Serialize;
use sha2::{Digest, Sha256};

use crate::global::NONCE;

pub fn generate_auth_key_hash(auth_key: &str) -> String {
    let hash = Sha256::digest(auth_key.as_bytes());
    base16::encode_lower(&hash[..3])
}

pub fn open_link(link: &str) -> Option<()> {
    let null = Stdio::null();

    #[cfg(target_os = "windows")]
    {
        Command::new("rundll32")
            .args(["url.dll,FileProtocolHandler", link])
            .stdout(null)
            .spawn()
            .ok()
            .map(|_| ())
    }

    #[cfg(target_os = "macos")]
    {
        Command::new("open")
            .arg(link)
            .stdout(null)
            .spawn()
            .ok()
            .map(|_| ())
    }

    #[cfg(target_os = "linux")]
    {
        Command::new("xdg-open")
            .arg(link)
            .stdout(null)
            .spawn()
            .ok()
            .map(|_| ())
    }

    #[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
    {
        None
    }
}

#[derive(Debug)]
pub struct EncryptedJson<T: Serialize> {
    pub key_b16: String,
    pub data: T,
}

impl<T> IntoResponse for EncryptedJson<T>
where
    T: Serialize,
{
    fn into_response(self) -> Response {
        let serialized_response = serde_json::to_vec(&self.data)
            .expect("Failed serializing response to vec for encryption");

        let key: [u8; 32] = base16::decode(&self.key_b16).unwrap()[0..32]
            .try_into()
            .unwrap();

        let cipher = Aes256Gcm::new(&key.into());

        let nonce = Aes256Gcm::generate_nonce(&mut OsRng);

        let nonce_b16 = base16::encode_lower(&nonce);

        let encrypted_response = cipher
            .encrypt(&nonce, serialized_response.as_slice())
            .expect("Failed encrypting response");

        let mut response = Response::new(Body::from(encrypted_response));
        let response_headers = response.headers_mut();

        response_headers.insert("Content-Type", "application/octet-stream".parse().unwrap());
        response_headers.insert(NONCE, nonce_b16.parse().unwrap());

        response
    }
}
