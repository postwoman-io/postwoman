/* eslint-disable no-restricted-globals, no-restricted-syntax */

import {
  Environment,
  GlobalEnvironment,
  GlobalEnvironmentVariable,
  translateToNewGQLCollection,
  translateToNewRESTCollection,
} from "@hoppscotch/data"
import { StorageLike, watchDebounced } from "@vueuse/core"
import { Service } from "dioc"
import { assign, clone, isEmpty } from "lodash-es"
import { z } from "zod"

import { GQLTabService } from "~/services/tab/graphql"
import { RESTTabService } from "~/services/tab/rest"

import { useToast } from "~/composables/toast"
import { MQTTRequest$, setMQTTRequest } from "../../newstore/MQTTSession"
import { SSERequest$, setSSERequest } from "../../newstore/SSESession"
import { SIORequest$, setSIORequest } from "../../newstore/SocketIOSession"
import { WSRequest$, setWSRequest } from "../../newstore/WebSocketSession"
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
import { SecretEnvironmentService } from "../secret-environment.service"
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

/**
 * This service compiles persistence logic across the codebase
 */
export class PersistenceService extends Service {
  public static readonly ID = "PERSISTENCE_SERVICE"

  private readonly restTabService = this.bind(RESTTabService)
  private readonly gqlTabService = this.bind(GQLTabService)

  private readonly secretEnvironmentService = this.bind(
    SecretEnvironmentService
  )

  public hoppLocalConfigStorage: StorageLike = localStorage

  private showErrorToast(localStorageKey: string) {
    const toast = useToast()
    toast.error(
      `There's a mismatch with the expected schema for the value corresponding to ${localStorageKey} read from localStorage, keeping a backup in ${localStorageKey}-backup`
    )
  }

  private checkAndMigrateOldSettings() {
    if (window.localStorage.getItem("selectedEnvIndex")) {
      const index = window.localStorage.getItem("selectedEnvIndex")
      if (index) {
        if (index === "-1") {
          window.localStorage.setItem(
            "selectedEnvIndex",
            JSON.stringify({
              type: "NO_ENV_SELECTED",
            })
          )
        } else if (Number(index) >= 0) {
          window.localStorage.setItem(
            "selectedEnvIndex",
            JSON.stringify({
              type: "MY_ENV",
              index: parseInt(index),
            })
          )
        }
      }
    }

    const vuexKey = "vuex"
    let vuexData = JSON.parse(window.localStorage.getItem(vuexKey) || "{}")

    if (isEmpty(vuexData)) return

    // Validate data read from localStorage
    const result = VUEX_SCHEMA.safeParse(vuexData)
    if (result.success) {
      vuexData = result.data
    } else {
      this.showErrorToast(vuexKey)
      window.localStorage.setItem(`${vuexKey}-backup`, JSON.stringify(vuexData))
    }

    const { postwoman } = vuexData

    if (!isEmpty(postwoman?.settings)) {
      const settingsData = assign(
        clone(getDefaultSettings()),
        postwoman.settings
      )

      window.localStorage.setItem("settings", JSON.stringify(settingsData))

      delete postwoman.settings
      window.localStorage.setItem(vuexKey, JSON.stringify(vuexData))
    }

    if (postwoman?.collections) {
      window.localStorage.setItem(
        "collections",
        JSON.stringify(postwoman.collections)
      )

      delete postwoman.collections
      window.localStorage.setItem(vuexKey, JSON.stringify(vuexData))
    }

    if (postwoman?.collectionsGraphql) {
      window.localStorage.setItem(
        "collectionsGraphql",
        JSON.stringify(postwoman.collectionsGraphql)
      )

      delete postwoman.collectionsGraphql
      window.localStorage.setItem(vuexKey, JSON.stringify(vuexData))
    }

    if (postwoman?.environments) {
      window.localStorage.setItem(
        "environments",
        JSON.stringify(postwoman.environments)
      )

      delete postwoman.environments
      window.localStorage.setItem(vuexKey, JSON.stringify(vuexData))
    }

    const themeColorKey = "THEME_COLOR"
    let themeColorValue = window.localStorage.getItem(themeColorKey)

    if (themeColorValue) {
      // Validate data read from localStorage
      const result = THEME_COLOR_SCHEMA.safeParse(themeColorValue)

      if (result.success) {
        themeColorValue = result.data
      } else {
        this.showErrorToast(themeColorKey)
        window.localStorage.setItem(`${themeColorKey}-backup`, themeColorValue)
      }

      applySetting(themeColorKey, themeColorValue as HoppAccentColor)
      window.localStorage.removeItem(themeColorKey)
    }

    const nuxtColorModeKey = "nuxt-color-mode"
    let nuxtColorModeValue = window.localStorage.getItem(nuxtColorModeKey)

    if (nuxtColorModeValue) {
      // Validate data read from localStorage
      const result = NUXT_COLOR_MODE_SCHEMA.safeParse(nuxtColorModeValue)

      if (result.success) {
        nuxtColorModeValue = result.data
      } else {
        this.showErrorToast(nuxtColorModeKey)
        window.localStorage.setItem(
          `${nuxtColorModeKey}-backup`,
          nuxtColorModeValue
        )
      }

      applySetting("BG_COLOR", nuxtColorModeValue as HoppBgColor)
      window.localStorage.removeItem(nuxtColorModeKey)
    }
  }

  public setupLocalStatePersistence() {
    const localStateKey = "localState"
    let localStateData = JSON.parse(
      window.localStorage.getItem(localStateKey) ?? "{}"
    )

    // Validate data read from localStorage
    const result = LOCAL_STATE_SCHEMA.safeParse(localStateData)

    if (result.success) {
      localStateData = result.data
    } else {
      this.showErrorToast(localStateKey)
      window.localStorage.setItem(
        `${localStateKey}-backup`,
        JSON.stringify(localStateData)
      )
    }

    if (localStateData) bulkApplyLocalState(localStateData)

    localStateStore.subject$.subscribe((state) => {
      window.localStorage.setItem(localStateKey, JSON.stringify(state))
    })
  }

  private setupSettingsPersistence() {
    const settingsKey = "settings"
    let settingsData = JSON.parse(
      window.localStorage.getItem(settingsKey) ?? "null"
    )

    if (!settingsData) {
      settingsData = getDefaultSettings()
    }

    // Validate data read from localStorage
    const result = SETTINGS_SCHEMA.safeParse(settingsData)
    if (result.success) {
      settingsData = result.data
    } else {
      this.showErrorToast(settingsKey)
      window.localStorage.setItem(
        `${settingsKey}-backup`,
        JSON.stringify(settingsData)
      )
    }

    const updatedSettings = settingsData
      ? performSettingsDataMigrations(settingsData)
      : settingsData

    if (updatedSettings) {
      bulkApplySettings(updatedSettings)
    }

    settingsStore.subject$.subscribe((settings) => {
      window.localStorage.setItem(settingsKey, JSON.stringify(settings))
    })
  }

  private setupHistoryPersistence() {
    const restHistoryKey = "history"
    let restHistoryData = JSON.parse(
      window.localStorage.getItem(restHistoryKey) || "[]"
    )

    const graphqlHistoryKey = "graphqlHistory"
    let graphqlHistoryData = JSON.parse(
      window.localStorage.getItem(graphqlHistoryKey) || "[]"
    )

    // Validate data read from localStorage
    const restHistorySchemaParsedresult = z
      .array(REST_HISTORY_ENTRY_SCHEMA)
      .safeParse(restHistoryData)

    if (restHistorySchemaParsedresult.success) {
      restHistoryData = restHistorySchemaParsedresult.data
    } else {
      this.showErrorToast(restHistoryKey)
      window.localStorage.setItem(
        `${restHistoryKey}-backup`,
        JSON.stringify(restHistoryData)
      )
    }

    const gqlHistorySchemaParsedresult = z
      .array(GQL_HISTORY_ENTRY_SCHEMA)
      .safeParse(graphqlHistoryData)

    if (gqlHistorySchemaParsedresult.success) {
      graphqlHistoryData = gqlHistorySchemaParsedresult.data
    } else {
      this.showErrorToast(graphqlHistoryKey)
      window.localStorage.setItem(
        `${graphqlHistoryKey}-backup`,
        JSON.stringify(graphqlHistoryData)
      )
    }

    const translatedRestHistoryData = restHistoryData.map(
      translateToNewRESTHistory
    )
    const translatedGraphqlHistoryData = graphqlHistoryData.map(
      translateToNewGQLHistory
    )

    setRESTHistoryEntries(translatedRestHistoryData)
    setGraphqlHistoryEntries(translatedGraphqlHistoryData)

    restHistoryStore.subject$.subscribe(({ state }) => {
      window.localStorage.setItem(restHistoryKey, JSON.stringify(state))
    })

    graphqlHistoryStore.subject$.subscribe(({ state }) => {
      window.localStorage.setItem(graphqlHistoryKey, JSON.stringify(state))
    })
  }

  private setupCollectionsPersistence() {
    const restCollectionsKey = "collections"
    let restCollectionsData = JSON.parse(
      window.localStorage.getItem(restCollectionsKey) || "[]"
    )

    const graphqlCollectionsKey = "collectionsGraphql"
    let graphqlCollectionsData = JSON.parse(
      window.localStorage.getItem(graphqlCollectionsKey) || "[]"
    )

    // Validate data read from localStorage
    const restCollectionsSchemaParsedresult = z
      .array(REST_COLLECTION_SCHEMA)
      .safeParse(restCollectionsData)

    if (restCollectionsSchemaParsedresult.success) {
      restCollectionsData = restCollectionsSchemaParsedresult.data
    } else {
      this.showErrorToast(restCollectionsKey)
      window.localStorage.setItem(
        `${restCollectionsKey}-backup`,
        JSON.stringify(restCollectionsData)
      )
    }

    const gqlCollectionsSchemaParsedresult = z
      .array(GQL_COLLECTION_SCHEMA)
      .safeParse(graphqlCollectionsData)

    if (gqlCollectionsSchemaParsedresult.success) {
      graphqlCollectionsData = gqlCollectionsSchemaParsedresult.data
    } else {
      this.showErrorToast(graphqlCollectionsKey)
      window.localStorage.setItem(
        `${graphqlCollectionsKey}-backup`,
        JSON.stringify(graphqlCollectionsData)
      )
    }

    const translatedRestCollectionsData = restCollectionsData.map(
      translateToNewRESTCollection
    )
    const translatedGraphqlCollectionsData = graphqlCollectionsData.map(
      translateToNewGQLCollection
    )

    setRESTCollections(translatedRestCollectionsData)
    setGraphqlCollections(translatedGraphqlCollectionsData)

    restCollectionStore.subject$.subscribe(({ state }) => {
      window.localStorage.setItem(restCollectionsKey, JSON.stringify(state))
    })

    graphqlCollectionStore.subject$.subscribe(({ state }) => {
      window.localStorage.setItem(graphqlCollectionsKey, JSON.stringify(state))
    })
  }

  private setupEnvironmentsPersistence() {
    const environmentsKey = "environments"
    let environmentsData: Environment[] = JSON.parse(
      window.localStorage.getItem(environmentsKey) || "[]"
    )

    // Validate data read from localStorage
    const result = ENVIRONMENTS_SCHEMA.safeParse(environmentsData)
    if (result.success) {
      environmentsData = result.data
    } else {
      this.showErrorToast(environmentsKey)
      window.localStorage.setItem(
        `${environmentsKey}-backup`,
        JSON.stringify(environmentsData)
      )
    }

    // Check if a global env is defined and if so move that to globals
    const globalIndex = environmentsData.findIndex(
      (x) => x.name.toLowerCase() === "globals"
    )

    if (globalIndex !== -1) {
      const globalEnv = environmentsData[globalIndex]
      globalEnv.variables.forEach((variable: GlobalEnvironmentVariable) =>
        addGlobalEnvVariable(variable)
      )

      // Remove global from environments
      environmentsData.splice(globalIndex, 1)

      // Just sync the changes manually
      window.localStorage.setItem(
        environmentsKey,
        JSON.stringify(environmentsData)
      )
    }

    replaceEnvironments(environmentsData)

    environments$.subscribe((envs) => {
      window.localStorage.setItem(environmentsKey, JSON.stringify(envs))
    })
  }

  private setupSecretEnvironmentsPersistence() {
    const secretEnvironmentsKey = "secretEnvironments"
    const secretEnvironmentsData = window.localStorage.getItem(
      secretEnvironmentsKey
    )

    try {
      if (secretEnvironmentsData) {
        let parsedSecretEnvironmentsData = JSON.parse(secretEnvironmentsData)

        // Validate data read from localStorage
        const result = SECRET_ENVIRONMENT_VARIABLE_SCHEMA.safeParse(
          parsedSecretEnvironmentsData
        )

        if (result.success) {
          parsedSecretEnvironmentsData = result.data
        } else {
          this.showErrorToast(secretEnvironmentsKey)
          window.localStorage.setItem(
            `${secretEnvironmentsKey}-backup`,
            JSON.stringify(parsedSecretEnvironmentsData)
          )
        }

        this.secretEnvironmentService.loadSecretEnvironmentsFromPersistedState(
          parsedSecretEnvironmentsData
        )
      }
    } catch (e) {
      console.error(
        `Failed parsing persisted secret environment, state:`,
        secretEnvironmentsData
      )
    }

    watchDebounced(
      this.secretEnvironmentService.persistableSecretEnvironments,
      (newSecretEnvironment) => {
        window.localStorage.setItem(
          secretEnvironmentsKey,
          JSON.stringify(newSecretEnvironment)
        )
      },
      {
        debounce: 500,
      }
    )
  }

  private setupSelectedEnvPersistence() {
    const selectedEnvIndexKey = "selectedEnvIndex"
    let selectedEnvIndexValue = JSON.parse(
      window.localStorage.getItem(selectedEnvIndexKey) ?? "null"
    )

    // Validate data read from localStorage
    const result = SELECTED_ENV_INDEX_SCHEMA.safeParse(selectedEnvIndexValue)
    if (result.success) {
      selectedEnvIndexValue = result.data
    } else {
      this.showErrorToast(selectedEnvIndexKey)
      window.localStorage.setItem(
        `${selectedEnvIndexKey}-backup`,
        JSON.stringify(selectedEnvIndexValue)
      )
    }

    // If there is a selected env index, set it to the store else set it to null
    if (selectedEnvIndexValue) {
      setSelectedEnvironmentIndex(selectedEnvIndexValue)
    } else {
      setSelectedEnvironmentIndex({
        type: "NO_ENV_SELECTED",
      })
    }

    selectedEnvironmentIndex$.subscribe((envIndex) => {
      window.localStorage.setItem(selectedEnvIndexKey, JSON.stringify(envIndex))
    })
  }

  private setupWebsocketPersistence() {
    const wsRequestKey = "WebsocketRequest"
    let wsRequestData = JSON.parse(
      window.localStorage.getItem(wsRequestKey) || "null"
    )

    // Validate data read from localStorage
    const result = WEBSOCKET_REQUEST_SCHEMA.safeParse(wsRequestData)
    if (result.success) {
      wsRequestData = result.data
    } else {
      this.showErrorToast(wsRequestKey)
      window.localStorage.setItem(
        `${wsRequestKey}-backup`,
        JSON.stringify(wsRequestData)
      )
    }

    setWSRequest(wsRequestData)

    WSRequest$.subscribe((req) => {
      window.localStorage.setItem(wsRequestKey, JSON.stringify(req))
    })
  }

  private setupSocketIOPersistence() {
    const sioRequestKey = "SocketIORequest"
    let sioRequestData = JSON.parse(
      window.localStorage.getItem(sioRequestKey) || "null"
    )

    // Validate data read from localStorage
    const result = SOCKET_IO_REQUEST_SCHEMA.safeParse(sioRequestData)
    if (result.success) {
      sioRequestData = result.data
    } else {
      this.showErrorToast(sioRequestKey)
      window.localStorage.setItem(
        `${sioRequestKey}-backup`,
        JSON.stringify(sioRequestData)
      )
    }

    setSIORequest(sioRequestData)

    SIORequest$.subscribe((req) => {
      window.localStorage.setItem(sioRequestKey, JSON.stringify(req))
    })
  }

  private setupSSEPersistence() {
    const sseRequestKey = "SSERequest"
    let sseRequestData = JSON.parse(
      window.localStorage.getItem(sseRequestKey) || "null"
    )

    // Validate data read from localStorage
    const result = SSE_REQUEST_SCHEMA.safeParse(sseRequestData)
    if (result.success) {
      sseRequestData = result.data
    } else {
      this.showErrorToast(sseRequestKey)
      window.localStorage.setItem(
        `${sseRequestKey}-backup`,
        JSON.stringify(sseRequestData)
      )
    }

    setSSERequest(sseRequestData)

    SSERequest$.subscribe((req) => {
      window.localStorage.setItem(sseRequestKey, JSON.stringify(req))
    })
  }

  private setupMQTTPersistence() {
    const mqttRequestKey = "MQTTRequest"
    let mqttRequestData = JSON.parse(
      window.localStorage.getItem(mqttRequestKey) || "null"
    )

    // Validate data read from localStorage
    const result = MQTT_REQUEST_SCHEMA.safeParse(mqttRequestData)
    if (result.success) {
      mqttRequestData = result.data
    } else {
      this.showErrorToast(mqttRequestKey)
      window.localStorage.setItem(
        `${mqttRequestKey}-backup`,
        JSON.stringify(mqttRequestData)
      )
    }

    setMQTTRequest(mqttRequestData)

    MQTTRequest$.subscribe((req) => {
      window.localStorage.setItem(mqttRequestKey, JSON.stringify(req))
    })
  }

  private setupGlobalEnvsPersistence() {
    const globalEnvKey = "globalEnv"
    let globalEnvData: GlobalEnvironment = JSON.parse(
      window.localStorage.getItem(globalEnvKey) || "[]"
    )

    // Validate data read from localStorage
    const result = GlobalEnvironment.safeParse(globalEnvData)
    if (result.type === "ok") {
      globalEnvData = result.value
    } else {
      this.showErrorToast(globalEnvKey)
      window.localStorage.setItem(
        `${globalEnvKey}-backup`,
        JSON.stringify(globalEnvData)
      )
    }

    setGlobalEnvVariables(globalEnvData)

    globalEnv$.subscribe((vars) => {
      window.localStorage.setItem(globalEnvKey, JSON.stringify(vars))
    })
  }

  private setupGQLTabsPersistence() {
    const gqlTabStateKey = "gqlTabState"
    const gqlTabStateData = window.localStorage.getItem(gqlTabStateKey)

    try {
      if (gqlTabStateData) {
        let parsedGqlTabStateData = JSON.parse(gqlTabStateData)

        // Validate data read from localStorage
        const result = GQL_TAB_STATE_SCHEMA.safeParse(parsedGqlTabStateData)

        if (result.success) {
          parsedGqlTabStateData = result.data
        } else {
          this.showErrorToast(gqlTabStateKey)
          window.localStorage.setItem(
            `${gqlTabStateKey}-backup`,
            JSON.stringify(parsedGqlTabStateData)
          )
        }

        this.gqlTabService.loadTabsFromPersistedState(parsedGqlTabStateData)
      }
    } catch (e) {
      console.error(
        `Failed parsing persisted tab state, state:`,
        gqlTabStateData
      )
    }

    watchDebounced(
      this.gqlTabService.persistableTabState,
      (newGqlTabStateData) => {
        window.localStorage.setItem(
          gqlTabStateKey,
          JSON.stringify(newGqlTabStateData)
        )
      },
      { debounce: 500, deep: true }
    )
  }

  private setupRESTTabsPersistence() {
    const restTabStateKey = "restTabState"
    const restTabStateData = window.localStorage.getItem(restTabStateKey)

    try {
      if (restTabStateData) {
        let parsedGqlTabStateData = JSON.parse(restTabStateData)

        // Validate data read from localStorage
        const result = REST_TAB_STATE_SCHEMA.safeParse(parsedGqlTabStateData)

        if (result.success) {
          parsedGqlTabStateData = result.data
        } else {
          this.showErrorToast(restTabStateKey)
          window.localStorage.setItem(
            `${restTabStateKey}-backup`,
            JSON.stringify(parsedGqlTabStateData)
          )
        }

        this.restTabService.loadTabsFromPersistedState(parsedGqlTabStateData)
      }
    } catch (e) {
      console.error(
        `Failed parsing persisted tab state, state:`,
        restTabStateData
      )
    }

    watchDebounced(
      this.restTabService.persistableTabState,
      (newRestTabStateData) => {
        window.localStorage.setItem(
          restTabStateKey,
          JSON.stringify(newRestTabStateData)
        )
      },
      { debounce: 500, deep: true }
    )
  }

  public setupLocalPersistence() {
    this.checkAndMigrateOldSettings()

    this.setupLocalStatePersistence()
    this.setupSettingsPersistence()
    this.setupRESTTabsPersistence()

    this.setupGQLTabsPersistence()

    this.setupHistoryPersistence()
    this.setupCollectionsPersistence()
    this.setupGlobalEnvsPersistence()
    this.setupEnvironmentsPersistence()
    this.setupSelectedEnvPersistence()
    this.setupWebsocketPersistence()
    this.setupSocketIOPersistence()
    this.setupSSEPersistence()
    this.setupMQTTPersistence()

    this.setupSecretEnvironmentsPersistence()
  }

  /**
   * Gets a value from localStorage
   *
   * NOTE: Use localStorage to only store non-reactive simple data
   * For more complex data, use stores and connect it to `PersistenceService`
   */
  public getLocalConfig(name: string) {
    return window.localStorage.getItem(name)
  }

  /**
   * Sets a value in localStorage
   *
   * NOTE: Use localStorage to only store non-reactive simple data
   * For more complex data, use stores and connect it to `PersistenceService`
   */
  public setLocalConfig(key: string, value: string) {
    window.localStorage.setItem(key, value)
  }

  /**
   * Clear config value in localStorage
   */
  public removeLocalConfig(key: string) {
    window.localStorage.removeItem(key)
  }
}
