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
        if let Some(validate) = security.validate_certificates {
            self.handle
                .ssl_verify_peer(validate)
                .map_err(|e| RelayError::Certificate {
                    message: "Failed to set SSL verify peer".into(),
                    cause: Some(e.to_string()),
                })?;
        }

        if let Some(verify) = security.verify_host {
            self.handle
                .ssl_verify_host(verify)
                .map_err(|e| RelayError::Certificate {
                    message: "Failed to set SSL verify host".into(),
                    cause: Some(e.to_string()),
                })?;
        }

        if let Some(ref certs) = security.certificates {
            self.configure_certificates(certs)?;
        }

        Ok(())
    }

    #[tracing::instrument(skip(self), level = "debug")]
    fn configure_certificates(&mut self, certs: &CertificateConfig) -> Result<()> {
        if let Some(ref client_cert) = certs.client {
            match client_cert {
                CertificateType::Pem { cert, key } => {
                    tracing::trace!("Configuring PEM certificate");
                    self.handle.ssl_cert_type("PEM").map_err(|e| {
                        tracing::error!(error = %e, "Failed to set certificate type");
                        RelayError::Certificate {
                            message: "Failed to set certificate type".into(),
                            cause: Some(e.to_string()),
                        }
                    })?;

                    self.handle
                        .ssl_cert_blob(cert)
                        .map_err(|e| RelayError::Certificate {
                            message: "Failed to set client certificate".into(),
                            cause: Some(e.to_string()),
                        })?;

                    self.handle
                        .ssl_key_type("PEM")
                        .map_err(|e| RelayError::Certificate {
                            message: "Failed to set key type".into(),
                            cause: Some(e.to_string()),
                        })?;

                    self.handle
                        .ssl_key_blob(key)
                        .map_err(|e| RelayError::Certificate {
                            message: "Failed to set client key".into(),
                            cause: Some(e.to_string()),
                        })?;
                }
                CertificateType::Pfx { data, password } => {
                    tracing::trace!("Configuring PKCS#12 certificate");
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

                        self.handle.ssl_cert_type("PEM").map_err(|e| {
                            tracing::error!(error = %e, "Failed to set certificate type for PKCS#12");
                            RelayError::Certificate {
                                message: "Failed to set certificate type for PKCS#12".into(),
                                cause: Some(e.to_string()),
                            }
                        })?;

                        self.handle.ssl_cert_blob(&cert_pem).map_err(|e| {
                            tracing::error!(error = %e, "Failed to set PKCS#12 certificate");
                            RelayError::Certificate {
                                message: "Failed to set PKCS#12 certificate".into(),
                                cause: Some(e.to_string()),
                            }
                        })?;

                        self.handle.ssl_key_type("PEM").map_err(|e| {
                            tracing::error!(error = %e, "Failed to set key type for PKCS#12");
                            RelayError::Certificate {
                                message: "Failed to set key type for PKCS#12".into(),
                                cause: Some(e.to_string()),
                            }
                        })?;

                        self.handle.ssl_key_blob(&key_pem).map_err(|e| {
                            tracing::error!(error = %e, "Failed to set PKCS#12 private key");
                            RelayError::Certificate {
                                message: "Failed to set PKCS#12 private key".into(),
                                cause: Some(e.to_string()),
                            }
                        })?;
                    }
                }
            }
        }

        if let Some(ref ca_certs) = certs.ca {
            for (index, cert) in ca_certs.iter().enumerate() {
                tracing::trace!(cert_index = index, "Setting CA certificate");
                self.handle.ssl_cainfo_blob(cert).map_err(|e| {
                    tracing::error!(error = %e, cert_index = index, "Failed to set CA certificate");
                    RelayError::Certificate {
                        message: "Failed to set CA certificate".into(),
                        cause: Some(e.to_string()),
                    }
                })?;
            }
        }

        Ok(())
    }
}
