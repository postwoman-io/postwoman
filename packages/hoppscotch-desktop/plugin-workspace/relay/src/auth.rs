use std::collections::HashMap;

use curl::easy::Easy;

use crate::{
    error::{RelayError, Result},
    header::HeadersBuilder,
    interop::{AuthType, GrantType, TokenResponse},
};

pub(crate) struct AuthHandler<'a> {
    handle: &'a mut Easy,
}

impl<'a> AuthHandler<'a> {
    pub(crate) fn new(handle: &'a mut Easy) -> Self {
        Self { handle }
    }

    #[tracing::instrument(skip(self), level = "debug")]
    pub(crate) fn set_auth(&mut self, auth: &AuthType) -> Result<()> {
        match auth {
            AuthType::Basic { username, password } => {
                tracing::trace!(username = %username, "Setting basic auth");
                self.set_basic_auth(username, password)
            }
            AuthType::Bearer { token } => {
                tracing::trace!("Setting bearer auth");
                self.set_bearer_auth(token)
            }
            AuthType::Digest {
                username, password, ..
            } => {
                tracing::trace!(username = %username, "Setting digest auth");
                self.set_digest_auth(username, password)
            }
            AuthType::OAuth2 {
                grant_type,
                access_token,
                refresh_token,
            } => {
                if let Some(token) = access_token {
                    tracing::trace!("Using existing OAuth2 access token");
                    self.set_bearer_auth(token)
                } else if let Some(refresh_token) = refresh_token {
                    tracing::trace!("Refreshing OAuth2 token");
                    self.refresh_oauth2_token(grant_type, refresh_token)
                } else {
                    tracing::trace!("Initiating OAuth2 flow");
                    self.handle_oauth2_flow(grant_type)
                }
            }
            AuthType::None => {
                tracing::trace!("No authentication required");
                Ok(())
            }
        }
    }

    fn set_basic_auth(&mut self, username: &str, password: &str) -> Result<()> {
        self.handle
            .username(username)
            .map_err(|e| RelayError::Network {
                message: "Failed to set username".into(),
                cause: Some(e.to_string()),
            })?;

        self.handle
            .password(password)
            .map_err(|e| RelayError::Network {
                message: "Failed to set password".into(),
                cause: Some(e.to_string()),
            })
    }

    fn set_bearer_auth(&mut self, token: &str) -> Result<()> {
        HeadersBuilder::new(self.handle).add_headers(Some(&HashMap::from([(
            "Authorization".to_string(),
            vec![format!("Bearer {}", token)],
        )])))
    }

    fn set_digest_auth(&mut self, username: &str, password: &str) -> Result<()> {
        self.set_basic_auth(username, password)?;
        let mut auth = curl::easy::Auth::new();
        auth.digest(true);
        self.handle
            .http_auth(&auth)
            .map_err(|e| RelayError::Network {
                message: "Failed to set digest authentication".into(),
                cause: Some(e.to_string()),
            })
    }

    fn handle_oauth2_flow(&mut self, grant_type: &GrantType) -> Result<()> {
        match grant_type {
            GrantType::ClientCredentials {
                token_endpoint,
                client_id,
                client_secret,
            } => self.client_credentials_flow(token_endpoint, client_id, client_secret.as_deref()),
            GrantType::Password {
                token_endpoint,
                username,
                password,
            } => self.password_flow(token_endpoint, username, password),
            GrantType::AuthorizationCode { .. } => Err(RelayError::UnsupportedFeature {
                feature: "Authorization Code Grant".into(),
                message: "Authorization Code flow requires browser interaction".into(),
                relay: "curl".into(),
            }),
            GrantType::Implicit { .. } => Err(RelayError::UnsupportedFeature {
                feature: "Implicit Grant".into(),
                message: "Implicit flow requires browser interaction".into(),
                relay: "curl".into(),
            }),
        }
    }

    fn client_credentials_flow(
        &mut self,
        token_endpoint: &str,
        client_id: &str,
        client_secret: Option<&str>,
    ) -> Result<()> {
        let mut params = vec![
            ("grant_type", "client_credentials"),
            ("client_id", client_id),
        ];

        if let Some(secret) = client_secret {
            params.push(("client_secret", secret));
        }

        self.request_token(token_endpoint, &params)
    }

    fn password_flow(
        &mut self,
        token_endpoint: &str,
        username: &str,
        password: &str,
    ) -> Result<()> {
        let params = vec![
            ("grant_type", "password"),
            ("username", username),
            ("password", password),
        ];

        self.request_token(token_endpoint, &params)
    }

    fn refresh_oauth2_token(&mut self, grant_type: &GrantType, refresh_token: &str) -> Result<()> {
        let token_endpoint = match grant_type {
            GrantType::ClientCredentials { token_endpoint, .. }
            | GrantType::Password { token_endpoint, .. }
            | GrantType::AuthorizationCode { token_endpoint, .. } => token_endpoint,
            GrantType::Implicit { .. } => {
                return Err(RelayError::UnsupportedFeature {
                    feature: "Token Refresh".into(),
                    message: "Implicit grant does not support refresh tokens".into(),
                    relay: "curl".into(),
                })
            }
        };

        let params = vec![
            ("grant_type", "refresh_token"),
            ("refresh_token", refresh_token),
        ];

        self.request_token(token_endpoint, &params)
    }

    fn request_token(&mut self, token_endpoint: &str, params: &[(&str, &str)]) -> Result<()> {
        let mut handle = Easy::new();

        handle
            .url(token_endpoint)
            .map_err(|e| RelayError::Network {
                message: "Failed to set token endpoint URL".into(),
                cause: Some(e.to_string()),
            })?;

        let form_data: String = params
            .iter()
            .map(|(k, v)| format!("{}={}", urlencoding::encode(k), urlencoding::encode(v)))
            .collect::<Vec<_>>()
            .join("&");

        handle
            .post_fields_copy(form_data.as_bytes())
            .map_err(|e| RelayError::Network {
                message: "Failed to set form data".into(),
                cause: Some(e.to_string()),
            })?;

        let mut response = Vec::new();
        {
            let mut transfer = handle.transfer();
            transfer
                .write_function(|data| {
                    response.extend_from_slice(data);
                    Ok(data.len())
                })
                .map_err(|e| RelayError::Network {
                    message: "Failed to set write callback".into(),
                    cause: Some(e.to_string()),
                })?;

            transfer.perform().map_err(|e| RelayError::Network {
                message: "Failed to perform token request".into(),
                cause: Some(e.to_string()),
            })?;
        }

        let token_response: TokenResponse =
            serde_json::from_slice(&response).map_err(|e| RelayError::Parse {
                message: "Failed to parse token response".into(),
                cause: Some(e.to_string()),
            })?;

        self.set_bearer_auth(&token_response.access_token)
    }
}
