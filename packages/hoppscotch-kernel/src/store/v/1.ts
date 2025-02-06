import type { VersionedAPI } from '@type/versioning'
import * as E from 'fp-ts/Either'
import { z } from 'zod'

export type StoreCapability =
  | 'permanent'
  | 'temporary'
  | 'structured'
  | 'sync'
  | 'watch'
  | 'secure'
  | 'namespace'

export type StoreError =
  | { kind: 'not_found'; message: string }
  | { kind: 'permission'; message: string }
  | { kind: 'quota'; message: string }
  | { kind: 'version'; message: string }
  | { kind: 'parse'; message: string; cause?: unknown }
  | { kind: 'storage'; message: string; cause?: unknown }
  | { kind: 'encrypt'; message: string; cause?: unknown }

export interface StoreFile {
  include?: boolean,

  name: string
  size: number

  lastModified: string
  content: Uint8Array
}

export interface StorageOptions {
  encrypt?: boolean
  temporary?: boolean
  compress?: boolean
  ttl?: number
}

export interface StoreEvents {
  change: {
    namespace: string
    key: string
    value?: unknown
  }
}

export const StoreMetadataSchema = z.object({
  version: z.number(),
  lastUpdated: z.string().datetime(),
  namespaces: z.record(z.object({
    name: z.string(),
    version: z.number(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
    keys: z.array(z.string())
  }))
})

export type StoreMetadata = z.infer<typeof StoreMetadataSchema>

export const StoredDataSchema = z.object({
  schemaVersion: z.number(),
  metadata: z.object({
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
    namespace: z.string(),
    encrypted: z.boolean().optional(),
    compressed: z.boolean().optional(),
    ttl: z.number().optional()
  }),
  data: z.unknown()
})

export type StoredData = z.infer<typeof StoredDataSchema>

export interface StoreEventEmitter<T> {
  on<K extends keyof T>(event: K, handler: (payload: T[K]) => void): () => void
  once<K extends keyof T>(event: K, handler: (payload: T[K]) => void): () => void
  off<K extends keyof T>(event: K, handler: (payload: T[K]) => void): void
}

export interface StoreV1 {
  readonly id: string
  readonly capabilities: Set<StoreCapability>

  init(): Promise<E.Either<StoreError, void>>
  set(namespace: string, key: string, value: unknown, options?: StorageOptions): Promise<E.Either<StoreError, void>>
  get<T>(namespace: string, key: string): Promise<E.Either<StoreError, T | undefined>>
  remove(namespace: string, key: string): Promise<E.Either<StoreError, boolean>>
  clear(namespace?: string): Promise<E.Either<StoreError, void>>
  has(namespace: string, key: string): Promise<E.Either<StoreError, boolean>>
  listNamespaces(): Promise<E.Either<StoreError, string[]>>
  listKeys(namespace: string): Promise<E.Either<StoreError, string[]>>
  watch(namespace: string, key: string): StoreEventEmitter<StoreEvents>
}

export const v1: VersionedAPI<StoreV1> = {
  version: { major: 1, minor: 0, patch: 0 },
  api: {
    id: 'default',
    capabilities: new Set(),

    init: async () => E.left({ kind: 'version', message: 'Not implemented' }),
    set: async () => E.left({ kind: 'version', message: 'Not implemented' }),
    get: async () => E.left({ kind: 'version', message: 'Not implemented' }),
    remove: async () => E.left({ kind: 'version', message: 'Not implemented' }),
    clear: async () => E.left({ kind: 'version', message: 'Not implemented' }),
    has: async () => E.left({ kind: 'version', message: 'Not implemented' }),
    listNamespaces: async () => E.left({ kind: 'version', message: 'Not implemented' }),
    listKeys: async () => E.left({ kind: 'version', message: 'Not implemented' }),
    watch: () => ({
      on: () => () => {},
      once: () => () => {},
      off: () => {}
    })
  }
}
