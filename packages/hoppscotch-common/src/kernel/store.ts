import { StorageOptions, StoreCapability, StoreError } from "@hoppscotch/kernel"
import * as E from 'fp-ts/Either'

export const Store = {
  capabilities(): StoreCapability {
    if (!window.__KERNEL__) {
      throw new Error("Kernel is not initialized")
    }
    if (!window.__KERNEL__?.store) {
      throw new Error("Kernel store is not initialized")
    }
    return window.__KERNEL__.store.capabilities
  },

  init() {
    if (!window.__KERNEL__) {
      throw new Error("Kernel is not initialized")
    }
    if (!window.__KERNEL__?.store) {
      throw new Error("Kernel store is not initialized")
    }
    console.log("Kernel found, executing namespace")
    return window.__KERNEL__.store.init()
  },

  set(namespace: string, key: string, value: unknown, options?: StorageOptions) {
    if (!window.__KERNEL__) {
      throw new Error("Kernel is not initialized")
    }
    if (!window.__KERNEL__?.store) {
      throw new Error("Kernel store is not initialized")
    }
    console.log("Kernel found, executing namespace")
    return window.__KERNEL__.store.set(namespace, key, value, options)
  },

  get<T>(namespace: string, key: string): Promise<E.Either<StoreError, T | undefined>> {
    if (!window.__KERNEL__) {
      throw new Error("Kernel is not initialized")
    }
    if (!window.__KERNEL__?.store) {
      throw new Error("Kernel store is not initialized")
    }
    console.log("Kernel found, executing namespace")
    return window.__KERNEL__.store.get(namespace, key)
  },

  remove(namespace: string, key: string) {
    if (!window.__KERNEL__) {
      throw new Error("Kernel is not initialized")
    }
    if (!window.__KERNEL__?.store) {
      throw new Error("Kernel store is not initialized")
    }
    console.log("Kernel found, executing namespace")
    return window.__KERNEL__.store.remove(namespace, key)
  },

  clear(namespace?: string) {
    if (!window.__KERNEL__) {
      throw new Error("Kernel is not initialized")
    }
    if (!window.__KERNEL__?.store) {
      throw new Error("Kernel store is not initialized")
    }
    console.log("Kernel found, executing namespace")
    return window.__KERNEL__.store.clear(namespace)
  },

  has(namespace: string, key: string) {
    if (!window.__KERNEL__) {
      throw new Error("Kernel is not initialized")
    }
    if (!window.__KERNEL__?.store) {
      throw new Error("Kernel store is not initialized")
    }
    console.log("Kernel found, executing namespace")
    return window.__KERNEL__.store.has(namespace, key)
  },

  listNamespaces() {
    if (!window.__KERNEL__) {
      throw new Error("Kernel is not initialized")
    }
    if (!window.__KERNEL__?.store) {
      throw new Error("Kernel store is not initialized")
    }
    console.log("Kernel found, executing namespace")
    return window.__KERNEL__.store.listNamespaces()
  },

  listKeys(namespace: string) {
    if (!window.__KERNEL__) {
      throw new Error("Kernel is not initialized")
    }
    if (!window.__KERNEL__?.store) {
      throw new Error("Kernel store is not initialized")
    }
    console.log("Kernel found, executing namespace")
    return window.__KERNEL__.store.listKeys(namespace)
  },

  watch(namespace: string, key: string) {
    if (!window.__KERNEL__) {
      throw new Error("Kernel is not initialized")
    }
    if (!window.__KERNEL__?.store) {
      throw new Error("Kernel store is not initialized")
    }
    console.log("Kernel found, executing namespace")
    return window.__KERNEL__.store.watch(namespace, key)
  },
}
