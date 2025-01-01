import type {
  StorageOptions,
  StoreError,
  StoreEvents,
  StoreEventEmitter,
} from "@hoppscotch/kernel"
import * as E from "fp-ts/Either"
import { getModule } from "."

export const Store = (() => {
  const module = () => getModule("store")

  return {
    capabilities: () => module().capabilities,
    init: () => module().init(),
    set: (
      namespace: string,
      key: string,
      value: unknown,
      options?: StorageOptions
    ): Promise<E.Either<StoreError, void>> =>
      module().set(namespace, key, value, options),
    get: <T>(
      namespace: string,
      key: string
    ): Promise<E.Either<StoreError, T | undefined>> =>
      module().get<T>(namespace, key),
    remove: (
      namespace: string,
      key: string
    ): Promise<E.Either<StoreError, boolean>> =>
      module().remove(namespace, key),
    clear: (namespace?: string): Promise<E.Either<StoreError, void>> =>
      module().clear(namespace),
    has: (
      namespace: string,
      key: string
    ): Promise<E.Either<StoreError, boolean>> => module().has(namespace, key),
    listNamespaces: (): Promise<E.Either<StoreError, string[]>> =>
      module().listNamespaces(),
    listKeys: (namespace: string): Promise<E.Either<StoreError, string[]>> =>
      module().listKeys(namespace),
    watch: (namespace: string, key: string): StoreEventEmitter<StoreEvents> =>
      module().watch(namespace, key),
  } as const
})()
