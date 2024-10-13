use aes_gcm::{aead::Aead, AeadCore, Aes256Gcm, KeyInit};
use axum::{body::Body, response::{IntoResponse, Response}};
use rand::rngs::OsRng;
use serde::Serialize;

pub fn get_status_text(status: u16) -> &'static str {
    http::StatusCode::from_u16(status)
        .map(|status| status.canonical_reason())
        .unwrap_or(Some("Unknown Status"))
        .unwrap_or("Unknown Status")
}

#[derive(Debug)]
pub struct EncryptedJson<T: Serialize> {
  pub key_b16: String,
  pub data: T
}

impl<T> IntoResponse for EncryptedJson<T> where T: Serialize {
    fn into_response(self) -> Response {
      let serialized_response = serde_json::to_vec(&self.data)
        .expect("Failed serializing response to vec for encryption");

      let key: [u8; 32] = base16::decode(&self.key_b16)
          .unwrap()
          [0..32]
          .try_into()
          .unwrap();

      let cipher = Aes256Gcm::new(&key.into());

      let nonce = Aes256Gcm::generate_nonce(&mut OsRng);

      let nonce_b16 = base16::encode_lower(&nonce);

      let encrypted_response = cipher.encrypt(&nonce, serialized_response.as_slice())
        .expect("Failed encrypting response");

      let mut response = Response::new(Body::from(encrypted_response));
      let response_headers = response.headers_mut();

      response_headers.insert("Content-Type", "application/octet-stream".parse().unwrap());
      response_headers.insert("X-Hopp-Nonce", nonce_b16.parse().unwrap());

      response
    }
}
