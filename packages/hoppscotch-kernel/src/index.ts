import type { Version } from './type/versioning'

import { VERSIONS as IO_VERSIONS } from './io'
import { IO_IMPLS as WEB_IO_IMPLS } from './io/impl/web'
import { IO_IMPLS as DESKTOP_IO_IMPLS } from './io/impl/desktop'

import { VERSIONS as RELAY_VERSIONS } from './relay'
import { RELAY_IMPLS as WEB_RELAY_IMPLS } from './relay/impl/web'
import { RELAY_IMPLS as DESKTOP_RELAY_IMPLS } from './relay/impl/desktop'

import { VERSIONS as STORE_VERSIONS } from './store'
import { STORE_IMPLS as WEB_STORE_IMPLS } from './store/impl/web'
import { STORE_IMPLS as DESKTOP_STORE_IMPLS } from './store/impl/desktop'

export interface KernelInfo {
  name: string
  version: Version
  capabilities: string[]
}

export interface KernelAPI {
  info: KernelInfo
  io: typeof IO_VERSIONS.v1.api
  relay: typeof RELAY_VERSIONS.v1.api
  store: typeof STORE_VERSIONS.v1.api
}

export type KernelMode = 'web' | 'desktop'

declare global {
  interface Window {
    __KERNEL__?: KernelAPI
    __KERNEL_MODE__?: KernelMode
  }
}

export function getKernelMode(): KernelMode {
  return window.__KERNEL_MODE__ || "web"
}

export function initKernel(mode?: KernelMode): KernelAPI {
  if (mode === 'desktop') {
    const kernel: KernelAPI = {
      info: {
        name: "desktop-kernel",
        version: { major: 1, minor: 0, patch: 0 },
        capabilities: ["basic-io"]
      },
      io: DESKTOP_IO_IMPLS.v1.api,
      relay: DESKTOP_RELAY_IMPLS.v1.api,
      store: DESKTOP_STORE_IMPLS.v1.api
    }

    window.__KERNEL__ = kernel
    return kernel
  } else {
    const kernel: KernelAPI = {
      info: {
        name: "web-kernel",
        version: { major: 1, minor: 0, patch: 0 },
        capabilities: ["basic-io"]
      },
      io: WEB_IO_IMPLS.v1.api,
      relay: WEB_RELAY_IMPLS.v1.api,
      store: WEB_STORE_IMPLS.v1.api
    }

    window.__KERNEL__ = kernel
    return kernel
  }
}

export type {
  SaveFileWithDialogOptions,
  SaveFileResponse,
  OpenExternalLinkOptions,
  OpenExternalLinkResponse,
  Event,
  EventCallback,
  UnlistenFn,
  IoV1,
} from '@io/v/1'

export type {
  RelayRequest,
  RelayResponse,
  RelayResponseBody,
  FormData,
  FormDataValue,
  RelayError,
  RelayV1,
  Method,
  Version,
  ContentType,
  AuthType,
  CertificateType,
  RelayCapabilities,
  RelayEventEmitter,
  RelayRequestEvents,
  StatusCode
} from '@relay/v/1'

export {
  content,
  body,
  MediaType,
} from '@relay/v/1'

export type {
  StoreCapability,
  StoreError,
  StoreFile,
  StorageOptions,
  StoreEvents,
  StoreMetadataSchema,
  StoreMetadata,
  StoredDataSchema,
  StoredData,
  StoreEventEmitter,
  StoreV1,
} from '@store/v/1'
