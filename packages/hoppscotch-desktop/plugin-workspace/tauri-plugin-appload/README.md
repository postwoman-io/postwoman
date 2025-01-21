# Tauri Plugin: AppLoad

> A Tauri plugin for downloading and loading web app bundles into WebView.

<div align="center">

![GitHub License MIT](https://img.shields.io/github/license/CuriousCorrelation/tauri-plugin-appload)
![Tauri 2.0](https://img.shields.io/badge/Tauri-2.0-blue)
[![Rust](https://img.shields.io/badge/Rust-1.77.2+-orange)](https://www.rust-lang.org)

</div>

## Features

- 🦀 Blazingly fast!
- Download and load web app bundles from remote servers
- Secure verification using `ed25519` + `blake3`
- Caching with hot/cold storage strategy
- Custom URI scheme for isolated app loading

## Installation

> [!IMPORTANT]
> This plugin requires Tauri 2.0 or later.

Add the plugin to your project by installing directly from GitHub:

```toml
[dependencies]
tauri-plugin-appload = { git = "https://github.com/CuriousCorrelation/tauri-plugin-appload" }
```

``` json
"dependencies": {
  "@CuriousCorrelation/plugin-appload": "github:CuriousCorrelation/tauri-plugin-appload"
}
```

## Quick Start

### Rust

```rust
fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_appload::init())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

### JavaScript/TypeScript

```typescript
import { download, load } from '@CuriousCorrelation/plugin-appload'

// Download a bundle
const { bundleName } = await download({
  serverUrl: "https://example.com"
})

// Load the bundle in a new window
await load({
  bundleName,
  window: {
    title: "My App",
    width: 800,
    height: 600
  }
})
```

## Configuration

> [!NOTE]
> The plugin uses sensible defaults but can be customized via configuration.

| Option | Description | Default |
|--------|-------------|---------|
| `api.serverUrl` | Bundle server URL | `http://localhost:3200` |
| `cache.maxSize` | Maximum cache size | `100MB` |
| `cache.filesTtl` | File time-to-live | `1 hour` |
| `storage.maxBundleSize` | Maximum bundle size | `50MB` |

## Permissions

The plugin defines the following permissions:

- `allow-download`: Enable bundle downloads
- `allow-load`: Enable bundle loading
- `deny-download`: Disable bundle downloads 
- `deny-load`: Disable bundle loading

## Development

Requirements:
- Rust 1.77.2 or later
- Node.js 18 or later
- pnpm

## License

Code: (c) 2024 - CuriousCorrelation

MIT or MIT/Apache 2.0 where applicable.
