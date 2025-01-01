import * as E from 'fp-ts/Either';
import superjson from 'superjson';

import type { VersionedAPI } from '@type/versioning';
import {
    StoreV1,
    StoredData,
    StoredDataSchema,
    StoreEvents,
    StoreEventEmitter,
} from '@store/v/1';

class BrowserStoreManager {
    private static instance: BrowserStoreManager;
    private listeners = new Map<string, Set<(payload: StoreEvents['change']) => void>>();

    private constructor() {}

    static new(): BrowserStoreManager {
        if (!BrowserStoreManager.instance) {
            BrowserStoreManager.instance = new BrowserStoreManager();
        }
        return BrowserStoreManager.instance;
    }

    private getFullKey(namespace: string, key: string): string {
        return `${namespace}:${key}`;
    }

    private notifyListeners(namespace: string, key: string, value?: unknown) {
        const fullKey = this.getFullKey(namespace, key);
        const listeners = this.listeners.get(fullKey) || new Set();
        listeners.forEach(listener => listener({ namespace, key, value }));
    }

    async set(namespace: string, key: string, value: StoredData): Promise<void> {
        const validated = StoredDataSchema.parse(value);
        localStorage.setItem(this.getFullKey(namespace, key), superjson.stringify(validated));
        this.notifyListeners(namespace, key, validated.data);
    }

    async getRaw(namespace: string, key: string): Promise<StoredData | undefined> {
        const rawValue = localStorage.getItem(this.getFullKey(namespace, key));
        if (!rawValue) return undefined;

        const parsed = superjson.parse(rawValue);
        const validated = StoredDataSchema.parse(parsed);
        return validated;
    }

    async get<T>(namespace: string, key: string): Promise<T | undefined> {
        const storedData = await this.getRaw(namespace, key);
        return storedData?.data as T;
    }

    async has(namespace: string, key: string): Promise<boolean> {
        return localStorage.getItem(this.getFullKey(namespace, key)) !== null;
    }

    async delete(namespace: string, key: string): Promise<boolean> {
        const exists = await this.has(namespace, key);
        if (exists) {
            localStorage.removeItem(this.getFullKey(namespace, key));
            this.notifyListeners(namespace, key, undefined);
        }
        return exists;
    }

    async clear(namespace?: string): Promise<void> {
        if (namespace) {
            const keysToRemove = Object.keys(localStorage).filter(key => key.startsWith(`${namespace}:`));
            keysToRemove.forEach(key => localStorage.removeItem(key));
        } else {
            localStorage.clear();
        }
        this.listeners.clear();
    }

    async listNamespaces(): Promise<string[]> {
        const namespaces = new Set<string>();
        Object.keys(localStorage).forEach(key => {
            const [namespace] = key.split(':');
            namespaces.add(namespace);
        });
        return Array.from(namespaces);
    }

    async listKeys(namespace: string): Promise<string[]> {
        return Object.keys(localStorage)
            .filter(key => key.startsWith(`${namespace}:`))
            .map(key => key.replace(`${namespace}:`, ''));
    }

    watch(namespace: string, key: string): StoreEventEmitter<StoreEvents> {
        const fullKey = this.getFullKey(namespace, key);
        return {
            on: (event, handler) => {
                if (event !== 'change') return () => {};
                if (!this.listeners.has(fullKey)) {
                    this.listeners.set(fullKey, new Set());
                }
                this.listeners.get(fullKey)!.add(handler as (payload: StoreEvents['change']) => void);
                return () => this.listeners.get(fullKey)?.delete(handler as (payload: StoreEvents['change']) => void);
            },
            once: (event, handler) => {
                if (event !== 'change') return () => {};
                const wrapper = (payload: StoreEvents['change']) => {
                    handler(payload);
                    this.listeners.get(fullKey)?.delete(wrapper);
                };
                if (!this.listeners.has(fullKey)) {
                    this.listeners.set(fullKey, new Set());
                }
                this.listeners.get(fullKey)!.add(wrapper);
                return () => this.listeners.get(fullKey)?.delete(wrapper);
            },
            off: (event, handler) => {
                if (event === 'change') {
                    this.listeners.get(fullKey)?.delete(handler as (payload: StoreEvents['change']) => void);
                }
            },
        };
    }
}

export const implementation: VersionedAPI<StoreV1> = {
    version: { major: 1, minor: 0, patch: 0 },
    api: {
        id: 'browser-store',
        capabilities: new Set(['permanent', 'structured', 'watch', 'namespace']),

        async init() {
            try {
                return E.right(undefined);
            } catch (e) {
                return E.left({
                    kind: 'storage',
                    message: e instanceof Error ? e.message : 'Unknown error',
                    cause: e,
                });
            }
        },

        async set(namespace, key, value, options) {
            try {
                const manager = BrowserStoreManager.new();
                const existingData = await manager.getRaw(namespace, key);
                const createdAt = existingData?.metadata.createdAt || new Date().toISOString()
                const updatedAt = new Date().toISOString()

                const storedData: StoredData = {
                    schemaVersion: 1,
                    metadata: {
                        createdAt,
                        updatedAt,
                        namespace,
                        encrypted: options?.encrypt,
                        compressed: options?.compress,
                        ttl: options?.ttl,
                    },
                    data: value,
                };

                await manager.set(namespace, key, storedData);
                return E.right(undefined);
            } catch (e) {
                return E.left({
                    kind: 'storage',
                    message: e instanceof Error ? e.message : 'Unknown error',
                    cause: e,
                });
            }
        },

        async get(namespace, key) {
            try {
                const manager = BrowserStoreManager.new();
                return E.right(await manager.get(namespace, key));
            } catch (e) {
                return E.left({
                    kind: 'storage',
                    message: e instanceof Error ? e.message : 'Unknown error',
                    cause: e,
                });
            }
        },

        async has(namespace, key) {
            try {
                const manager = BrowserStoreManager.new();
                return E.right(await manager.has(namespace, key));
            } catch (e) {
                return E.left({
                    kind: 'storage',
                    message: e instanceof Error ? e.message : 'Unknown error',
                    cause: e,
                });
            }
        },

        async remove(namespace, key) {
            try {
                const manager = BrowserStoreManager.new();
                return E.right(await manager.delete(namespace, key));
            } catch (e) {
                return E.left({
                    kind: 'storage',
                    message: e instanceof Error ? e.message : 'Unknown error',
                    cause: e,
                });
            }
        },

        async clear(namespace) {
            try {
                const manager = BrowserStoreManager.new();
                await manager.clear(namespace);
                return E.right(undefined);
            } catch (e) {
                return E.left({
                    kind: 'storage',
                    message: e instanceof Error ? e.message : 'Unknown error',
                    cause: e,
                });
            }
        },

        async listNamespaces() {
            try {
                const manager = BrowserStoreManager.new();
                return E.right(await manager.listNamespaces());
            } catch (e) {
                return E.left({
                    kind: 'storage',
                    message: e instanceof Error ? e.message : 'Unknown error',
                    cause: e,
                });
            }
        },

        async listKeys(namespace) {
            try {
                const manager = BrowserStoreManager.new();
                return E.right(await manager.listKeys(namespace));
            } catch (e) {
                return E.left({
                    kind: 'storage',
                    message: e instanceof Error ? e.message : 'Unknown error',
                    cause: e,
                });
            }
        },

        watch(namespace, key) {
            const manager = BrowserStoreManager.new();
            return manager.watch(namespace, key);
        },
    },
};
