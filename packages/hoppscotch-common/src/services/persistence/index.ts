/* eslint-disable no-restricted-globals, no-restricted-syntax */

import * as E from "fp-ts/Either"
import { pipe } from "fp-ts/lib/function"
import * as O from "fp-ts/Option"
import { z } from "zod"

import { Service } from "dioc"
import { Subscription } from "rxjs"
import { watchDebounced } from "@vueuse/core"
import { assign, clone, isEmpty } from "lodash-es"

import {
  GlobalEnvironmentVariable,
  translateToNewGQLCollection,
  translateToNewRESTCollection,
} from "@hoppscotch/data"

import { StoreError } from "@hoppscotch/kernel"

import { Store } from "~/kernel/store"
import { GQLTabService } from "~/services/tab/graphql"
import { RESTTabService } from "~/services/tab/rest"
import {
  SecretEnvironmentService,
  SecretVariable,
} from "../secret-environment.service"

import { useToast } from "~/composables/toast"

import {
  graphqlCollectionStore,
  restCollectionStore,
  setGraphqlCollections,
  setRESTCollections,
} from "../../newstore/collections"

import {
  addGlobalEnvVariable,
  environments$,
  globalEnv$,
  replaceEnvironments,
  selectedEnvironmentIndex$,
  setGlobalEnvVariables,
  setSelectedEnvironmentIndex,
} from "../../newstore/environments"

import {
  graphqlHistoryStore,
  restHistoryStore,
  setGraphqlHistoryEntries,
  setRESTHistoryEntries,
  translateToNewGQLHistory,
  translateToNewRESTHistory,
} from "../../newstore/history"

import { bulkApplyLocalState, localStateStore } from "../../newstore/localstate"

import {
  HoppAccentColor,
  HoppBgColor,
  applySetting,
  bulkApplySettings,
  getDefaultSettings,
  performSettingsDataMigrations,
  settingsStore,
} from "../../newstore/settings"

import { MQTTRequest$, setMQTTRequest } from "../../newstore/MQTTSession"
import { SSERequest$, setSSERequest } from "../../newstore/SSESession"
import { SIORequest$, setSIORequest } from "../../newstore/SocketIOSession"
import { WSRequest$, setWSRequest } from "../../newstore/WebSocketSession"

import {
  ENVIRONMENTS_SCHEMA,
  GQL_COLLECTION_SCHEMA,
  GQL_HISTORY_ENTRY_SCHEMA,
  GQL_TAB_STATE_SCHEMA,
  LOCAL_STATE_SCHEMA,
  MQTT_REQUEST_SCHEMA,
  NUXT_COLOR_MODE_SCHEMA,
  REST_COLLECTION_SCHEMA,
  REST_HISTORY_ENTRY_SCHEMA,
  REST_TAB_STATE_SCHEMA,
  SECRET_ENVIRONMENT_VARIABLE_SCHEMA,
  SELECTED_ENV_INDEX_SCHEMA,
  SETTINGS_SCHEMA,
  SOCKET_IO_REQUEST_SCHEMA,
  SSE_REQUEST_SCHEMA,
  THEME_COLOR_SCHEMA,
  VUEX_SCHEMA,
  WEBSOCKET_REQUEST_SCHEMA,
} from "./validation-schemas"

const STORE_NAMESPACE = "persistence.v1"

const STORE_KEYS = {
  VUEX: "vuex",
  SETTINGS: "settings",
  LOCAL_STATE: "localState",
  REST_HISTORY: "restHistory",
  GQL_HISTORY: "gqlHistory",
  REST_COLLECTIONS: "restCollections",
  GQL_COLLECTIONS: "gqlCollections",
  ENVIRONMENTS: "environments",
  SELECTED_ENV: "selectedEnv",
  WEBSOCKET: "websocket",
  SOCKETIO: "socketio",
  SSE: "sse",
  MQTT: "mqtt",
  GLOBAL_ENV: "globalEnv",
  REST_TABS: "restTabs",
  GQL_TABS: "gqlTabs",
  SECRET_ENVIRONMENTS: "secretEnvironments",
  SCHEMA_VERSION: "schema_version",
} as const

interface StorageSetup<S extends z.ZodType<any>> {
  key: keyof typeof STORE_KEYS
  schema: S
  defaultValue?: z.infer<S>
  onLoad?: (data: z.infer<S>) => void
  subscribe?: (
    callback: (data: z.infer<S>) => Promise<void>
  ) => Subscription | void | (() => void)
  transform?: (data: z.infer<S>) => z.infer<S>
}

interface Migration {
  version: number
  migrate: () => Promise<void>
}

const migrations: Migration[] = [
  {
    version: 1,
    migrate: async () => {
      const keyMappings = {
        settings: STORE_KEYS.SETTINGS,
        collections: STORE_KEYS.REST_COLLECTIONS,
        collectionsGraphql: STORE_KEYS.GQL_COLLECTIONS,
        environments: STORE_KEYS.ENVIRONMENTS,
        history: STORE_KEYS.REST_HISTORY,
        graphqlHistory: STORE_KEYS.GQL_HISTORY,
        WebsocketRequest: STORE_KEYS.WEBSOCKET,
        SocketIORequest: STORE_KEYS.SOCKETIO,
        SSERequest: STORE_KEYS.SSE,
        MQTTRequest: STORE_KEYS.MQTT,
        globalEnv: STORE_KEYS.GLOBAL_ENV,
        restTabState: STORE_KEYS.REST_TABS,
        gqlTabState: STORE_KEYS.GQL_TABS,
        secretEnvironments: STORE_KEYS.SECRET_ENVIRONMENTS,
      }

      for (const [oldKey, newKey] of Object.entries(keyMappings)) {
        const data = localStorage.getItem(oldKey)
        if (data) {
          await Store.set(STORE_NAMESPACE, newKey, JSON.parse(data))
          localStorage.removeItem(oldKey)
        }
      }
    },
  },
]

/**
 * Service that manages persistence of app state using the kernel store
 */
export class PersistenceService extends Service {
  public static readonly ID = "PERSISTENCE_SERVICE"

  private readonly restTabService = this.bind(RESTTabService)
  private readonly gqlTabService = this.bind(GQLTabService)
  private readonly secretEnvironmentService = this.bind(
    SecretEnvironmentService
  )

  private showErrorToast(key: string) {
    const toast = useToast()
    toast.error(
      `Schema validation failed for ${key}. A backup has been created with suffix '-backup'`
    )
  }

  async init(): Promise<E.Either<StoreError, void>> {
    const initResult = await Store.init()
    if (E.isLeft(initResult)) {
      console.error(
        "[PersistenceService] Failed to initialize store:",
        initResult.left
      )
      return initResult
    }
    return initResult
  }

  // Using `ZodType<any>` because there's little to be gained in making it generic over `T`
  // since we're using `schema.safeParse` anyways with toast for errors.
  private async setupStorage<S extends z.ZodType<any>>({
    key,
    schema,
    defaultValue,
    onLoad,
    subscribe,
    transform,
  }: StorageSetup<S>) {
    const loadResult = await Store.get<z.infer<S>>(
      STORE_NAMESPACE,
      STORE_KEYS[key]
    )

    const isReallyEmpty = (d: unknown): boolean =>
      d === null ||
      d === undefined ||
      (typeof d === "object" &&
        !Array.isArray(d) &&
        Object.keys(d).length === 0)

    const result = pipe(
      loadResult,
      E.fold(
        () => defaultValue,
        (data) =>
          pipe(
            data,
            O.fromNullable,
            O.chain((d) => (isReallyEmpty(d) ? O.none : O.some(d))),
            O.getOrElse(() => defaultValue)
          )
      )
    )

    // NOTE: Some services define their own defaults,
    // so `{}` is a valid value for safe parsing.
    // TODO: Maybe consider making it consistent?
    const isStillEmpty = isReallyEmpty(result)

    if (result && !isStillEmpty) {
      const schemaResult = schema.safeParse(result)
      if (schemaResult.success) {
        const transformedData = transform
          ? transform(schemaResult.data)
          : schemaResult.data
        if (onLoad) onLoad(transformedData)
      } else {
        this.showErrorToast(key)
        await Store.set(STORE_NAMESPACE, `${STORE_KEYS[key]}-backup`, result)
      }
    }

    if (subscribe) {
      subscribe(async (newData) => {
        await Store.set(STORE_NAMESPACE, STORE_KEYS[key], newData)
      })
    }
  }

  private async runMigrations() {
    const versionResult = await Store.get<string>(
      STORE_NAMESPACE,
      STORE_KEYS.SCHEMA_VERSION
    )
    const currentVersion = E.isRight(versionResult)
      ? versionResult.right || "0"
      : "0"
    const targetVersion = "1"

    if (currentVersion !== targetVersion) {
      for (const migration of migrations) {
        if (migration.version > parseInt(currentVersion)) {
          await migration.migrate()
        }
      }

      await Store.set(STORE_NAMESPACE, STORE_KEYS.SCHEMA_VERSION, targetVersion)
    }
  }

  private async checkAndMigrateOldSettings() {
    const oldSelectedEnvIndex = window.localStorage.getItem("selectedEnvIndex")
    if (oldSelectedEnvIndex) {
      if (oldSelectedEnvIndex === "-1") {
        await Store.set(STORE_NAMESPACE, STORE_KEYS.SELECTED_ENV, {
          type: "NO_ENV_SELECTED" as const,
        })
      } else if (Number(oldSelectedEnvIndex) >= 0) {
        await Store.set(STORE_NAMESPACE, STORE_KEYS.SELECTED_ENV, {
          type: "MY_ENV" as const,
          index: parseInt(oldSelectedEnvIndex),
        })
      }
      window.localStorage.removeItem("selectedEnvIndex")
    }

    const vuexData = JSON.parse(window.localStorage.getItem("vuex") || "{}")
    if (!isEmpty(vuexData)) {
      const result = VUEX_SCHEMA.safeParse(vuexData)
      if (result.success) {
        const { postwoman } = result.data
        if (!isEmpty(postwoman?.settings)) {
          const settingsData = assign(
            clone(getDefaultSettings()),
            postwoman.settings
          )
          delete postwoman.settings
          await Store.set(STORE_NAMESPACE, STORE_KEYS.SETTINGS, settingsData)
        }
        if (postwoman?.collections) {
          await Store.set(
            STORE_NAMESPACE,
            STORE_KEYS.REST_COLLECTIONS,
            postwoman.collections
          )
        }
        if (postwoman?.collectionsGraphql) {
          await Store.set(
            STORE_NAMESPACE,
            STORE_KEYS.GQL_COLLECTIONS,
            postwoman.collectionsGraphql
          )
        }
        if (postwoman?.environments) {
          await Store.set(
            STORE_NAMESPACE,
            STORE_KEYS.ENVIRONMENTS,
            postwoman.environments
          )
        }
      }

      window.localStorage.removeItem("vuex")
    }

    const themeColor = window.localStorage.getItem("THEME_COLOR")
    if (themeColor) {
      const result = THEME_COLOR_SCHEMA.safeParse(themeColor)
      if (result.success) {
        applySetting("THEME_COLOR", result.data as HoppAccentColor)
      }
      window.localStorage.removeItem("THEME_COLOR")
    }

    const nuxtColorMode = window.localStorage.getItem("nuxt-color-mode")
    if (nuxtColorMode) {
      const result = NUXT_COLOR_MODE_SCHEMA.safeParse(nuxtColorMode)
      if (result.success) {
        applySetting("BG_COLOR", result.data as HoppBgColor)
      }
      window.localStorage.removeItem("nuxt-color-mode")
    }
  }

  private async setupLocalStatePersistence() {
    await this.setupStorage({
      key: "LOCAL_STATE",
      schema: LOCAL_STATE_SCHEMA,
      defaultValue: {},
      onLoad: bulkApplyLocalState,
      subscribe: (callback) =>
        localStateStore.subject$.subscribe((state) => callback(state)),
    })
  }

  private async setupSettingsPersistence() {
    await this.setupStorage({
      key: "SETTINGS",
      schema: SETTINGS_SCHEMA as z.ZodType<any>,
      defaultValue: getDefaultSettings(),
      transform: performSettingsDataMigrations,
      onLoad: bulkApplySettings,
      subscribe: (callback) =>
        settingsStore.subject$.subscribe((state) => callback(state)),
    })
  }

  private async setupHistoryPersistence() {
    await this.setupStorage({
      key: "REST_HISTORY",
      schema: z.array(REST_HISTORY_ENTRY_SCHEMA as z.ZodType<any>),
      defaultValue: [],
      transform: (data) => data.map(translateToNewRESTHistory),
      onLoad: setRESTHistoryEntries,
      subscribe: (callback) =>
        restHistoryStore.subject$.subscribe(({ state }) => callback(state)),
    })

    await this.setupStorage({
      key: "GQL_HISTORY",
      schema: z.array(GQL_HISTORY_ENTRY_SCHEMA as z.ZodType<any>),
      defaultValue: [],
      transform: (data) => data.map(translateToNewGQLHistory),
      onLoad: setGraphqlHistoryEntries,
      subscribe: (callback) =>
        graphqlHistoryStore.subject$.subscribe(({ state }) => callback(state)),
    })
  }

  private async setupCollectionsPersistence() {
    await this.setupStorage({
      key: "REST_COLLECTIONS",
      schema: z.array(REST_COLLECTION_SCHEMA as z.ZodType<any>),
      defaultValue: [],
      transform: (data) => data.map(translateToNewRESTCollection),
      onLoad: setRESTCollections,
      subscribe: (callback) =>
        restCollectionStore.subject$.subscribe(({ state }) => callback(state)),
    })

    await this.setupStorage({
      key: "GQL_COLLECTIONS",
      schema: z.array(GQL_COLLECTION_SCHEMA as z.ZodType<any>),
      defaultValue: [],
      transform: (data) => data.map(translateToNewGQLCollection),
      onLoad: setGraphqlCollections,
      subscribe: (callback) =>
        graphqlCollectionStore.subject$.subscribe(({ state }) =>
          callback(state)
        ),
    })
  }

  private async setupEnvironmentsPersistence() {
    await this.setupStorage({
      key: "ENVIRONMENTS",
      schema: ENVIRONMENTS_SCHEMA as z.ZodType<any>,
      defaultValue: [],
      transform: (data) => {
        const globalIndex = data.findIndex(
          (x: any) => x.name.toLowerCase() === "globals"
        )
        if (globalIndex !== -1) {
          const globalEnv = data[globalIndex]
          globalEnv.variables.forEach((variable: GlobalEnvironmentVariable) =>
            addGlobalEnvVariable(variable)
          )
          data.splice(globalIndex, 1)
        }
        return data
      },
      onLoad: replaceEnvironments,
      subscribe: (callback) =>
        environments$.subscribe((state) => callback(state)),
    })
  }

  private async setupGlobalEnvsPersistence() {
    await this.setupStorage({
      key: "GLOBAL_ENV",
      schema: z.any(),
      defaultValue: { v: 1, variables: [] },
      onLoad: setGlobalEnvVariables,
      subscribe: (callback) => globalEnv$.subscribe((state) => callback(state)),
    })
  }

  private async setupSelectedEnvPersistence() {
    await this.setupStorage({
      key: "SELECTED_ENV",
      schema: SELECTED_ENV_INDEX_SCHEMA as z.ZodType<any>,
      defaultValue: { type: "NO_ENV_SELECTED" as const },
      onLoad: setSelectedEnvironmentIndex,
      subscribe: (callback) =>
        selectedEnvironmentIndex$.subscribe((state) => callback(state)),
    })
  }

  private async setupWebsocketPersistence() {
    await this.setupStorage({
      key: "WEBSOCKET",
      schema: WEBSOCKET_REQUEST_SCHEMA as z.ZodType<any>,
      onLoad: (data) => setWSRequest(data ?? undefined),
      subscribe: (callback) => WSRequest$.subscribe((state) => callback(state)),
    })
  }

  private async setupSocketIOPersistence() {
    await this.setupStorage({
      key: "SOCKETIO",
      schema: SOCKET_IO_REQUEST_SCHEMA as z.ZodType<any>,
      onLoad: (data) => setSIORequest(data ?? undefined),
      subscribe: (callback) =>
        SIORequest$.subscribe((state) => callback(state)),
    })
  }

  private async setupSSEPersistence() {
    await this.setupStorage({
      key: "SSE",
      schema: SSE_REQUEST_SCHEMA as z.ZodType<any>,
      onLoad: (data) => setSSERequest(data ?? undefined),
      subscribe: (callback) =>
        SSERequest$.subscribe((state) => callback(state)),
    })
  }

  private async setupMQTTPersistence() {
    await this.setupStorage({
      key: "MQTT",
      schema: MQTT_REQUEST_SCHEMA as z.ZodType<any>,
      onLoad: (data) => setMQTTRequest(data ?? undefined),
      subscribe: (callback) =>
        MQTTRequest$.subscribe((state) => callback(state)),
    })
  }

  private async setupRESTTabsPersistence() {
    await this.setupStorage({
      key: "REST_TABS",
      schema: REST_TAB_STATE_SCHEMA as z.ZodType<any>,
      defaultValue: {},
      onLoad: (data) => this.restTabService.loadTabsFromPersistedState(data),
      subscribe: () =>
        watchDebounced(
          this.restTabService.persistableTabState,
          async (newData) => {
            await Store.set(STORE_NAMESPACE, STORE_KEYS.REST_TABS, newData)
          },
          { debounce: 500, deep: true }
        ),
    })
  }

  private async setupGQLTabsPersistence() {
    await this.setupStorage({
      key: "GQL_TABS",
      schema: GQL_TAB_STATE_SCHEMA as z.ZodType<any>,
      defaultValue: {},
      onLoad: (data) => this.gqlTabService.loadTabsFromPersistedState(data),
      subscribe: () =>
        watchDebounced(
          this.gqlTabService.persistableTabState,
          async (newData) => {
            await Store.set(STORE_NAMESPACE, STORE_KEYS.GQL_TABS, newData)
          },
          { debounce: 500, deep: true }
        ),
    })
  }

  private async setupSecretEnvironmentsPersistence() {
    await this.setupStorage({
      key: "SECRET_ENVIRONMENTS",
      schema: SECRET_ENVIRONMENT_VARIABLE_SCHEMA,
      defaultValue: {},
      onLoad: (data) =>
        this.secretEnvironmentService.loadSecretEnvironmentsFromPersistedState(
          data
        ),
      subscribe: () =>
        watchDebounced(
          this.secretEnvironmentService.persistableSecretEnvironments,
          async (newData: Record<string, SecretVariable[]>) => {
            await Store.set(
              STORE_NAMESPACE,
              STORE_KEYS.SECRET_ENVIRONMENTS,
              newData
            )
          },
          { debounce: 500 }
        ),
    })
  }

  public async setupFirst() {
    await this.init()
    await this.runMigrations()
    await this.checkAndMigrateOldSettings()
  }

  public async setupLater() {
    await Promise.all([
      this.setupLocalStatePersistence(),

      this.setupSettingsPersistence(),
      this.setupHistoryPersistence(),
      this.setupCollectionsPersistence(),

      this.setupEnvironmentsPersistence(),
      this.setupGlobalEnvsPersistence(),
      this.setupSelectedEnvPersistence(),

      this.setupWebsocketPersistence(),
      this.setupSocketIOPersistence(),
      this.setupSSEPersistence(),
      this.setupMQTTPersistence(),
      this.setupRESTTabsPersistence(),
      this.setupGQLTabsPersistence(),

      this.setupSecretEnvironmentsPersistence(),
    ])
  }

  /**
   * Gets a value from persistence
   */
  public async getLocalConfig(
    name: string
  ): Promise<string | null | undefined> {
    const result = await Store.get<string>(STORE_NAMESPACE, name)
    if (E.isRight(result)) {
      return result.right
    }
    return null
  }

  /**
   * Sets a value in persistence
   */
  public async setLocalConfig(key: string, value: string): Promise<void> {
    await Store.set(STORE_NAMESPACE, key, value)
  }

  /**
   * Clear config value from persistence
   */
  public async removeLocalConfig(key: string): Promise<void> {
    await Store.remove(STORE_NAMESPACE, key)
  }
}
