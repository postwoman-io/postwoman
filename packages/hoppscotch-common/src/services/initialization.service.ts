import { Service } from "dioc"
import * as E from "fp-ts/Either"
import { getService } from "~/modules/dioc"

import { PersistenceService } from "~/services/persistence"
import { RESTTabService } from "~/services/tab/rest"
import { GQLTabService } from "~/services/tab/graphql"
import { KernelInterceptorService } from "~/services/kernel-interceptor.service"

import { platform } from "~/platform"
import { NativeKernelInterceptorService } from "~/platform/std/kernel-interceptors/native"

import { performMigrations } from "~/helpers/migrations"
import { initBackendGQLClient } from "~/helpers/backend/GQLClient"
import { getKernelMode } from "@hoppscotch/kernel"

type InitEvent =
  | { type: "STORE_READY" }
  | { type: "PERSISTENCE_FIRST_READY" }
  | { type: "PERSISTENCE_LATER_READY" }
  | { type: "TABS_READY" }
  | { type: "NATIVE_KERNEL_NETWORKING_READY" }
  | { type: "AUTH_READY" }
  | { type: "BACKEND_CLIENT_READY" }
  | { type: "SYNC_READY" }
  | { type: "ALL_READY" }

/**
 * Service responsible for coordinating the initialization sequence.
 */
export class InitializationService extends Service<InitEvent> {
  public static readonly ID = "INITIALIZATION_SERVICE"

  private initState = {
    store: false,
    persistenceFirst: false,
    tabs: false,
    nativeKernelNetworking: false,
    auth: false,
    sync: false,
    persistenceLater: false,
    backendClient: false,
  }

  private async initStore() {
    const persistenceService = getService(PersistenceService)
    const result = await persistenceService.init()

    if (E.isLeft(result)) {
      throw new Error(`Store initialization failed: ${result.left.message}`)
    }

    this.initState.store = true
    this.emit({ type: "STORE_READY" })
  }

  private async initPersistenceFirst() {
    if (!this.initState.store) {
      throw new Error("Cannot initialize persistence before store")
    }

    const persistenceService = getService(PersistenceService)
    await persistenceService.setupFirst()

    this.initState.persistenceFirst = true
    this.emit({ type: "PERSISTENCE_FIRST_READY" })
  }

  private async initTabs() {
    if (!this.initState.persistenceFirst) {
      throw new Error("Cannot initialize tabs before persistence")
    }

    const restTabService = getService(RESTTabService)
    const gqlTabService = getService(GQLTabService)

    await Promise.all([restTabService.init(), gqlTabService.init()])

    this.initState.tabs = true
    this.emit({ type: "TABS_READY" })
  }

  private async initNativeKernelNetworking() {
    const interceptorService = getService(KernelInterceptorService)
    const nativeInterceptorService = getService(NativeKernelInterceptorService)
    interceptorService.register(nativeInterceptorService)
    interceptorService.setActive("native")

    this.initState.nativeKernelNetworking = true
    this.emit({ type: "NATIVE_KERNEL_NETWORKING_READY" })
  }

  private async initAuth() {
    if (
      getKernelMode() === "desktop" &&
      !this.initState.nativeKernelNetworking
    ) {
      throw new Error(
        "Cannot initialize auth on desktop before native networking"
      )
    }

    if (!this.initState.persistenceFirst || !this.initState.tabs) {
      throw new Error("Cannot initialize auth before persistence and tabs")
    }

    await platform.auth.performAuthInit()

    this.initState.auth = true
    this.emit({ type: "AUTH_READY" })
  }

  private async initBackendClient() {
    initBackendGQLClient()

    this.initState.backendClient = true
    this.emit({ type: "BACKEND_CLIENT_READY" })
  }

  private async initPersistenceLater() {
    if (!this.initState.persistenceFirst) {
      throw new Error("Cannot initialize persistence before store")
    }

    const persistenceService = getService(PersistenceService)
    await persistenceService.setupLater()

    this.initState.persistenceLater = true
    this.emit({ type: "PERSISTENCE_LATER_READY" })
  }

  private async initSync() {
    if (!this.initState.auth) {
      throw new Error("Cannot initialize remaining services before auth")
    }

    await Promise.all([
      platform.sync.settings.initSettingsSync(),
      platform.sync.collections.initCollectionsSync(),
      platform.sync.history.initHistorySync(),
      platform.sync.environments.initEnvironmentsSync(),
      platform.analytics?.initAnalytics(),
    ])

    this.emit({ type: "SYNC_READY" })
  }

  public async initPre() {
    await this.initStore()
    await this.initPersistenceFirst()

    if (getKernelMode() === "desktop") {
      await this.initNativeKernelNetworking()
    }

    await this.initBackendClient()
    await this.initTabs()
  }

  public async initAuthAndSync() {
    await this.initAuth()
    await this.initSync()
  }

  public async initPost() {
    await this.initPersistenceLater()
    performMigrations()
  }

  public isInitialized() {
    return Object.values(this.initState).every(Boolean)
  }
}
