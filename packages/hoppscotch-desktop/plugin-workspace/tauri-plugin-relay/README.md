# Tauri Plugin: Relay

> A HTTP request-response relay plugin for Tauri apps, providing advanced request handling capabilities including custom headers, certificates, proxies, and local system integration.

<div align="center">

![GitHub License MIT](https://img.shields.io/github/license/CuriousCorrelation/tauri-plugin-relay)
![Tauri 2.0](https://img.shields.io/badge/Tauri-2.0-blue)
[![Rust](https://img.shields.io/badge/Rust-1.77.2+-orange)](https://www.rust-lang.org)

</div>

## Features

- 🦀 Blazingly fast!
- HTTP client built on libcurl
- Security with SSL/TLS certificate management
- Proxy support
- Multiple authentication methods (Basic, Bearer, Digest)
- Content handling (JSON, Form Data, Binary)
- Async request execution with cancellation support

## Installation

> [!IMPORTANT]
> This plugin requires Tauri 2.0 or later.

Add the plugin to your project by installing directly from GitHub:

```toml
[dependencies]
tauri-plugin-relay = { git = "https://github.com/CuriousCorrelation/tauri-plugin-relay" }
```
``` json
"dependencies": {
  "@CuriousCorrelation/plugin-relay": "github:CuriousCorrelation/tauri-plugin-relay"
}
```

## Quick Start

### Rust

```rust
fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_relay::init())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

### JavaScript/TypeScript

```typescript
import { execute, cancel } from '@CuriousCorrelation/plugin-relay'

// Execute a request
const result = await execute({
  id: 1,
  url: "https://api.example.com/data",
  method: "POST",
  headers: {
    "Content-Type": ["application/json"]
  },
  content: {
    kind: "json",
    content: { hello: "world" }
  }
})

// Cancel a request
await cancel(1)
```

## Content Types

The plugin supports multiple content types for requests:

| Type | Description |
|------|-------------|
| `text` | Plain text content |
| `json` | JSON data with automatic parsing |
| `form` | Multipart form data with file support |
| `binary` | Raw binary data with optional MIME type |
| `urlencoded` | URL-encoded form data |

## Authentication

Built-in support for various authentication methods:

| Method | Description |
|--------|-------------|
| `basic` | Basic HTTP authentication |
| `bearer` | Bearer token authentication |
| `digest` | Digest authentication (MD5, SHA-256, SHA-512) |

## Security

The plugin provides extensive security options:

- Client certificate support (PEM, PKCS#12)
- Custom CA certificates
- Certificate validation control
- Host verification settings

## Development

Requirements:
- Rust 1.77.2 or later
- Node.js 18 or later
- pnpm
- libcurl with SSL support

## Error Handling

The plugin provides detailed error information for:

- Network failures
- Certificate issues
- Timeout scenarios
- Parse errors
- Request cancellations

## License

Code: (c) 2024 - CuriousCorrelation

MIT or MIT/Apache 2.0 where applicable.
