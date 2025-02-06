use bytes::Bytes;
use curl::easy::Easy;

use openssl::pkcs12::Pkcs12;

use crate::{
    error::{RelayError, Result},
    interop::{CertificateConfig, CertificateType, SecurityConfig},
};

pub(crate) struct SecurityHandler<'a> {
    handle: &'a mut Easy,
}

impl<'a> SecurityHandler<'a> {
    pub(crate) fn new(handle: &'a mut Easy) -> Self {
        Self { handle }
    }

    #[tracing::instrument(skip(self), level = "debug")]
    pub(crate) fn configure(&mut self, security: &SecurityConfig) -> Result<()> {
        tracing::info!("Configuring security settings");

        if let Some(validate) = security.validate_certificates {
            tracing::debug!(validate = validate, "Setting SSL verify peer");
            self.handle.ssl_verify_peer(validate).map_err(|e| {
                tracing::error!(error = %e, "Failed to set SSL verify peer");
                RelayError::Certificate {
                    message: "Failed to set SSL verify peer".into(),
                    cause: Some(e.to_string()),
                }
            })?;
        }

        if let Some(verify) = security.verify_host {
            tracing::debug!(verify = verify, "Setting SSL verify host");
            self.handle.ssl_verify_host(verify).map_err(|e| {
                tracing::error!(error = %e, "Failed to set SSL verify host");
                RelayError::Certificate {
                    message: "Failed to set SSL verify host".into(),
                    cause: Some(e.to_string()),
                }
            })?;
        }

        if let Some(ref certs) = security.certificates {
            self.configure_certificates(certs)?;
        }

        tracing::debug!("Security configuration complete");
        Ok(())
    }

    #[tracing::instrument(skip(self), level = "debug")]
    fn configure_certificates(&mut self, certs: &CertificateConfig) -> Result<()> {
        if let Some(ref client_cert) = certs.client {
            match client_cert {
                CertificateType::Pem { cert, key } => {
                    tracing::info!("Configuring PEM certificate");
                    self.configure_pem_certificate(cert, key)?;
                }
                CertificateType::Pfx { data, password } => {
                    tracing::info!("Configuring PKCS#12 certificate");
                    self.configure_pfx_certificate(data, password)?;
                }
            }
        }

        if let Some(ref ca_certs) = certs.ca {
            self.configure_ca_certificates(ca_certs)?;
        }

        Ok(())
    }

    fn configure_pem_certificate(&mut self, cert: &[u8], key: &[u8]) -> Result<()> {
        tracing::debug!("Setting PEM certificate type");
        self.handle.ssl_cert_type("PEM").map_err(|e| {
            tracing::error!(error = %e, "Failed to set certificate type");
            RelayError::Certificate {
                message: "Failed to set certificate type".into(),
                cause: Some(e.to_string()),
            }
        })?;

        tracing::debug!("Setting PEM certificate data");
        self.handle.ssl_cert_blob(cert).map_err(|e| {
            tracing::error!(error = %e, "Failed to set client certificate");
            RelayError::Certificate {
                message: "Failed to set client certificate".into(),
                cause: Some(e.to_string()),
            }
        })?;

        tracing::debug!("Setting PEM key type");
        self.handle.ssl_key_type("PEM").map_err(|e| {
            tracing::error!(error = %e, "Failed to set key type");
            RelayError::Certificate {
                message: "Failed to set key type".into(),
                cause: Some(e.to_string()),
            }
        })?;

        tracing::debug!("Setting PEM key data");
        self.handle.ssl_key_blob(key).map_err(|e| {
            tracing::error!(error = %e, "Failed to set client key");
            RelayError::Certificate {
                message: "Failed to set client key".into(),
                cause: Some(e.to_string()),
            }
        })?;

        Ok(())
    }

    fn configure_pfx_certificate(&mut self, data: &[u8], password: &str) -> Result<()> {
        let pkcs12 = Pkcs12::from_der(data).map_err(|e| {
            tracing::error!(error = %e, "Failed to parse PKCS#12 data");
            RelayError::Certificate {
                message: "Failed to parse PKCS#12 data".into(),
                cause: Some(e.to_string()),
            }
        })?;

        let parsed = pkcs12.parse2(password).map_err(|e| {
            tracing::error!(error = %e, "Failed to parse PKCS#12 password");
            RelayError::Certificate {
                message: "Failed to parse PKCS#12 password".into(),
                cause: Some(e.to_string()),
            }
        })?;

        if let (Some(cert), Some(key)) = (parsed.cert, parsed.pkey) {
            let cert_pem = cert.to_pem().map_err(|e| {
                tracing::error!(error = %e, "Failed to convert certificate to PEM");
                RelayError::Certificate {
                    message: "Failed to convert certificate to PEM".into(),
                    cause: Some(e.to_string()),
                }
            })?;

            let key_pem = key.private_key_to_pem_pkcs8().map_err(|e| {
                tracing::error!(error = %e, "Failed to convert private key to PEM");
                RelayError::Certificate {
                    message: "Failed to convert private key to PEM".into(),
                    cause: Some(e.to_string()),
                }
            })?;

            self.configure_pem_certificate(&cert_pem, &key_pem)
        } else {
            tracing::error!("PKCS#12 file missing certificate or private key");
            Err(RelayError::Certificate {
                message: "PKCS#12 file missing certificate or private key".into(),
                cause: None,
            })
        }
    }

    fn configure_ca_certificates(&mut self, ca_certs: &[Bytes]) -> Result<()> {
        for (index, cert) in ca_certs.iter().enumerate() {
            tracing::debug!(cert_index = index, "Setting CA certificate");
            self.handle.ssl_cainfo_blob(cert).map_err(|e| {
                tracing::error!(error = %e, cert_index = index, "Failed to set CA certificate");
                RelayError::Certificate {
                    message: format!("Failed to set CA certificate at index {}", index),
                    cause: Some(e.to_string()),
                }
            })?;
        }
        Ok(())
    }
}
