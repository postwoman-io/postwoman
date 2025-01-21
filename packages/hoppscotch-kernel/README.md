# Hoppscotch Kernel

Cross-platform abstraction kernel for Hoppscotch, a unified interface between application logic and platform-specific implementations.

## Architecture

The kernel acts as a thin abstraction layer, mediating between high-level application logic and low-level platform implementations, similar to how operating system kernels abstract over hardware details. This helps the core Hoppscotch app be platform-agnostic while maintaining near native performance.

This codebase is minimal by design, providing just the building blocks for constructing features. If possible, always try composition before modifying the kernel directly.

## Modules

### IO Module
File system and external resource handling:

```typescript
interface IoV1 {
  saveFileWithDialog(opts: SaveFileWithDialogOptions): Promise<SaveFileResponse>
  openExternalLink(opts: OpenExternalLinkOptions): Promise<OpenExternalLinkResponse>
  listen<T>(event: string, handler: EventCallback<T>): Promise<UnlistenFn>
}
```

### Relay Module
Network operations with platform-specific optimizations:

```typescript
interface RelayV1 {
  readonly capabilities: RelayCapabilities
  execute(request: RelayRequest): {
    cancel: () => Promise<void>
    emitter: RelayEventEmitter<RelayRequestEvents>
    response: Promise<Either<RelayError, RelayResponse>>
  }
}
```

### Store Module
Cross-platform persistence with encryption support:

```typescript
interface StoreV1 {
  readonly capabilities: Set<StoreCapability>
  set(namespace: string, key: string, value: unknown, options?: StorageOptions): Promise<Either<StoreError, void>>
  watch(namespace: string, key: string): StoreEventEmitter<StoreEvents>
}
```

## Usage

### Kernel Initialization

```typescript
import { initKernel } from '@hoppscotch/kernel'

// Platform-specific initialization
const kernel = initKernel('web' | 'desktop')
```

### Network Operations

```typescript
import { RelayRequest } from '@hoppscotch/kernel'

const request: RelayRequest = {
  id: 1,
  url: "https://api.example.com",
  method: "GET",
  version: "HTTP/1.1",
  headers: { 
    "Content-Type": "application/json" 
  }
}

// Execute with capability checks
const { response, cancel } = kernel.relay.execute(request)
```

### Storage Operations

```typescript
// Encrypted storage with compression
await kernel.store.set("collections", "team-a", data, {
  encrypt: true,
  compress: true
})

// Watch for changes
kernel.store.watch("collections", "team-a").on("change", 
  (update) => console.log("Collection updated:", update)
)
```

### File Operations

```typescript
// Platform-agnostic file save
await kernel.io.saveFileWithDialog({
  data: new Uint8Array([...]),
  suggestedFilename: "export.json",
  contentType: "application/json"
})
```
