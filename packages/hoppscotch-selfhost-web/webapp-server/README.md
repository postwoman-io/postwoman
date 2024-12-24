# Hoppscotch Webapp Server

A secure static web server for Hoppscotch Webapp with content bundling (`zstd` + `zip`) and verification (`blake3` + `ed25519`).

## Quick Start

```bash
# Build from source
cargo build --release

# or use Docker
docker build -t hoppscotch-webapp-server .
```

> [!note] 
> Configuration via environment variables:
> - `FRONTEND_PATH`: UI assets build location
> - `DEFAULT_PORT`: Server port (default: 3200)

## API Endpoints

- Health check: `GET /health`
- Bundle manifest: `GET /api/v1/manifest` 
- Download bundle: `GET /api/v1/bundle`
- Public key info: `GET /api/v1/key`

## Development

```bash
cargo watch -x run     # Dev build with hot reload
cargo test            # Run tests
cargo build --release # Production build
```
