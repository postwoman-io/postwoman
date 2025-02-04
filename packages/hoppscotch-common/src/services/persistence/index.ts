/* eslint-disable no-restricted-globals, no-restricted-syntax */

import * as E from "fp-ts/Either"
import { z } from "zod"

import { Service } from "dioc"
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
  GLOBAL_ENVIRONMENT_SCHEMA,
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
import { PersistableTabState } from "../tab"
import { HoppTabDocument } from "~/helpers/rest/document"
import { HoppGQLDocument } from "~/helpers/graphql/document"

export const STORE_NAMESPACE = "persistence.v1"

export const STORE_KEYS = {
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
          try {
            await Store.set(STORE_NAMESPACE, newKey, JSON.parse(data))
            localStorage.removeItem(oldKey)
          } catch (err) {
            console.error(err)
            console.error(
              `Failed parsing persisted ${oldKey}:`,
              JSON.stringify(data)
            )
          }
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
      `Schema validation failed for ${STORE_NAMESPACE}:${key}. A backup has been created with suffix '-backup'`
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

  /**
   * Private method to migrate settings from older versions
   */
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

    const vuexKey = "vuex"
    const vuexData = JSON.parse(window.localStorage.getItem(vuexKey) || "{}")

    if (!isEmpty(vuexData)) {
      const result = VUEX_SCHEMA.safeParse(vuexData)
      if (result.success) {
        const { postwoman } = result.data
        if (!isEmpty(postwoman?.settings)) {
          const settingsData = assign(
            clone(getDefaultSettings()),
            postwoman.settings
          )
          await Store.set(STORE_NAMESPACE, STORE_KEYS.SETTINGS, settingsData)
          delete postwoman.settings
        }
        if (postwoman?.collections) {
          await Store.set(
            STORE_NAMESPACE,
            STORE_KEYS.REST_COLLECTIONS,
            postwoman.collections
          )
          delete postwoman.collections
        }
        if (postwoman?.collectionsGraphql) {
          await Store.set(
            STORE_NAMESPACE,
            STORE_KEYS.GQL_COLLECTIONS,
            postwoman.collectionsGraphql
          )
          delete postwoman.collectionsGraphql
        }
        if (postwoman?.environments) {
          await Store.set(
            STORE_NAMESPACE,
            STORE_KEYS.ENVIRONMENTS,
            postwoman.environments
          )
          delete postwoman.environments
        }
      } else {
        this.showErrorToast(vuexKey)
        window.localStorage.setItem(
          `${vuexKey}-backup`,
          JSON.stringify(vuexData)
        )
      }
      window.localStorage.removeItem(vuexKey)
    }

    // Handle old theme color
    const themeColorKey = "THEME_COLOR"
    const themeColor = window.localStorage.getItem(themeColorKey)
    if (themeColor) {
      const result = THEME_COLOR_SCHEMA.safeParse(themeColor)
      if (result.success) {
        applySetting("THEME_COLOR", result.data as HoppAccentColor)
      } else {
        this.showErrorToast(themeColorKey)
        window.localStorage.setItem(`${themeColorKey}-backup`, themeColor)
      }
      window.localStorage.removeItem(themeColorKey)
    }

    // Handle old color mode
    const nuxtColorModeKey = "nuxt-color-mode"
    const nuxtColorMode = window.localStorage.getItem(nuxtColorModeKey)
    if (nuxtColorMode) {
      const result = NUXT_COLOR_MODE_SCHEMA.safeParse(nuxtColorMode)
      if (result.success) {
        applySetting("BG_COLOR", result.data as HoppBgColor)
      } else {
        this.showErrorToast(nuxtColorModeKey)
        window.localStorage.setItem(`${nuxtColorModeKey}-backup`, nuxtColorMode)
      }
      window.localStorage.removeItem(nuxtColorModeKey)
    }
  }

  private async setupLocalStatePersistence() {
    const loadResult = await Store.get<any>(
      STORE_NAMESPACE,
      STORE_KEYS.LOCAL_STATE
    )

    try {
      if (E.isRight(loadResult)) {
        const data = loadResult.right ?? {}
        const result = LOCAL_STATE_SCHEMA.safeParse(data)

        if (result.success) {
          bulkApplyLocalState(result.data)
        } else {
          this.showErrorToast(STORE_KEYS.LOCAL_STATE)
          await Store.set(
            STORE_NAMESPACE,
            `${STORE_KEYS.LOCAL_STATE}-backup`,
            data
          )
        }
      }
    } catch (e) {
      console.error(`Failed parsing persisted LOCAL_STATE:`, loadResult)
    }

    localStateStore.subject$.subscribe(async (state) => {
      await Store.set(STORE_NAMESPACE, STORE_KEYS.LOCAL_STATE, state)
    })
  }

  private async setupSettingsPersistence() {
    const loadResult = await Store.get<any>(
      STORE_NAMESPACE,
      STORE_KEYS.SETTINGS
    )

    try {
      if (E.isRight(loadResult)) {
        const data = loadResult.right ?? getDefaultSettings()
        const result = SETTINGS_SCHEMA.safeParse(data)

        if (result.success) {
          const migratedSettings = performSettingsDataMigrations(result.data)
          bulkApplySettings(migratedSettings)
        } else {
          this.showErrorToast(STORE_KEYS.SETTINGS)
          await Store.set(
            STORE_NAMESPACE,
            `${STORE_KEYS.SETTINGS}-backup`,
            data
          )
        }
      }
    } catch (e) {
      console.error(`Failed parsing persisted SETTINGS:`, loadResult)
    }

    settingsStore.subject$.subscribe(async (settings) => {
      await Store.set(STORE_NAMESPACE, STORE_KEYS.SETTINGS, settings)
    })
  }

  private async setupRESTHistoryPersistence() {
    const restLoadResult = await Store.get<any>(
      STORE_NAMESPACE,
      STORE_KEYS.REST_HISTORY
    )

    try {
      if (E.isRight(restLoadResult)) {
        const data = restLoadResult.right ?? []
        const result = z.array(REST_HISTORY_ENTRY_SCHEMA).safeParse(data)

        if (result.success) {
          const translatedData = result.data.map(translateToNewRESTHistory)
          setRESTHistoryEntries(translatedData)
        } else {
          this.showErrorToast(STORE_KEYS.REST_HISTORY)
          await Store.set(
            STORE_NAMESPACE,
            `${STORE_KEYS.REST_HISTORY}-backup`,
            data
          )
        }
      }
    } catch (e) {
      console.error(`Failed parsing persisted REST_HISTORY:`, restLoadResult)
    }

    restHistoryStore.subject$.subscribe(async ({ state }) => {
      await Store.set(STORE_NAMESPACE, STORE_KEYS.REST_HISTORY, state)
    })
  }

  private async setupGQLHistoryPersistence() {
    const gqlLoadResult = await Store.get<any>(
      STORE_NAMESPACE,
      STORE_KEYS.GQL_HISTORY
    )

    try {
      if (E.isRight(gqlLoadResult)) {
        const data = gqlLoadResult.right ?? []
        const result = z.array(GQL_HISTORY_ENTRY_SCHEMA).safeParse(data)

        if (result.success) {
          const translatedData = result.data.map(translateToNewGQLHistory)
          setGraphqlHistoryEntries(translatedData)
        } else {
          this.showErrorToast(STORE_KEYS.GQL_HISTORY)
          await Store.set(
            STORE_NAMESPACE,
            `${STORE_KEYS.GQL_HISTORY}-backup`,
            data
          )
        }
      }
    } catch (e) {
      console.error(`Failed parsing persisted GQL_HISTORY:`, gqlLoadResult)
    }

    graphqlHistoryStore.subject$.subscribe(async ({ state }) => {
      await Store.set(STORE_NAMESPACE, STORE_KEYS.GQL_HISTORY, state)
    })
  }

  private async setupRESTCollectionsPersistence() {
    const restLoadResult = await Store.get<any>(
      STORE_NAMESPACE,
      STORE_KEYS.REST_COLLECTIONS
    )

    try {
      if (E.isRight(restLoadResult)) {
        const data = restLoadResult.right ?? []
        const result = z.array(REST_COLLECTION_SCHEMA).safeParse(data)

        if (result.success) {
          const translatedData = result.data.map(translateToNewRESTCollection)
          setRESTCollections(translatedData)
        } else {
          this.showErrorToast(STORE_KEYS.REST_COLLECTIONS)
          await Store.set(
            STORE_NAMESPACE,
            `${STORE_KEYS.REST_COLLECTIONS}-backup`,
            data
          )
          // NOTE: Still loading data to match legacy behavior
          setRESTCollections(data)
        }
      }
    } catch (e) {
      console.error(
        `Failed parsing persisted REST_COLLECTIONS:`,
        restLoadResult
      )
    }

    restCollectionStore.subject$.subscribe(async ({ state }) => {
      await Store.set(STORE_NAMESPACE, STORE_KEYS.REST_COLLECTIONS, state)
    })
  }

  private async setupGQLCollectionsPersistence() {
    const gqlLoadResult = await Store.get<any>(
      STORE_NAMESPACE,
      STORE_KEYS.GQL_COLLECTIONS
    )

    try {
      if (E.isRight(gqlLoadResult)) {
        const data = gqlLoadResult.right ?? []
        const result = z.array(GQL_COLLECTION_SCHEMA).safeParse(data)

        if (result.success) {
          const translatedData = result.data.map(translateToNewGQLCollection)
          setGraphqlCollections(translatedData)
        } else {
          this.showErrorToast(STORE_KEYS.GQL_COLLECTIONS)
          await Store.set(
            STORE_NAMESPACE,
            `${STORE_KEYS.GQL_COLLECTIONS}-backup`,
            data
          )
          // NOTE: Still loading data to match legacy behavior
          setGraphqlCollections(data)
        }
      }
    } catch (e) {
      console.error(`Failed parsing persisted GQL_COLLECTIONS:`, gqlLoadResult)
    }

    graphqlCollectionStore.subject$.subscribe(async ({ state }) => {
      await Store.set(STORE_NAMESPACE, STORE_KEYS.GQL_COLLECTIONS, state)
    })
  }

  private async setupEnvironmentsPersistence() {
    const loadResult = await Store.get<any>(
      STORE_NAMESPACE,
      STORE_KEYS.ENVIRONMENTS
    )

    try {
      if (E.isRight(loadResult)) {
        const data = loadResult.right ?? []
        const result = ENVIRONMENTS_SCHEMA.safeParse(data)

        if (result.success) {
          // Check for and handle globals
          const globalIndex = result.data.findIndex(
            (x) => x.name.toLowerCase() === "globals"
          )

          if (globalIndex !== -1) {
            const globalEnv = result.data[globalIndex]
            globalEnv.variables.forEach((variable: GlobalEnvironmentVariable) =>
              addGlobalEnvVariable(variable)
            )
            result.data.splice(globalIndex, 1)
          }

          replaceEnvironments(result.data)
        } else {
          this.showErrorToast(STORE_KEYS.ENVIRONMENTS)
          await Store.set(
            STORE_NAMESPACE,
            `${STORE_KEYS.ENVIRONMENTS}-backup`,
            data
          )
        }
      }
    } catch (e) {
      console.error(`Failed parsing persisted ENVIRONMENTS:`, loadResult)
    }

    environments$.subscribe(async (envs) => {
      await Store.set(STORE_NAMESPACE, STORE_KEYS.ENVIRONMENTS, envs)
    })
  }

  private async setupSecretEnvironmentsPersistence() {
    const loadResult = await Store.get<any>(
      STORE_NAMESPACE,
      STORE_KEYS.SECRET_ENVIRONMENTS
    )

    try {
      if (E.isRight(loadResult) && loadResult.right) {
        const result = SECRET_ENVIRONMENT_VARIABLE_SCHEMA.safeParse(
          loadResult.right
        )

        if (result.success) {
          this.secretEnvironmentService.loadSecretEnvironmentsFromPersistedState(
            result.data
          )
        } else {
          this.showErrorToast(STORE_KEYS.SECRET_ENVIRONMENTS)
          await Store.set(
            STORE_NAMESPACE,
            `${STORE_KEYS.SECRET_ENVIRONMENTS}-backup`,
            loadResult.right
          )
          console.error(
            `Failed parsing persisted SECRET_ENVIRONMENTS:`,
            JSON.stringify(loadResult.right)
          )
        }
      }
    } catch (e) {
      console.error(`Failed parsing persisted SECRET_ENVIRONMENTS:`, loadResult)
    }

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
    )
  }

  private async setupSelectedEnvPersistence() {
    const loadResult = await Store.get<any>(
      STORE_NAMESPACE,
      STORE_KEYS.SELECTED_ENV
    )

    try {
      if (E.isRight(loadResult)) {
        const data = loadResult.right ?? { type: "NO_ENV_SELECTED" as const }
        const result = SELECTED_ENV_INDEX_SCHEMA.safeParse(data)

        if (result.success) {
          if (result.data !== null) {
            setSelectedEnvironmentIndex(result.data)
          } else {
            setSelectedEnvironmentIndex({ type: "NO_ENV_SELECTED" })
          }
        } else {
          this.showErrorToast(STORE_KEYS.SELECTED_ENV)
          await Store.set(
            STORE_NAMESPACE,
            `${STORE_KEYS.SELECTED_ENV}-backup`,
            data
          )
        }
      }
    } catch (e) {
      console.error(`Failed parsing persisted SELECTED_ENV:`, loadResult)
    }

    selectedEnvironmentIndex$.subscribe(async (index) => {
      await Store.set(STORE_NAMESPACE, STORE_KEYS.SELECTED_ENV, index)
    })
  }

  private async setupWebsocketPersistence() {
    const loadResult = await Store.get<any>(
      STORE_NAMESPACE,
      STORE_KEYS.WEBSOCKET
    )

    try {
      if (E.isRight(loadResult)) {
        const data = loadResult.right
        if (data) {
          const result = WEBSOCKET_REQUEST_SCHEMA.safeParse(data)

          if (result.success) {
            if (result.data !== null) {
              setWSRequest(result.data)
            } else {
              setWSRequest(undefined)
            }
          } else {
            this.showErrorToast(STORE_KEYS.WEBSOCKET)
            await Store.set(
              STORE_NAMESPACE,
              `${STORE_KEYS.WEBSOCKET}-backup`,
              data
            )
          }
        }
      }
    } catch (e) {
      console.error(`Failed parsing persisted WEBSOCKET:`, loadResult)
    }

    WSRequest$.subscribe(async (req) => {
      await Store.set(STORE_NAMESPACE, STORE_KEYS.WEBSOCKET, req)
    })
  }

  private async setupSocketIOPersistence() {
    const loadResult = await Store.get<any>(
      STORE_NAMESPACE,
      STORE_KEYS.SOCKETIO
    )

    try {
      if (E.isRight(loadResult)) {
        const data = loadResult.right
        if (data) {
          const result = SOCKET_IO_REQUEST_SCHEMA.safeParse(data)

          if (result.success) {
            if (result.data !== null) {
              setSIORequest(result.data)
            } else {
              setSIORequest(undefined)
            }
          } else {
            this.showErrorToast(STORE_KEYS.SOCKETIO)
            await Store.set(
              STORE_NAMESPACE,
              `${STORE_KEYS.SOCKETIO}-backup`,
              data
            )
          }
        }
      }
    } catch (e) {
      console.error(`Failed parsing persisted SOCKETIO:`, loadResult)
    }

    SIORequest$.subscribe(async (req) => {
      await Store.set(STORE_NAMESPACE, STORE_KEYS.SOCKETIO, req)
    })
  }

  private async setupSSEPersistence() {
    const loadResult = await Store.get<any>(STORE_NAMESPACE, STORE_KEYS.SSE)

    try {
      if (E.isRight(loadResult)) {
        const data = loadResult.right
        if (data) {
          const result = SSE_REQUEST_SCHEMA.safeParse(data)

          if (result.success) {
            if (result.data !== null) {
              setSSERequest(result.data)
            } else {
              setSSERequest(undefined)
            }
          } else {
            this.showErrorToast(STORE_KEYS.SSE)
            await Store.set(STORE_NAMESPACE, `${STORE_KEYS.SSE}-backup`, data)
          }
        }
      }
    } catch (e) {
      console.error(`Failed parsing persisted SSE:`, loadResult)
    }

    SSERequest$.subscribe(async (req) => {
      await Store.set(STORE_NAMESPACE, STORE_KEYS.SSE, req)
    })
  }

  private async setupMQTTPersistence() {
    const loadResult = await Store.get<any>(STORE_NAMESPACE, STORE_KEYS.MQTT)

    try {
      if (E.isRight(loadResult)) {
        const data = loadResult.right
        if (data) {
          const result = MQTT_REQUEST_SCHEMA.safeParse(data)

          if (result.success) {
            if (result.data !== null) {
              setMQTTRequest(result.data)
            } else {
              setMQTTRequest(undefined)
            }
          } else {
            this.showErrorToast(STORE_KEYS.MQTT)
            await Store.set(STORE_NAMESPACE, `${STORE_KEYS.MQTT}-backup`, data)
          }
        }
      }
    } catch (e) {
      console.error(`Failed parsing persisted MQTT:`, loadResult)
    }

    MQTTRequest$.subscribe(async (req) => {
      await Store.set(STORE_NAMESPACE, STORE_KEYS.MQTT, req)
    })
  }

  private async setupGlobalEnvsPersistence() {
    const loadResult = await Store.get<any>(
      STORE_NAMESPACE,
      STORE_KEYS.GLOBAL_ENV
    )

    try {
      if (E.isRight(loadResult)) {
        const data = loadResult.right ?? []
        const result = GLOBAL_ENVIRONMENT_SCHEMA.safeParse(data)

        if (result.success) {
          setGlobalEnvVariables(result.data)
        } else {
          this.showErrorToast(STORE_KEYS.GLOBAL_ENV)
          await Store.set(
            STORE_NAMESPACE,
            `${STORE_KEYS.GLOBAL_ENV}-backup`,
            data
          )
        }
      }
    } catch (e) {
      console.error(`Failed parsing persisted GLOBAL_ENV:`, loadResult)
    }

    globalEnv$.subscribe(async (vars) => {
      await Store.set(STORE_NAMESPACE, STORE_KEYS.GLOBAL_ENV, vars)
    })
  }

  private async setupRESTTabsPersistence() {
    const loadResult = await Store.get<any>(
      STORE_NAMESPACE,
      STORE_KEYS.REST_TABS
    )

    try {
      if (E.isRight(loadResult) && loadResult.right) {
        const result = REST_TAB_STATE_SCHEMA.safeParse(loadResult.right)

        if (result.success) {
          // SAFETY: We know the schema matches
          this.restTabService.loadTabsFromPersistedState(
            result.data as PersistableTabState<HoppTabDocument>
          )
        } else {
          this.showErrorToast(STORE_KEYS.REST_TABS)
          await Store.set(
            STORE_NAMESPACE,
            `${STORE_KEYS.REST_TABS}-backup`,
            loadResult.right
          )
          console.error(
            `Failed parsing persisted REST_TABS:`,
            JSON.stringify(loadResult.right)
          )
          // NOTE: Still loading data to match legacy behavior
          this.restTabService.loadTabsFromPersistedState(loadResult.right)
        }
      }
    } catch (e) {
      console.error(`Failed parsing persisted REST_TABS:`, loadResult)
    }

    watchDebounced(
      this.restTabService.persistableTabState,
      async (newData) => {
        await Store.set(STORE_NAMESPACE, STORE_KEYS.REST_TABS, newData)
      },
      { debounce: 500, deep: true }
    )
  }

  private async setupGQLTabsPersistence() {
    const loadResult = await Store.get<any>(
      STORE_NAMESPACE,
      STORE_KEYS.GQL_TABS
    )

    try {
      if (E.isRight(loadResult) && loadResult.right) {
        const result = GQL_TAB_STATE_SCHEMA.safeParse(loadResult.right)

        if (result.success) {
          // SAFETY: We know the schema matches
          this.gqlTabService.loadTabsFromPersistedState(
            result.data as PersistableTabState<HoppGQLDocument>
          )
        } else {
          this.showErrorToast(STORE_KEYS.GQL_TABS)
          await Store.set(
            STORE_NAMESPACE,
            `${STORE_KEYS.GQL_TABS}-backup`,
            loadResult.right
          )
          console.error(
            `Failed parsing persisted GQL_TABS:`,
            JSON.stringify(loadResult.right)
          )
          // NOTE: Still loading data to match legacy behavior
          this.gqlTabService.loadTabsFromPersistedState(loadResult.right)
        }
      }
    } catch (e) {
      console.error(`Failed parsing persisted GQL_TABS:`, loadResult)
    }

    watchDebounced(
      this.gqlTabService.persistableTabState,
      async (newData) => {
        await Store.set(STORE_NAMESPACE, STORE_KEYS.GQL_TABS, newData)
      },
      { debounce: 500, deep: true }
    )
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
      this.setupRESTHistoryPersistence(),
      this.setupGQLHistoryPersistence(),
      this.setupRESTCollectionsPersistence(),
      this.setupGQLCollectionsPersistence(),

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
