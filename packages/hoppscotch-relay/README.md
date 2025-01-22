# Hoppscotch Relay

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A high-performance HTTP request-response relay used by Hoppscotch Desktop and Hoppscotch Agent for advanced request handling including CORS override, custom headers, certificates, proxies, and local system integration. It uses a custom fork of curl-rust with static OpenSSL builds for consistent SSL/TLS behavior across different platforms.

## Features

- 🚀 **Full HTTP Support**: Handle GET, POST, PUT, DELETE, and other HTTP methods
- 📦 **Multiple Body Types**: 
  - Raw text/JSON
  - URL-encoded forms
  - Multipart form data
  - File uploads
- 🔒 **Security**:
  - Client certificate authentication (PEM & PFX/PKCS#12)
  - Custom root certificate bundles
  - Certificate validation control
- 🌐 **Proxy Support**:
  - HTTP/HTTPS proxy configuration
  - Authentication support
  - NTLM support
- ⚡ **Performance**:
  - Async design
  - Request cancellation support
  - Progress logs
- 📊 **Detailed Metrics**:
  - Response timing
  - Status tracking
  - Header parsing

## Installation

Add this to your `Cargo.toml`:

```toml
[dependencies]
hoppscotch-relay = "0.1.1"
```

## Usage

### Basic Request

```rust
use hoppscotch_relay::{RequestWithMetadata, KeyValuePair};
use tokio_util::sync::CancellationToken;

// Create a basic GET request
let request = RequestWithMetadata::new(
    1,                    // Request ID
    "GET".to_string(),    // Method
    "https://api.example.com/data".to_string(), // Endpoint
    vec![                 // Headers
        KeyValuePair {
            key: "Accept".to_string(),
            value: "application/json".to_string(),
        }
    ],
    None,                 // Body
    true,                 // Validate certificates
    vec![],              // Root certificate bundles
    None,                // Client certificate
    None,                // Proxy configuration
);

// Execute the request with cancellation support
let cancel_token = CancellationToken::new();
let response = hoppscotch_relay::run_request_task(&request, cancel_token)?;

println!("Status: {} {}", response.status, response.status_text);
println!("Response time: {}ms", response.time_end_ms - response.time_start_ms);
```

### POST Request with JSON Body

```rust
let mut request = RequestWithMetadata::new(
    2,
    "POST".to_string(),
    "https://api.example.com/users".to_string(),
    vec![
        KeyValuePair {
            key: "Content-Type".to_string(),
            value: "application/json".to_string(),
        }
    ],
    Some(BodyDef::Text(r#"{"name": "John Doe"}"#.to_string())),
    true,
    vec![],
    None,
    None,
);

let response = hoppscotch_relay::run_request_task(&request, CancellationToken::new())?;
```

### File Upload with Form Data

```rust
let form_data = vec![
    FormDataEntry {
        key: "file".to_string(),
        value: FormDataValue::File {
            filename: "document.pdf".to_string(),
            data: std::fs::read("document.pdf")?,
            mime: "application/pdf".to_string(),
        },
    },
    FormDataEntry {
        key: "description".to_string(),
        value: FormDataValue::Text("Important document".to_string()),
    },
];

let mut request = RequestWithMetadata::new(
    3,
    "POST".to_string(),
    "https://api.example.com/upload".to_string(),
    vec![],
    Some(BodyDef::FormData(form_data)),
    true,
    vec![],
    None,
    None,
);
```

### Client Certificate Authentication

```rust
let client_cert = ClientCertDef::PEMCert {
    certificate_pem: std::fs::read("client.crt")?,
    key_pem: std::fs::read("client.key")?,
};

let mut request = RequestWithMetadata::new(
    4,
    "GET".to_string(),
    "https://secure-api.example.com".to_string(),
    vec![],
    None,
    true,
    vec![],
    Some(client_cert),
    None,
);
```

### Proxy Configuration

```rust
let proxy_config = ProxyConfig {
    url: "http://proxy.example.com:8080".to_string(),
};

let mut request = RequestWithMetadata::new(
    5,
    "GET".to_string(),
    "https://api.example.com".to_string(),
    vec![],
    None,
    true,
    vec![],
    None,
    Some(proxy_config),
);
```

## Request Cancellation

The library supports request cancellation through Tokio's `CancellationToken`:

```rust
use tokio_util::sync::CancellationToken;

let cancel_token = CancellationToken::new();
let cancel_token_clone = cancel_token.clone();

// Spawn the request in a separate task
let request_handle = tokio::spawn(async move {
    hoppscotch_relay::run_request_task(&request, cancel_token_clone)
});

// Cancel the request after 5 seconds
tokio::time::sleep(Duration::from_secs(5)).await;
cancel_token.cancel();
```

## Building from Source

1. Clone the repository:
```bash
git clone https://github.com/hoppscotch/hoppscotch-relay
cd hoppscotch-relay
```

2. Build the project:
```bash
cargo build --release
```
