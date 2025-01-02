import * as E from 'fp-ts/Either';

import { Store } from '@tauri-apps/plugin-store';

import { VersionedAPI } from '@type/versioning';
import {
    StoreV1,
    StoreError,
    StoreEvents,
    StorageOptions,
    StoredData,
    StoredDataSchema,
    StoreEventEmitter,
} from '@store/v/1';

const STORE_PATH = `${window.location.host}.hoppscotch.store`

type NamespacedData = Record<string, Record<string, StoredData>>;

class TauriStoreManager {
    private static instance: TauriStoreManager;
    private store: Store | null = null;
    private listeners = new Map<string, Set<(payload: StoreEvents['change']) => void>>();
    private data: NamespacedData = {};

    private constructor() {}

    static new(): TauriStoreManager {
        if (!TauriStoreManager.instance) {
            TauriStoreManager.instance = new TauriStoreManager();
        }
        return TauriStoreManager.instance;
    }

    async init(): Promise<void> {
        if (!this.store) {
            this.store = await Store.load(STORE_PATH);
            const loadedData = await this.store.get<NamespacedData>('data');
            this.data = loadedData ?? {};

            this.store.onChange((_, value: NamespacedData | undefined) => {
                if (value) {
                    this.data = value;
                    this.notifyListeners();
                }
            });
        }
    }

    private notifyListeners(): void {
        for (const [key, listeners] of this.listeners.entries()) {
            const [namespace, dataKey] = key.split(':');
            const value = this.data[namespace]?.[dataKey];
            listeners.forEach(listener =>
                listener({
                    namespace,
                    key: dataKey,
                    value: value?.data,
                })
            );
        }
    }

    async set(namespace: string, key: string, value: StoredData): Promise<void> {
        if (!this.store) throw new Error('Store not initialized');

        const validated = StoredDataSchema.parse(value);
        this.data[namespace] = this.data[namespace] || {};
        this.data[namespace][key] = validated;
        await this.store.set('data', this.data);
        await this.store.save();
    }

    async getRaw(namespace: string, key: string): Promise<StoredData | undefined> {
        const rawValue = this.data[namespace]?.[key];
        if (!rawValue) return undefined;

        const validated = StoredDataSchema.parse(rawValue);
        return validated;
    }

    async get<T>(namespace: string, key: string): Promise<T | undefined> {
        const storedData = await this.getRaw(namespace, key);
        return storedData?.data as T | undefined;
    }

    async has(namespace: string, key: string): Promise<boolean> {
        return !!this.data[namespace]?.[key];
    }

    async delete(namespace: string, key: string): Promise<boolean> {
        if (!this.store) throw new Error('Store not initialized');

        if (this.data[namespace]?.[key]) {
            delete this.data[namespace][key];
            if (Object.keys(this.data[namespace]).length === 0) {
                delete this.data[namespace];
            }
            await this.store.set('data', this.data);
            await this.store.save();
            return true;
        }
        return false;
    }

    async clear(namespace?: string): Promise<void> {
        if (!this.store) throw new Error('Store not initialized');

        if (namespace) {
            delete this.data[namespace];
        } else {
            this.data = {};
        }
        await this.store.set('data', this.data);
        await this.store.save();
    }

    async listNamespaces(): Promise<string[]> {
        return Object.keys(this.data);
    }

    async listKeys(namespace: string): Promise<string[]> {
        return Object.keys(this.data[namespace] || {});
    }

    watch(namespace: string, key: string): StoreEventEmitter<StoreEvents> {
        const watchKey = `${namespace}:${key}`;
        return {
            on: <K extends keyof StoreEvents>(
                event: K,
                handler: (payload: StoreEvents[K]) => void
            ) => {
                if (event !== 'change') return () => {};

                if (!this.listeners.has(watchKey)) {
                    this.listeners.set(watchKey, new Set());
                }
                this.listeners.get(watchKey)!.add(handler as (payload: StoreEvents['change']) => void);
                return () => this.listeners.get(watchKey)?.delete(handler as (payload: StoreEvents['change']) => void);
            },
            once: <K extends keyof StoreEvents>(
                event: K,
                handler: (payload: StoreEvents[K]) => void
            ) => {
                if (event !== 'change') return () => {};

                const wrapper = (value: StoreEvents['change']) => {
                    handler(value as StoreEvents[K]);
                    this.listeners.get(watchKey)?.delete(wrapper);
                };

                if (!this.listeners.has(watchKey)) {
                    this.listeners.set(watchKey, new Set());
                }
                this.listeners.get(watchKey)!.add(wrapper);
                return () => this.listeners.get(watchKey)?.delete(wrapper);
            },
            off: <K extends keyof StoreEvents>(
                event: K,
                handler: (payload: StoreEvents[K]) => void
            ) => {
                if (event === 'change') {
                    this.listeners.get(watchKey)?.delete(handler as (payload: StoreEvents['change']) => void);
                }
            },
        };
    }

    async close(): Promise<void> {
        if (this.store) {
            await this.store.close();
            this.store = null;
            this.data = {};
            this.listeners.clear();
        }
    }
}

export const implementation: VersionedAPI<StoreV1> = {
    version: { major: 1, minor: 0, patch: 0 },
    api: {
        id: 'tauri-store',
        capabilities: new Set(['permanent', 'structured', 'watch', 'namespace', 'secure']),

        async init() {
            try {
                const manager = TauriStoreManager.new();
                await manager.init();
                return E.right(undefined);
            } catch (error) {
                return E.left({
                    kind: 'storage',
                    message: error instanceof Error ? error.message : 'Unknown error',
                    cause: error,
                });
            }
        },

        async set(namespace: string, key: string, value: unknown, options?: StorageOptions): Promise<E.Either<StoreError, void>> {
            try {
                const manager = TauriStoreManager.new();
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
            } catch (error) {
                return E.left({
                    kind: 'storage',
                    message: error instanceof Error ? error.message : 'Unknown error',
                    cause: error,
                });
            }
        },

        async get<T>(namespace: string, key: string): Promise<E.Either<StoreError, T | undefined>> {
            try {
                const manager = TauriStoreManager.new();
                return E.right(await manager.get<T>(namespace, key));
            } catch (error) {
                return E.left({
                    kind: 'storage',
                    message: error instanceof Error ? error.message : 'Unknown error',
                    cause: error,
                });
            }
        },

        async has(namespace: string, key: string): Promise<E.Either<StoreError, boolean>> {
            try {
                const manager = TauriStoreManager.new();
                return E.right(await manager.has(namespace, key));
            } catch (error) {
                return E.left({
                    kind: 'storage',
                    message: error instanceof Error ? error.message : 'Unknown error',
                    cause: error,
                });
            }
        },

        async remove(namespace: string, key: string): Promise<E.Either<StoreError, boolean>> {
            try {
                const manager = TauriStoreManager.new();
                return E.right(await manager.delete(namespace, key));
            } catch (error) {
                return E.left({
                    kind: 'storage',
                    message: error instanceof Error ? error.message : 'Unknown error',
                    cause: error,
                });
            }
        },

        async clear(namespace?: string): Promise<E.Either<StoreError, void>> {
            try {
                const manager = TauriStoreManager.new();
                await manager.clear(namespace);
                return E.right(undefined);
            } catch (error) {
                return E.left({
                    kind: 'storage',
                    message: error instanceof Error ? error.message : 'Unknown error',
                    cause: error,
                });
            }
        },

        async listNamespaces(): Promise<E.Either<StoreError, string[]>> {
            try {
                const manager = TauriStoreManager.new();
                return E.right(await manager.listNamespaces());
            } catch (error) {
                return E.left({
                    kind: 'storage',
                    message: error instanceof Error ? error.message : 'Unknown error',
                    cause: error,
                });
            }
        },

        async listKeys(namespace: string): Promise<E.Either<StoreError, string[]>> {
            try {
                const manager = TauriStoreManager.new();
                return E.right(await manager.listKeys(namespace));
            } catch (error) {
                return E.left({
                    kind: 'storage',
                    message: error instanceof Error ? error.message : 'Unknown error',
                    cause: error,
                });
            }
        },

        watch(namespace: string, key: string): StoreEventEmitter<StoreEvents> {
            const manager = TauriStoreManager.new();
            return manager.watch(namespace, key);
        },
    },
};
