/* eslint-disable no-restricted-globals, no-restricted-syntax */

import {
  translateToNewGQLCollection,
  translateToNewRESTCollection,
} from "@hoppscotch/data"
import { watchDebounced } from "@vueuse/core"
import { TestContainer } from "dioc/testing"
import { cloneDeep } from "lodash-es"
import superjson from "superjson"
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest"

import { MQTTRequest$, setMQTTRequest } from "~/newstore/MQTTSession"
import { SSERequest$, setSSERequest } from "~/newstore/SSESession"
import { SIORequest$, setSIORequest } from "~/newstore/SocketIOSession"
import { WSRequest$, setWSRequest } from "~/newstore/WebSocketSession"
import {
  graphqlCollectionStore,
  restCollectionStore,
  setGraphqlCollections,
  setRESTCollections,
} from "~/newstore/collections"
import {
  addGlobalEnvVariable,
  environments$,
  globalEnv$,
  replaceEnvironments,
  selectedEnvironmentIndex$,
  setGlobalEnvVariables,
  setSelectedEnvironmentIndex,
} from "~/newstore/environments"
import {
  graphqlHistoryStore,
  restHistoryStore,
  setGraphqlHistoryEntries,
  setRESTHistoryEntries,
  translateToNewGQLHistory,
  translateToNewRESTHistory,
} from "~/newstore/history"
import { bulkApplyLocalState, localStateStore } from "~/newstore/localstate"
import {
  applySetting,
  bulkApplySettings,
  performSettingsDataMigrations,
  settingsStore,
} from "~/newstore/settings"
import { GQLTabService } from "~/services/tab/graphql"
import { RESTTabService } from "~/services/tab/rest"
import {
  PersistenceService,
  STORE_KEYS,
  STORE_NAMESPACE,
} from "../../persistence"
import {
  ENVIRONMENTS_MOCK,
  GLOBAL_ENV_MOCK,
  GQL_COLLECTIONS_MOCK,
  GQL_HISTORY_MOCK,
  GQL_TAB_STATE_MOCK,
  MQTT_REQUEST_MOCK,
  REST_COLLECTIONS_MOCK,
  REST_HISTORY_MOCK,
  REST_TAB_STATE_MOCK,
  SECRET_ENVIRONMENTS_MOCK,
  SELECTED_ENV_INDEX_MOCK,
  SOCKET_IO_REQUEST_MOCK,
  SSE_REQUEST_MOCK,
  VUEX_DATA_MOCK,
  WEBSOCKET_REQUEST_MOCK,
} from "./__mocks__"
import { SecretEnvironmentService } from "~/services/secret-environment.service"
import { getKernelMode, initKernel } from "@hoppscotch/kernel"
import { Store } from "~/kernel"

initKernel(getKernelMode())

vi.mock("~/modules/i18n", () => {
  return {
    __esModule: true,
    getI18n: vi.fn().mockImplementation(() => () => "test"),
  }
})

// Define modules that are shared across methods here
vi.mock("@vueuse/core", async (importOriginal) => {
  const actualModule: Record<string, unknown> = await importOriginal()

  return {
    ...actualModule,
    watchDebounced: vi.fn(),
  }
})

vi.mock("~/newstore/environments", () => {
  return {
    addGlobalEnvVariable: vi.fn(),
    setGlobalEnvVariables: vi.fn(),
    replaceEnvironments: vi.fn(),
    setSelectedEnvironmentIndex: vi.fn(),
    environments$: {
      subscribe: vi.fn(),
    },
    globalEnv$: {
      subscribe: vi.fn(),
    },
    selectedEnvironmentIndex$: {
      subscribe: vi.fn(),
    },
  }
})

vi.mock("~/newstore/settings", () => {
  return {
    applySetting: vi.fn(),
  }
})

const toastErrorFn = vi.fn()

vi.mock("~/composables/toast", () => {
  return {
    useToast: () => ({ error: toastErrorFn }),
  }
})

/**
 * Helper functions
 */
const spyOnGetItem = () => vi.spyOn(Storage.prototype, "getItem")
const spyOnRemoveItem = () => vi.spyOn(Storage.prototype, "removeItem")
const spyOnSetItem = () => vi.spyOn(Storage.prototype, "setItem")

const schemaVersionKey = `${STORE_NAMESPACE}:${STORE_KEYS.SCHEMA_VERSION}`

const setStoreItem = async <T>(key: string, value: T) => {
  const storedData = {
    schemaVersion: 1,
    metadata: {
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      namespace: STORE_NAMESPACE,
      encrypted: false,
      compressed: false,
    },
    data: value,
  }

  window.localStorage.setItem(key, superjson.stringify(storedData))
}

const bindPersistenceService = ({
  mockGQLTabService = false,
  mockRESTTabService = false,
  mockSecretEnvironmentsService = false,
  mock = {},
}: {
  mockGQLTabService?: boolean
  mockRESTTabService?: boolean
  mockSecretEnvironmentsService?: boolean
  mock?: Record<string, unknown>
} = {}) => {
  const container = new TestContainer()

  if (mockGQLTabService) {
    container.bindMock(GQLTabService, mock)
  }

  if (mockRESTTabService) {
    container.bindMock(RESTTabService, mock)
  }

  if (mockSecretEnvironmentsService) {
    container.bindMock(SecretEnvironmentService, mock)
  }

  container.bind(PersistenceService)

  const service = container.bind(PersistenceService)
  return service
}

const invokeSetupLocalPersistence = async (
  serviceBindMock?: Record<string, unknown>
) => {
  const service = bindPersistenceService(serviceBindMock)
  await service.setupFirst()
  await service.setupLater()
}

describe("PersistenceService", () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  beforeEach(async () => {
    await Store.remove(STORE_NAMESPACE, STORE_KEYS.SCHEMA_VERSION)
  })

  afterAll(() => {
    // Clear all mocks
    vi.clearAllMocks()

    // Restore the original implementation for any spied functions
    vi.restoreAllMocks()
  })

  describe("setup", () => {
    describe("Check and migrate old settings", () => {
      // Set of keys read from localStorage across test cases
      const bgColorKey = "BG_COLOR"
      const nuxtColorModeKey = "nuxt-color-mode"
      const selectedEnvIndexKey = "selectedEnvIndex"
      const themeColorKey = "THEME_COLOR"
      const vuexKey = "vuex"

      it(`sets the selected environment index type as "NO_ENV" in localStorage if the value retrieved for ${selectedEnvIndexKey} is "-1"`, async () => {
        window.localStorage.setItem(selectedEnvIndexKey, "-1")

        const getItemSpy = spyOnGetItem()
        const setItemSpy = spyOnSetItem()

        await invokeSetupLocalPersistence()

        expect(getItemSpy).toHaveBeenCalledWith(selectedEnvIndexKey)
        expect(setItemSpy).toHaveBeenCalledWith(
          selectedEnvIndexKey,
          JSON.stringify({
            type: "NO_ENV_SELECTED",
          })
        )
      })

      it(`sets the selected environment index type as "MY_ENV" in localStorage if the value retrieved for "${selectedEnvIndexKey}" is greater than "0"`, async () => {
        window.localStorage.setItem(selectedEnvIndexKey, "1")

        const getItemSpy = spyOnGetItem()
        const setItemSpy = spyOnSetItem()

        await invokeSetupLocalPersistence()

        expect(getItemSpy).toHaveBeenCalledWith(selectedEnvIndexKey)
        expect(setItemSpy).toHaveBeenCalledWith(
          selectedEnvIndexKey,
          JSON.stringify({
            type: "MY_ENV",
            index: 1,
          })
        )
      })

      it(`skips schema parsing and setting other properties if ${vuexKey} read from localStorage is an empty entity`, async () => {
        window.localStorage.setItem(vuexKey, JSON.stringify({}))

        const getItemSpy = spyOnGetItem()
        const setItemSpy = spyOnSetItem()

        await invokeSetupLocalPersistence()

        expect(getItemSpy).toHaveBeenCalledWith(vuexKey)

        expect(toastErrorFn).not.toHaveBeenCalled()
        expect(setItemSpy).not.toHaveBeenCalled()
      })

      it(`shows an error and sets the entry as a backup in localStorage if "${vuexKey}" read from localStorage doesn't match the schema`, async () => {
        // Invalid shape for `vuex`
        // `postwoman.settings.CURRENT_INTERCEPTOR_ID` -> `string`
        const vuexData = {
          ...VUEX_DATA_MOCK,
          postwoman: {
            ...VUEX_DATA_MOCK.postwoman,
            settings: {
              ...VUEX_DATA_MOCK.postwoman.settings,
              CURRENT_INTERCEPTOR_ID: 1234,
            },
          },
        }

        window.localStorage.setItem(vuexKey, JSON.stringify(vuexData))

        const getItemSpy = spyOnGetItem()
        const setItemSpy = spyOnSetItem()

        await invokeSetupLocalPersistence()

        expect(getItemSpy).toHaveBeenCalledWith(vuexKey)
        expect(toastErrorFn).toHaveBeenCalledWith(
          expect.stringContaining(vuexKey)
        )
        expect(setItemSpy).toHaveBeenCalledWith(
          `${vuexKey}-backup`,
          JSON.stringify(vuexData)
        )
      })

      it(`shows an error and sets the entry as a backup in localStorage if "${themeColorKey}" read from localStorage doesn't match the schema`, async () => {
        const vuexData = cloneDeep(VUEX_DATA_MOCK)
        window.localStorage.setItem(vuexKey, JSON.stringify(vuexData))

        const themeColorValue = "invalid-color"
        window.localStorage.setItem(themeColorKey, themeColorValue)

        const getItemSpy = spyOnGetItem()
        const removeItemSpy = spyOnRemoveItem()
        const setItemSpy = spyOnSetItem()

        await invokeSetupLocalPersistence()

        expect(getItemSpy).toHaveBeenCalledWith(vuexKey)

        expect(toastErrorFn).toHaveBeenCalledWith(
          expect.stringContaining(themeColorKey)
        )
        expect(setItemSpy).toHaveBeenCalledWith(
          `${themeColorKey}-backup`,
          themeColorValue
        )

        expect(applySetting).toHaveBeenCalledWith(
          themeColorKey,
          themeColorValue
        )
        expect(removeItemSpy).toHaveBeenCalledWith(themeColorKey)
      })

      it(`shows an error and sets the entry as a backup in localStorage if "${nuxtColorModeKey}" read from localStorage doesn't match the schema`, async () => {
        const vuexData = cloneDeep(VUEX_DATA_MOCK)
        window.localStorage.setItem(vuexKey, JSON.stringify(vuexData))

        const nuxtColorModeValue = "invalid-color"
        window.localStorage.setItem(nuxtColorModeKey, nuxtColorModeValue)

        const getItemSpy = spyOnGetItem()
        const removeItemSpy = spyOnRemoveItem()
        const setItemSpy = spyOnSetItem()

        await invokeSetupLocalPersistence()

        expect(getItemSpy).toHaveBeenCalledWith(vuexKey)

        expect(toastErrorFn).toHaveBeenCalledWith(
          expect.stringContaining(nuxtColorModeKey)
        )
        expect(setItemSpy).toHaveBeenCalledWith(
          `${nuxtColorModeKey}-backup`,
          nuxtColorModeValue
        )

        expect(applySetting).toHaveBeenCalledWith(
          bgColorKey,
          nuxtColorModeValue
        )
        expect(removeItemSpy).toHaveBeenCalledWith(nuxtColorModeKey)
      })

      it(`extracts individual properties from the key "${vuexKey}" and sets them in localStorage`, async () => {
        const vuexData = cloneDeep(VUEX_DATA_MOCK)
        window.localStorage.setItem(vuexKey, JSON.stringify(vuexData))

        const themeColor = "red"
        const nuxtColorMode = "dark"

        window.localStorage.setItem(themeColorKey, themeColor)
        window.localStorage.setItem(nuxtColorModeKey, nuxtColorMode)

        const getItemSpy = spyOnGetItem()
        const removeItemSpy = spyOnRemoveItem()
        const setItemSpy = spyOnSetItem()

        await invokeSetupLocalPersistence()

        expect(getItemSpy).toHaveBeenCalledWith(vuexKey)

        expect(toastErrorFn).not.toHaveBeenCalledWith(nuxtColorModeKey)
        expect(setItemSpy).not.toHaveBeenCalledWith(
          `${nuxtColorModeKey}-backup`
        )

        expect(setItemSpy).toHaveBeenCalledWith(
          "settings",
          JSON.stringify(vuexData.postwoman.settings)
        )

        const { postwoman } = vuexData
        delete postwoman.settings

        expect(setItemSpy).toHaveBeenCalledWith(
          vuexKey,
          JSON.stringify(vuexData)
        )

        // Excluding `settings`
        expect(setItemSpy).toHaveBeenCalledWith(
          "collections",
          JSON.stringify(postwoman.collections)
        )

        delete postwoman.collections

        // Excluding `settings` & `collections`
        expect(setItemSpy).toHaveBeenCalledWith(
          vuexKey,
          JSON.stringify(vuexData)
        )

        expect(setItemSpy).toHaveBeenCalledWith(
          "collectionsGraphql",
          JSON.stringify(postwoman.collectionsGraphql)
        )

        delete postwoman.collectionsGraphql

        // Excluding `settings, `collections` & `collectionsGraphql`
        expect(setItemSpy).toHaveBeenCalledWith(
          vuexKey,
          JSON.stringify(vuexData)
        )

        expect(setItemSpy).toHaveBeenCalledWith(
          "environments",
          JSON.stringify(postwoman.environments)
        )

        delete postwoman.environments

        // Excluding `settings, `collections`, `collectionsGraphql` & `environments`
        expect(setItemSpy).toHaveBeenCalledWith(
          vuexKey,
          JSON.stringify(vuexData)
        )

        expect(getItemSpy).toHaveBeenCalledWith(themeColorKey)
        expect(applySetting).toHaveBeenCalledWith(themeColorKey, themeColor)
        expect(removeItemSpy).toHaveBeenCalledWith(themeColorKey)
        expect(window.localStorage.getItem(themeColorKey)).toBe(null)

        expect(getItemSpy).toHaveBeenCalledWith(nuxtColorModeKey)
        expect(applySetting).toHaveBeenCalledWith(bgColorKey, nuxtColorMode)
        expect(removeItemSpy).toHaveBeenCalledWith(nuxtColorModeKey)
        expect(window.localStorage.getItem(nuxtColorModeKey)).toBe(null)
      })
    })

    describe("Setup local state persistence", () => {
      // Key read from localStorage across test cases
      const localStateKey = "localState"

      it(`shows an error and sets the entry as a backup in localStorage if "${localStateKey}" read from localStorage has a value which is not a "string" or "undefined"`, async () => {
        const localStateData = {
          REMEMBERED_TEAM_ID: null,
        }
        window.localStorage.setItem(
          localStateKey,
          JSON.stringify(localStateData)
        )

        const getItemSpy = spyOnGetItem()
        const setItemSpy = spyOnSetItem()

        await invokeSetupLocalPersistence()

        expect(getItemSpy).toHaveBeenCalledWith(localStateKey)

        expect(toastErrorFn).toHaveBeenCalledWith(
          expect.stringContaining(localStateKey)
        )
        expect(setItemSpy).toHaveBeenCalledWith(
          `${localStateKey}-backup`,
          JSON.stringify(localStateData)
        )
      })

      it(`shows an error and sets the entry as a backup in localStorage if "${localStateKey}" read from localStorage has an invalid key`, async () => {
        const localStateData = {
          INVALID_KEY: null,
        }
        window.localStorage.setItem(
          localStateKey,
          JSON.stringify(localStateData)
        )

        const getItemSpy = spyOnGetItem()
        const setItemSpy = spyOnSetItem()

        await invokeSetupLocalPersistence()

        expect(getItemSpy).toHaveBeenCalledWith(localStateKey)

        expect(toastErrorFn).toHaveBeenCalledWith(
          expect.stringContaining(localStateKey)
        )
        expect(setItemSpy).toHaveBeenCalledWith(
          `${localStateKey}-backup`,
          JSON.stringify(localStateData)
        )
      })

      it(`schema parsing succeeds if there is no "${localStateKey}" key present in localStorage where the fallback of "{}" is chosen`, async () => {
        window.localStorage.removeItem(localStateKey)

        const getItemSpy = spyOnGetItem()
        const setItemSpy = spyOnSetItem()

        await invokeSetupLocalPersistence()

        expect(getItemSpy).toHaveBeenCalledWith(localStateKey)

        expect(toastErrorFn).not.toHaveBeenCalledWith(localStateKey)
        expect(setItemSpy).not.toHaveBeenCalled()
      })

      it(`reads the value for "${localStateKey}" key from localStorage, invokes "bulkApplyLocalState" function if a value is yielded and subscribes to "localStateStore" updates`, async () => {
        vi.mock("~/newstore/localstate", () => {
          return {
            bulkApplyLocalState: vi.fn(),
            localStateStore: {
              subject$: {
                subscribe: vi.fn(),
              },
            },
          }
        })

        const localStateData = {
          REMEMBERED_TEAM_ID: "test-id",
        }
        window.localStorage.setItem(
          localStateKey,
          JSON.stringify(localStateData)
        )

        const getItemSpy = spyOnGetItem()
        const setItemSpy = spyOnSetItem()

        await invokeSetupLocalPersistence()

        expect(getItemSpy).toHaveBeenCalledWith(localStateKey)

        expect(toastErrorFn).not.toHaveBeenCalledWith(localStateKey)
        expect(setItemSpy).not.toHaveBeenCalled()

        expect(bulkApplyLocalState).toHaveBeenCalledWith(localStateData)
        expect(localStateStore.subject$.subscribe).toHaveBeenCalledWith(
          expect.any(Function)
        )
      })
    })

    describe("Setup settings persistence", () => {
      // Key read from localStorage across test cases
      const settingsKey = "settings"

      it(`shows an error and sets the entry as a backup in localStorage if "${settingsKey}" read from localStorage doesn't match the schema`, async () => {
        // Invalid shape for `settings`
        // Expected value are booleans
        const settings = {
          EXTENSIONS_ENABLED: "true",
          PROXY_ENABLED: "true",
        }
        window.localStorage.setItem(settingsKey, JSON.stringify(settings))

        const getItemSpy = spyOnGetItem()
        const setItemSpy = spyOnSetItem()

        await invokeSetupLocalPersistence()

        expect(getItemSpy).toHaveBeenCalledWith(settingsKey)

        expect(toastErrorFn).toHaveBeenCalledWith(
          expect.stringContaining(settingsKey)
        )
        expect(setItemSpy).toHaveBeenCalledWith(
          `${settingsKey}-backup`,
          JSON.stringify(settings)
        )
      })

      it(`schema parsing succeeds if there is no "${settingsKey}" key present in localStorage where the fallback of "{}" is chosen`, async () => {
        window.localStorage.removeItem(settingsKey)

        const getItemSpy = spyOnGetItem()
        const setItemSpy = spyOnSetItem()

        await invokeSetupLocalPersistence()

        expect(getItemSpy).toHaveBeenCalledWith(settingsKey)

        expect(toastErrorFn).not.toHaveBeenCalledWith(settingsKey)
        expect(setItemSpy).not.toHaveBeenCalled()
      })

      it(`reads the value for "${settingsKey}" from localStorage, invokes "performSettingsDataMigrations" and "bulkApplySettings" functions as required and subscribes to "settingsStore" updates`, async () => {
        vi.mock("~/newstore/settings", async (importOriginal) => {
          const actualModule: Record<string, unknown> = await importOriginal()

          return {
            ...actualModule,
            applySetting: vi.fn(),
            bulkApplySettings: vi.fn(),
            performSettingsDataMigrations: vi
              .fn()
              .mockImplementation((data: any) => data),
            settingsStore: {
              subject$: {
                subscribe: vi.fn(),
              },
            },
          }
        })

        const { settings } = VUEX_DATA_MOCK.postwoman
        window.localStorage.setItem(settingsKey, JSON.stringify(settings))

        const getItemSpy = spyOnGetItem()
        const setItemSpy = spyOnSetItem()

        await invokeSetupLocalPersistence()

        // toastErrorFn = vi.fn()

        expect(getItemSpy).toHaveBeenCalledWith(settingsKey)

        expect(toastErrorFn).not.toHaveBeenCalledWith(settingsKey)
        expect(setItemSpy).not.toHaveBeenCalled()

        expect(performSettingsDataMigrations).toHaveBeenCalledWith(settings)
        expect(bulkApplySettings).toHaveBeenCalledWith(settings)

        expect(settingsStore.subject$.subscribe).toHaveBeenCalledWith(
          expect.any(Function)
        )
      })
    })

    describe("Setup history persistence", () => {
      // Keys read from localStorage across test cases
      const historyKey = "history"
      const graphqlHistoryKey = "graphqlHistory"

      it(`shows an error and sets the entry as a backup in localStorage if "${historyKey}" read from localStorage doesn't match the schema`, async () => {
        // Invalid shape for `history`
        // `v` -> `number`
        const restHistoryData = [{ ...REST_HISTORY_MOCK, v: "1" }]
        window.localStorage.setItem(historyKey, JSON.stringify(restHistoryData))

        const getItemSpy = spyOnGetItem()
        const setItemSpy = spyOnSetItem()

        await invokeSetupLocalPersistence()

        expect(getItemSpy).toHaveBeenCalledWith(historyKey)

        expect(toastErrorFn).toHaveBeenCalledWith(
          expect.stringContaining(historyKey)
        )
        expect(setItemSpy).toHaveBeenCalledWith(
          `${historyKey}-backup`,
          JSON.stringify(restHistoryData)
        )
      })

      it(`REST history schema parsing succeeds if there is no "${historyKey}" key present in localStorage where the fallback of "[]" is chosen`, async () => {
        window.localStorage.removeItem(historyKey)

        const getItemSpy = spyOnGetItem()
        const setItemSpy = spyOnSetItem()

        await invokeSetupLocalPersistence()

        expect(getItemSpy).toHaveBeenCalledWith(historyKey)

        expect(toastErrorFn).not.toHaveBeenCalledWith(historyKey)
        expect(setItemSpy).not.toHaveBeenCalled()
      })

      it(`shows an error and sets the entry as a backup in localStorage if "${graphqlHistoryKey}" read from localStorage doesn't match the schema`, async () => {
        // Invalid shape for `graphqlHistory`
        // `v` -> `number`
        const graphqlHistoryData = [{ ...GQL_HISTORY_MOCK, v: "1" }]
        window.localStorage.setItem(
          graphqlHistoryKey,
          JSON.stringify(graphqlHistoryData)
        )

        const getItemSpy = spyOnGetItem()
        const setItemSpy = spyOnSetItem()

        await invokeSetupLocalPersistence()

        expect(getItemSpy).toHaveBeenCalledWith(graphqlHistoryKey)

        expect(setItemSpy).toHaveBeenCalledWith(
          `${graphqlHistoryKey}-backup`,
          JSON.stringify(graphqlHistoryData)
        )
      })

      it(`GQL history schema parsing succeeds if there is no "${graphqlHistoryKey}" key present in localStorage where the fallback of "[]" is chosen`, async () => {
        window.localStorage.removeItem(graphqlHistoryKey)

        const getItemSpy = spyOnGetItem()
        const setItemSpy = spyOnSetItem()

        await invokeSetupLocalPersistence()

        expect(getItemSpy).toHaveBeenCalledWith(graphqlHistoryKey)

        expect(toastErrorFn).not.toHaveBeenCalledWith(graphqlHistoryKey)
        expect(setItemSpy).not.toHaveBeenCalled()
      })

      it("reads REST and GQL history entries from localStorage, translates them to the new format, writes back the updates and subscribes to the respective store for updates", async () => {
        vi.mock("~/newstore/history", () => {
          return {
            setGraphqlHistoryEntries: vi.fn(),
            setRESTHistoryEntries: vi.fn(),
            translateToNewGQLHistory: vi
              .fn()
              .mockImplementation((data: any) => data),
            translateToNewRESTHistory: vi
              .fn()
              .mockImplementation((data: any) => data),
            graphqlHistoryStore: {
              subject$: {
                subscribe: vi.fn(),
              },
            },
            restHistoryStore: {
              subject$: {
                subscribe: vi.fn(),
              },
            },
          }
        })

        const stringifiedRestHistory = JSON.stringify(REST_HISTORY_MOCK)
        const stringifiedGqlHistory = JSON.stringify(GQL_HISTORY_MOCK)

        window.localStorage.setItem(historyKey, stringifiedRestHistory)
        window.localStorage.setItem(graphqlHistoryKey, stringifiedGqlHistory)

        const getItemSpy = spyOnGetItem()
        const setItemSpy = spyOnSetItem()

        await invokeSetupLocalPersistence()

        expect(getItemSpy).toHaveBeenCalledWith(historyKey)
        expect(getItemSpy).toHaveBeenCalledWith(graphqlHistoryKey)

        expect(toastErrorFn).not.toHaveBeenCalledWith(
          historyKey,
          graphqlHistoryKey
        )
        expect(setItemSpy).not.toHaveBeenCalled()

        expect(translateToNewRESTHistory).toHaveBeenCalled()
        expect(translateToNewGQLHistory).toHaveBeenCalled()

        // This ensures `updatedOn` field is treated as a `string`
        const parsedRestHistory = JSON.parse(stringifiedRestHistory)
        const parsedGqlHistory = JSON.parse(stringifiedGqlHistory)

        expect(setRESTHistoryEntries).toHaveBeenCalledWith(parsedRestHistory)
        expect(setGraphqlHistoryEntries).toHaveBeenCalledWith(parsedGqlHistory)

        expect(restHistoryStore.subject$.subscribe).toHaveBeenCalledWith(
          expect.any(Function)
        )
        expect(graphqlHistoryStore.subject$.subscribe).toHaveBeenCalledWith(
          expect.any(Function)
        )
      })
    })

    describe("Setup collections persistence", () => {
      // Keys read from localStorage across test cases
      const collectionsKey = "collections"
      const collectionsGraphqlKey = "collectionsGraphql"

      it(`shows an error and sets the entry as a backup in localStorage if "${collectionsKey}" read from localStorage doesn't match the schema`, async () => {
        // Invalid shape for `collections`
        // `v` -> `number`
        const restCollectionsData = [{ ...REST_COLLECTIONS_MOCK, v: "1" }]
        window.localStorage.setItem(
          collectionsKey,
          JSON.stringify(restCollectionsData)
        )

        const getItemSpy = spyOnGetItem()
        const setItemSpy = spyOnSetItem()

        await invokeSetupLocalPersistence()

        expect(getItemSpy).toHaveBeenCalledWith(collectionsKey)

        expect(toastErrorFn).toHaveBeenCalledWith(
          expect.stringContaining(collectionsKey)
        )
        expect(setItemSpy).toHaveBeenCalledWith(
          `${collectionsKey}-backup`,
          JSON.stringify(restCollectionsData)
        )
      })

      it(`REST collections schema parsing succeeds if there is no "${collectionsKey}" key present in localStorage where the fallback of "[]" is chosen`, async () => {
        window.localStorage.removeItem(collectionsKey)

        const getItemSpy = spyOnGetItem()
        const setItemSpy = spyOnSetItem()

        await invokeSetupLocalPersistence()

        expect(getItemSpy).toHaveBeenCalledWith(collectionsKey)

        expect(toastErrorFn).not.toHaveBeenCalledWith(collectionsKey)
        expect(setItemSpy).not.toHaveBeenCalled()
      })

      it(`shows an error and sets the entry as a backup in localStorage if "${collectionsGraphqlKey}" read from localStorage doesn't match the schema`, async () => {
        // Invalid shape for `collectionsGraphql`
        // `v` -> `number`
        const graphqlCollectionsData = [{ ...GQL_COLLECTIONS_MOCK, v: "1" }]
        window.localStorage.setItem(
          collectionsGraphqlKey,
          JSON.stringify(graphqlCollectionsData)
        )

        const getItemSpy = spyOnGetItem()
        const setItemSpy = spyOnSetItem()

        await invokeSetupLocalPersistence()

        expect(getItemSpy).toHaveBeenCalledWith(collectionsGraphqlKey)

        expect(toastErrorFn).toHaveBeenCalledWith(
          expect.stringContaining(collectionsGraphqlKey)
        )
        expect(setItemSpy).toHaveBeenCalledWith(
          `${collectionsGraphqlKey}-backup`,
          JSON.stringify(graphqlCollectionsData)
        )
      })

      it(`GQL history schema parsing succeeds if there is no "${collectionsGraphqlKey}" key present in localStorage where the fallback of "[]" is chosen`, async () => {
        window.localStorage.removeItem(collectionsGraphqlKey)

        const getItemSpy = spyOnGetItem()
        const setItemSpy = spyOnSetItem()

        await invokeSetupLocalPersistence()

        expect(getItemSpy).toHaveBeenCalledWith(collectionsGraphqlKey)

        expect(toastErrorFn).not.toHaveBeenCalledWith(collectionsGraphqlKey)
        expect(setItemSpy).not.toHaveBeenCalled()
      })

      it("reads REST and GQL collection entries from localStorage, translates them to the new format, writes back the updates and subscribes to the respective store for updates", async () => {
        vi.mock("@hoppscotch/data", async (importOriginal) => {
          const actualModule: Record<string, unknown> = await importOriginal()

          return {
            ...actualModule,
            translateToNewGQLCollection: vi
              .fn()
              .mockImplementation((data: any) => data),
            translateToNewRESTCollection: vi
              .fn()
              .mockImplementation((data: any) => data),
          }
        })

        vi.mock("~/newstore/collections", () => {
          return {
            setGraphqlCollections: vi.fn(),
            setRESTCollections: vi.fn(),
            graphqlCollectionStore: {
              subject$: {
                subscribe: vi.fn(),
              },
            },
            restCollectionStore: {
              subject$: {
                subscribe: vi.fn(),
              },
            },
          }
        })

        const restCollections = REST_COLLECTIONS_MOCK
        const gqlCollections = GQL_COLLECTIONS_MOCK

        window.localStorage.setItem(
          collectionsKey,
          JSON.stringify(restCollections)
        )

        window.localStorage.setItem(
          collectionsGraphqlKey,
          JSON.stringify(gqlCollections)
        )

        const getItemSpy = spyOnGetItem()
        const setItemSpy = spyOnSetItem()

        await invokeSetupLocalPersistence()

        expect(getItemSpy).toHaveBeenCalledWith(collectionsKey)
        expect(getItemSpy).toHaveBeenCalledWith(collectionsGraphqlKey)

        expect(toastErrorFn).not.toHaveBeenCalledWith(
          collectionsKey,
          collectionsGraphqlKey
        )
        expect(setItemSpy).not.toHaveBeenCalled()

        expect(translateToNewGQLCollection).toHaveBeenCalled()
        expect(translateToNewRESTCollection).toHaveBeenCalled()

        expect(setRESTCollections).toHaveBeenCalledWith(restCollections)
        expect(setGraphqlCollections).toHaveBeenCalledWith(gqlCollections)

        expect(graphqlCollectionStore.subject$.subscribe).toHaveBeenCalledWith(
          expect.any(Function)
        )
        expect(restCollectionStore.subject$.subscribe).toHaveBeenCalledWith(
          expect.any(Function)
        )
      })
    })

    describe("Setup environments persistence", () => {
      // Key read from localStorage across test cases
      const environmentsKey = "environments"

      it(`shows an error and sets the entry as a backup in localStorage if "${environmentsKey}" read from localStorage doesn't match the schema`, async () => {
        // Invalid shape for `environments`
        const environments = [
          // `entries` -> `variables`
          {
            v: 1,
            id: "ENV_1",
            name: "Test",
            entries: [{ key: "test-key", value: "test-value", secret: false }],
          },
        ]

        window.localStorage.setItem(
          environmentsKey,
          JSON.stringify(environments)
        )

        const getItemSpy = spyOnGetItem()
        const setItemSpy = spyOnSetItem()

        await invokeSetupLocalPersistence()

        expect(getItemSpy).toHaveBeenCalledWith(environmentsKey)

        expect(toastErrorFn).toHaveBeenCalledWith(
          expect.stringContaining(environmentsKey)
        )
        expect(setItemSpy).toHaveBeenCalledWith(
          `${environmentsKey}-backup`,
          JSON.stringify(environments)
        )
      })

      it(`separates "globals" entries from "${environmentsKey}", subscribes to the "environmentStore" and updates localStorage entries`, async () => {
        const environments = cloneDeep(ENVIRONMENTS_MOCK)
        window.localStorage.setItem(
          "environments",
          JSON.stringify(environments)
        )

        const getItemSpy = spyOnGetItem()
        const setItemSpy = spyOnSetItem()

        await invokeSetupLocalPersistence()

        expect(getItemSpy).toHaveBeenCalledWith(environmentsKey)

        expect(toastErrorFn).not.toHaveBeenCalledWith(environmentsKey)
        expect(setItemSpy).not.toHaveBeenCalledWith(`${environmentsKey}-backup`)

        expect(addGlobalEnvVariable).toHaveBeenCalledWith(
          environments[0].variables[0]
        )

        // Removes `globals` from environments
        environments.splice(0, 1)

        expect(setItemSpy).toHaveBeenCalledWith(
          environmentsKey,
          JSON.stringify(environments)
        )
        expect(replaceEnvironments).toBeCalledWith(environments)
        expect(environments$.subscribe).toHaveBeenCalledWith(
          expect.any(Function)
        )
      })
    })

    describe("Setup selected environment persistence", () => {
      // Key read from localStorage across test cases
      const selectedEnvIndexKey = "selectedEnvIndex"

      it(`shows an error and sets the entry as a backup in localStorage if "${selectedEnvIndexKey}" read from localStorage doesn't match the schema`, async () => {
        // Invalid shape for `selectedEnvIndex`
        // `index` -> `number`
        const selectedEnvIndex = { ...SELECTED_ENV_INDEX_MOCK, index: "1" }

        window.localStorage.setItem(
          selectedEnvIndexKey,
          JSON.stringify(selectedEnvIndex)
        )

        const getItemSpy = spyOnGetItem()
        const setItemSpy = spyOnSetItem()

        await invokeSetupLocalPersistence()

        expect(getItemSpy).toHaveBeenCalledWith(selectedEnvIndexKey)

        expect(toastErrorFn).toHaveBeenCalledWith(
          expect.stringContaining(selectedEnvIndexKey)
        )
        expect(setItemSpy).toHaveBeenCalledWith(
          `${selectedEnvIndexKey}-backup`,
          JSON.stringify(selectedEnvIndex)
        )
      })

      it(`schema parsing succeeds if there is no "${selectedEnvIndexKey}" key present in localStorage where the fallback of "null" is chosen`, async () => {
        window.localStorage.removeItem(selectedEnvIndexKey)

        const getItemSpy = spyOnGetItem()
        const setItemSpy = spyOnSetItem()

        await invokeSetupLocalPersistence()

        expect(getItemSpy).toHaveBeenCalledWith(selectedEnvIndexKey)

        expect(toastErrorFn).not.toHaveBeenCalledWith(selectedEnvIndexKey)
        expect(setItemSpy).not.toHaveBeenCalled()
      })

      it(`sets it to the store if there is a value associated with the "${selectedEnvIndexKey}" key in localStorage`, async () => {
        const selectedEnvIndex = SELECTED_ENV_INDEX_MOCK

        window.localStorage.setItem(
          selectedEnvIndexKey,
          JSON.stringify(selectedEnvIndex)
        )

        const getItemSpy = spyOnGetItem()
        const setItemSpy = spyOnSetItem()

        await invokeSetupLocalPersistence()

        expect(getItemSpy).toHaveBeenCalledWith(selectedEnvIndexKey)

        expect(toastErrorFn).not.toHaveBeenCalledWith(selectedEnvIndexKey)
        expect(setItemSpy).not.toHaveBeenCalled()

        expect(setSelectedEnvironmentIndex).toHaveBeenCalledWith(
          selectedEnvIndex
        )
        expect(selectedEnvironmentIndex$.subscribe).toHaveBeenCalledWith(
          expect.any(Function)
        )
      })

      it(`sets it to "NO_ENV_SELECTED" if there is no value associated with the "${selectedEnvIndexKey}" in localStorage`, async () => {
        window.localStorage.removeItem(selectedEnvIndexKey)

        const getItemSpy = spyOnGetItem()
        const setItemSpy = spyOnSetItem()

        await invokeSetupLocalPersistence()

        expect(getItemSpy).toHaveBeenCalledWith(selectedEnvIndexKey)

        expect(toastErrorFn).not.toHaveBeenCalledWith(selectedEnvIndexKey)
        expect(setItemSpy).not.toHaveBeenCalled()

        expect(setSelectedEnvironmentIndex).toHaveBeenCalledWith({
          type: "NO_ENV_SELECTED",
        })
        expect(selectedEnvironmentIndex$.subscribe).toHaveBeenCalledWith(
          expect.any(Function)
        )
      })
    })

    describe("setup secret Environments persistence", () => {
      // Key read from localStorage across test cases
      const secretEnvironmentsKey = `${STORE_NAMESPACE}:${STORE_KEYS.SECRET_ENVIRONMENTS}`

      const loadSecretEnvironmentsFromPersistedStateFn = vi.fn()
      const mock = {
        loadSecretEnvironmentsFromPersistedState:
          loadSecretEnvironmentsFromPersistedStateFn,
      }

      it(`shows an error and sets the entry as a backup in localStorage if "${secretEnvironmentsKey}" read from localStorage doesn't match the schema`, async () => {
        // Invalid shape for `secretEnvironments`
        const secretEnvironments = {
          clryz7ir7002al4162bsj0azg: {
            key: "ENV_KEY",
            value: "ENV_VALUE",
          },
        }

        await setStoreItem(secretEnvironmentsKey, secretEnvironments)

        const getItemSpy = spyOnGetItem()
        const setItemSpy = spyOnSetItem()

        await invokeSetupLocalPersistence()

        expect(getItemSpy).toHaveBeenCalledWith(secretEnvironmentsKey)

        expect(toastErrorFn).toHaveBeenCalledWith(
          expect.stringContaining(secretEnvironmentsKey)
        )
        expect(setItemSpy).toHaveBeenCalledWith(
          `${secretEnvironmentsKey}-backup`,
          expect.stringContaining(JSON.stringify(secretEnvironments))
        )
      })

      it("loads secret environments from the state persisted in localStorage and sets watcher for `persistableSecretEnvironment`", async () => {
        const secretEnvironment = SECRET_ENVIRONMENTS_MOCK
        await setStoreItem(secretEnvironmentsKey, secretEnvironment)

        const getItemSpy = spyOnGetItem()
        const setItemSpy = spyOnSetItem()

        await invokeSetupLocalPersistence({
          mockSecretEnvironmentsService: true,
          mock,
        })

        expect(getItemSpy).toHaveBeenCalledWith(secretEnvironmentsKey)

        expect(toastErrorFn).not.toHaveBeenCalledWith(secretEnvironmentsKey)
        expect(setItemSpy).toHaveBeenCalledWith(
          schemaVersionKey,
          expect.stringContaining('"schemaVersion":1')
        )

        expect(loadSecretEnvironmentsFromPersistedStateFn).toHaveBeenCalledWith(
          secretEnvironment
        )
        expect(watchDebounced).toHaveBeenCalled()
      })

      it(`skips schema parsing and the loading of persisted secret environments if there is no "${secretEnvironmentsKey}" key present in localStorage`, async () => {
        window.localStorage.removeItem(secretEnvironmentsKey)

        const getItemSpy = spyOnGetItem()
        const setItemSpy = spyOnSetItem()

        await invokeSetupLocalPersistence({
          mockSecretEnvironmentsService: true,
          mock,
        })

        expect(getItemSpy).toHaveBeenCalledWith(secretEnvironmentsKey)

        expect(toastErrorFn).not.toHaveBeenCalledWith(secretEnvironmentsKey)
        expect(setItemSpy).toHaveBeenCalledWith(
          schemaVersionKey,
          expect.stringContaining('"schemaVersion":1')
        )

        expect(watchDebounced).toHaveBeenCalled()
      })

      it("logs an error to the console on failing to parse persisted secret environments", async () => {
        window.localStorage.setItem(secretEnvironmentsKey, "invalid-json")

        console.error = vi.fn()
        const getItemSpy = spyOnGetItem()
        const setItemSpy = spyOnSetItem()

        await invokeSetupLocalPersistence()

        expect(getItemSpy).toHaveBeenCalledWith(secretEnvironmentsKey)

        expect(toastErrorFn).not.toHaveBeenCalledWith(secretEnvironmentsKey)
        expect(setItemSpy).toHaveBeenCalledWith(
          schemaVersionKey,
          expect.stringContaining('"schemaVersion":1')
        )

        expect(console.error).toHaveBeenCalledWith(
          `Failed parsing persisted SECRET_ENVIRONMENTS:`,
          window.localStorage.getItem(secretEnvironmentsKey)
        )

        expect(watchDebounced).toHaveBeenCalledWith(
          expect.any(Object),
          expect.any(Function),
          { debounce: 500 }
        )
      })
    })

    describe("setup WebSocket persistence", () => {
      // Key read from localStorage across test cases
      const wsRequestKey = `${STORE_NAMESPACE}:${STORE_KEYS.WEBSOCKET}`

      it(`shows an error and sets the entry as a backup in localStorage if "${wsRequestKey}" read from localStorage doesn't match the schema`, async () => {
        // Invalid shape for `WebsocketRequest`
        const request = {
          ...WEBSOCKET_REQUEST_MOCK,
          // `protocols` -> `[]`
          protocols: {},
        }

        await setStoreItem(wsRequestKey, request)

        const getItemSpy = spyOnGetItem()
        const setItemSpy = spyOnSetItem()

        await invokeSetupLocalPersistence()

        expect(getItemSpy).toHaveBeenCalledWith(wsRequestKey)

        expect(toastErrorFn).toHaveBeenCalledWith(
          expect.stringContaining(wsRequestKey)
        )
        expect(setItemSpy).toHaveBeenCalledWith(
          `${wsRequestKey}-backup`,
          expect.stringContaining(JSON.stringify(request))
        )
      })

      it(`schema parsing succeeds if there is no "${wsRequestKey}" key present in localStorage where the fallback of "null" is chosen`, async () => {
        window.localStorage.removeItem(wsRequestKey)

        const getItemSpy = spyOnGetItem()
        const setItemSpy = spyOnSetItem()

        await invokeSetupLocalPersistence()

        expect(getItemSpy).toHaveBeenCalledWith(wsRequestKey)

        expect(toastErrorFn).not.toHaveBeenCalledWith(wsRequestKey)
        expect(setItemSpy).toHaveBeenCalledTimes(1)
        expect(setItemSpy).toHaveBeenCalledWith(
          schemaVersionKey,
          expect.stringContaining('"schemaVersion":1')
        )
      })

      it(`reads the "${wsRequestKey}" entry from localStorage, sets it as the new request, subscribes to the "WSSessionStore" and updates localStorage entries`, async () => {
        vi.mock("~/newstore/WebSocketSession", () => {
          return {
            setWSRequest: vi.fn(),
            WSRequest$: {
              subscribe: vi.fn(),
            },
          }
        })

        const request = WEBSOCKET_REQUEST_MOCK
        await setStoreItem(wsRequestKey, request)

        const getItemSpy = spyOnGetItem()
        const setItemSpy = spyOnSetItem()

        await invokeSetupLocalPersistence()

        expect(getItemSpy).toHaveBeenCalledWith(wsRequestKey)

        expect(toastErrorFn).not.toHaveBeenCalledWith(wsRequestKey)
        expect(setItemSpy).toHaveBeenCalledTimes(1)
        expect(setItemSpy).toHaveBeenCalledWith(
          schemaVersionKey,
          expect.stringContaining('"schemaVersion":1')
        )

        expect(setWSRequest).toHaveBeenCalledWith(request)
        expect(WSRequest$.subscribe).toHaveBeenCalledWith(expect.any(Function))
      })
    })

    describe("setup Socket.IO persistence", () => {
      // Key read from localStorage across test cases
      const sioRequestKey = `${STORE_NAMESPACE}:${STORE_KEYS.SOCKETIO}`

      it(`shows an error and sets the entry as a backup in localStorage if "${sioRequestKey}" read from localStorage doesn't match the schema`, async () => {
        // Invalid shape for `SocketIORequest`
        const request = {
          ...SOCKET_IO_REQUEST_MOCK,
          // `v` -> `version: v4`
          v: "4",
        }

        await setStoreItem(sioRequestKey, request)

        const getItemSpy = spyOnGetItem()
        const setItemSpy = spyOnSetItem()

        await invokeSetupLocalPersistence()

        expect(getItemSpy).toHaveBeenCalledWith(sioRequestKey)

        expect(toastErrorFn).toHaveBeenCalledWith(
          expect.stringContaining(sioRequestKey)
        )
        expect(setItemSpy).toHaveBeenCalledWith(
          `${sioRequestKey}-backup`,
          expect.stringContaining(JSON.stringify(request))
        )
      })

      it(`schema parsing succeeds if there is no "${sioRequestKey}" key present in localStorage where the fallback of "null" is chosen`, async () => {
        window.localStorage.removeItem(sioRequestKey)

        const getItemSpy = spyOnGetItem()
        const setItemSpy = spyOnSetItem()

        await invokeSetupLocalPersistence()

        expect(getItemSpy).toHaveBeenCalledWith(sioRequestKey)

        expect(toastErrorFn).not.toHaveBeenCalledWith(sioRequestKey)
        expect(setItemSpy).toHaveBeenCalledTimes(1)
        expect(setItemSpy).toHaveBeenCalledWith(
          schemaVersionKey,
          expect.stringContaining('"schemaVersion":1')
        )
      })

      it(`reads the "${sioRequestKey}" entry from localStorage, sets it as the new request, subscribes to the "SIOSessionStore" and updates localStorage entries`, async () => {
        vi.mock("~/newstore/SocketIOSession", () => {
          return {
            setSIORequest: vi.fn(),
            SIORequest$: {
              subscribe: vi.fn(),
            },
          }
        })

        const request = SOCKET_IO_REQUEST_MOCK
        await setStoreItem(sioRequestKey, request)

        const getItemSpy = spyOnGetItem()
        const setItemSpy = spyOnSetItem()

        await invokeSetupLocalPersistence()

        expect(getItemSpy).toHaveBeenCalledWith(sioRequestKey)

        expect(toastErrorFn).not.toHaveBeenCalledWith(sioRequestKey)
        expect(setItemSpy).toHaveBeenCalledTimes(1)
        expect(setItemSpy).toHaveBeenCalledWith(
          schemaVersionKey,
          expect.stringContaining('"schemaVersion":1')
        )

        expect(setSIORequest).toHaveBeenCalledWith(request)
        expect(SIORequest$.subscribe).toHaveBeenCalledWith(expect.any(Function))
      })
    })

    describe("setup SSE persistence", () => {
      // Key read from localStorage across test cases
      const sseRequestKey = `${STORE_NAMESPACE}:${STORE_KEYS.SSE}`

      it(`shows an error and sets the entry as a backup in localStorage if "${sseRequestKey}" read from localStorage doesn't match the versioned schema`, async () => {
        // Invalid shape for `SSERequest`
        const request = {
          ...SSE_REQUEST_MOCK,
          // `url` -> `endpoint`
          url: "https://express-eventsource.herokuapp.com/events",
        }

        await setStoreItem(sseRequestKey, request)

        const getItemSpy = spyOnGetItem()
        const setItemSpy = spyOnSetItem()

        await invokeSetupLocalPersistence()

        expect(getItemSpy).toHaveBeenCalledWith(sseRequestKey)

        expect(toastErrorFn).toHaveBeenCalledWith(
          expect.stringContaining(sseRequestKey)
        )
        expect(setItemSpy).toHaveBeenCalledWith(
          `${sseRequestKey}-backup`,
          expect.stringContaining(JSON.stringify(request))
        )
      })

      it(`schema parsing succeeds if there is no "${sseRequestKey}" key present in localStorage where the fallback of "null" is chosen`, async () => {
        window.localStorage.removeItem(sseRequestKey)

        const getItemSpy = spyOnGetItem()
        const setItemSpy = spyOnSetItem()

        await invokeSetupLocalPersistence()

        expect(getItemSpy).toHaveBeenCalledWith(sseRequestKey)

        expect(toastErrorFn).not.toHaveBeenCalledWith(sseRequestKey)
        expect(setItemSpy).toHaveBeenCalledTimes(1)
        expect(setItemSpy).toHaveBeenCalledWith(
          schemaVersionKey,
          expect.stringContaining('"schemaVersion":1')
        )
      })

      it(`reads the "${sseRequestKey}" entry from localStorage, sets it as the new request, subscribes to the "SSESessionStore" and updates localStorage entries`, async () => {
        vi.mock("~/newstore/SSESession", () => {
          return {
            setSSERequest: vi.fn(),
            SSERequest$: {
              subscribe: vi.fn(),
            },
          }
        })

        const request = SSE_REQUEST_MOCK
        await setStoreItem(sseRequestKey, request)

        const getItemSpy = spyOnGetItem()
        const setItemSpy = spyOnSetItem()

        await invokeSetupLocalPersistence()

        expect(getItemSpy).toHaveBeenCalledWith(sseRequestKey)

        expect(toastErrorFn).not.toHaveBeenCalledWith(sseRequestKey)
        expect(setItemSpy).toHaveBeenCalledTimes(1)
        expect(setItemSpy).toHaveBeenCalledWith(
          schemaVersionKey,
          expect.stringContaining('"schemaVersion":1')
        )

        expect(setSSERequest).toHaveBeenCalledWith(request)
        expect(SSERequest$.subscribe).toHaveBeenCalledWith(expect.any(Function))
      })
    })

    describe("setup MQTT persistence", () => {
      // Key read from localStorage across test cases
      const mqttRequestKey = `${STORE_NAMESPACE}:${STORE_KEYS.MQTT}`

      it(`shows an error and sets the entry as a backup in localStorage if "${mqttRequestKey}" read from localStorage doesn't match the schema`, async () => {
        // Invalid shape for `MQTTRequest`
        const request = {
          ...MQTT_REQUEST_MOCK,
          // `url` -> `endpoint`
          url: "wss://test.mosquitto.org:8081",
        }

        await setStoreItem(mqttRequestKey, request)

        const getItemSpy = spyOnGetItem()
        const setItemSpy = spyOnSetItem()

        await invokeSetupLocalPersistence()

        expect(getItemSpy).toHaveBeenCalledWith(mqttRequestKey)

        expect(toastErrorFn).toHaveBeenCalledWith(
          expect.stringContaining(mqttRequestKey)
        )
        expect(setItemSpy).toHaveBeenCalledWith(
          `${mqttRequestKey}-backup`,
          expect.stringContaining(JSON.stringify(request))
        )
      })

      it(`schema parsing succeeds if there is no "${mqttRequestKey}" key present in localStorage where the fallback of "null" is chosen`, async () => {
        window.localStorage.removeItem(mqttRequestKey)

        const getItemSpy = spyOnGetItem()
        const setItemSpy = spyOnSetItem()

        await invokeSetupLocalPersistence()

        expect(getItemSpy).toHaveBeenCalledWith(mqttRequestKey)

        expect(toastErrorFn).not.toHaveBeenCalledWith(mqttRequestKey)
        expect(setItemSpy).toHaveBeenCalledTimes(1)
        expect(setItemSpy).toHaveBeenCalledWith(
          schemaVersionKey,
          expect.stringContaining('"schemaVersion":1')
        )
      })

      it(`reads the ${mqttRequestKey}" entry from localStorage, sets it as the new request, subscribes to the "MQTTSessionStore" and updates localStorage entries`, async () => {
        vi.mock("~/newstore/MQTTSession", () => {
          return {
            setMQTTRequest: vi.fn(),
            MQTTRequest$: {
              subscribe: vi.fn(),
            },
          }
        })

        const request = MQTT_REQUEST_MOCK
        await setStoreItem(mqttRequestKey, request)

        const getItemSpy = spyOnGetItem()
        const setItemSpy = spyOnSetItem()

        await invokeSetupLocalPersistence()

        expect(getItemSpy).toHaveBeenCalledWith(mqttRequestKey)

        expect(toastErrorFn).not.toHaveBeenCalledWith(mqttRequestKey)
        expect(setItemSpy).toHaveBeenCalledTimes(1)
        expect(setItemSpy).toHaveBeenCalledWith(
          schemaVersionKey,
          expect.stringContaining('"schemaVersion":1')
        )

        expect(setMQTTRequest).toHaveBeenCalledWith(request)
        expect(MQTTRequest$.subscribe).toHaveBeenCalledWith(
          expect.any(Function)
        )
      })
    })

    describe("setup global environments persistence", () => {
      // Key read from localStorage across test cases
      const globalEnvKey = `${STORE_NAMESPACE}:${STORE_KEYS.GLOBAL_ENV}`

      it(`shows an error and sets the entry as a backup in localStorage if "${globalEnvKey}" read from localStorage doesn't match the schema`, async () => {
        // Invalid shape for `globalEnv`
        const globalEnv = [
          {
            // `key` -> `string`
            key: 1,
            value: "test-value",
          },
        ]

        await setStoreItem(globalEnvKey, globalEnv)

        const getItemSpy = spyOnGetItem()
        const setItemSpy = spyOnSetItem()

        await invokeSetupLocalPersistence()

        expect(getItemSpy).toHaveBeenCalledWith(globalEnvKey)

        expect(toastErrorFn).toHaveBeenCalledWith(
          expect.stringContaining(globalEnvKey)
        )
        expect(setItemSpy).toHaveBeenCalledWith(
          `${globalEnvKey}-backup`,
          expect.stringContaining(JSON.stringify(globalEnv))
        )
      })

      it(`schema parsing succeeds if there is no "${globalEnvKey}" key present in localStorage where the fallback of "[]" is chosen`, async () => {
        window.localStorage.removeItem(globalEnvKey)

        const getItemSpy = spyOnGetItem()
        const setItemSpy = spyOnSetItem()

        await invokeSetupLocalPersistence()

        expect(getItemSpy).toHaveBeenCalledWith(globalEnvKey)

        expect(toastErrorFn).not.toHaveBeenCalledWith(globalEnvKey)
        expect(setItemSpy).toHaveBeenCalledTimes(1)
        expect(setItemSpy).toHaveBeenCalledWith(
          schemaVersionKey,
          expect.stringContaining('"schemaVersion":1')
        )
      })

      it(`reads the "globalEnv" entry from localStorage, dispatches the new value, subscribes to the "environmentsStore" and updates localStorage entries`, async () => {
        const globalEnv = GLOBAL_ENV_MOCK
        await setStoreItem(globalEnvKey, globalEnv)

        const getItemSpy = spyOnGetItem()
        const setItemSpy = spyOnSetItem()

        await invokeSetupLocalPersistence()

        expect(getItemSpy).toHaveBeenCalledWith(globalEnvKey)

        expect(toastErrorFn).not.toHaveBeenCalledWith(globalEnvKey)
        expect(setItemSpy).toHaveBeenCalledTimes(1)
        expect(setItemSpy).toHaveBeenCalledWith(
          schemaVersionKey,
          expect.stringContaining('"schemaVersion":1')
        )

        expect(setGlobalEnvVariables).toHaveBeenCalledWith(globalEnv)
        expect(globalEnv$.subscribe).toHaveBeenCalledWith(expect.any(Function))
      })
    })

    describe("setup GQL tabs persistence", () => {
      // Key read from localStorage across test cases
      const gqlTabStateKey = `${STORE_NAMESPACE}:${STORE_KEYS.GQL_TABS}`

      const loadTabsFromPersistedStateFn = vi.fn()
      const mock = { loadTabsFromPersistedState: loadTabsFromPersistedStateFn }

      it(`shows an error and sets the entry as a backup in localStorage if "${gqlTabStateKey}" read from localStorage doesn't match the schema`, async () => {
        // Invalid shape for `gqlTabState`
        // `lastActiveTabID` -> `string`
        const gqlTabState = { ...GQL_TAB_STATE_MOCK, lastActiveTabID: 1234 }

        setStoreItem(gqlTabStateKey, gqlTabState)

        const getItemSpy = spyOnGetItem()
        const setItemSpy = spyOnSetItem()

        await invokeSetupLocalPersistence()

        expect(getItemSpy).toHaveBeenCalledWith(gqlTabStateKey)

        expect(toastErrorFn).toHaveBeenCalledWith(
          expect.stringContaining(gqlTabStateKey)
        )
        expect(setItemSpy).toHaveBeenCalledWith(
          `${gqlTabStateKey}-backup`,
          expect.stringContaining(JSON.stringify(gqlTabState))
        )
      })

      it(`skips schema parsing and the loading of persisted tabs if there is no "${gqlTabStateKey}" key present in localStorage`, async () => {
        window.localStorage.removeItem(gqlTabStateKey)

        const getItemSpy = spyOnGetItem()
        const setItemSpy = spyOnSetItem()

        await invokeSetupLocalPersistence({ mockGQLTabService: true, mock })

        expect(getItemSpy).toHaveBeenCalledWith(gqlTabStateKey)

        expect(toastErrorFn).not.toHaveBeenCalledWith(gqlTabStateKey)
        expect(setItemSpy).not.toHaveBeenCalled()
        expect(loadTabsFromPersistedStateFn).not.toHaveBeenCalled()

        expect(watchDebounced).toHaveBeenCalled()
      })

      it("loads tabs from the state persisted in localStorage and sets watcher for `persistableTabState`", async () => {
        const tabState = GQL_TAB_STATE_MOCK
        await setStoreItem(gqlTabStateKey, tabState)

        const getItemSpy = spyOnGetItem()
        const setItemSpy = spyOnSetItem()

        await invokeSetupLocalPersistence({ mockGQLTabService: true, mock })

        expect(getItemSpy).toHaveBeenCalledWith(gqlTabStateKey)

        expect(toastErrorFn).not.toHaveBeenCalledWith(gqlTabStateKey)
        expect(setItemSpy).not.toHaveBeenCalled()

        expect(loadTabsFromPersistedStateFn).toHaveBeenCalledWith(tabState)
        expect(watchDebounced).toHaveBeenCalledWith(
          expect.any(Object),
          expect.any(Function),
          { debounce: 500, deep: true }
        )
      })

      it("logs an error to the console on failing to parse persisted gql tab state", async () => {
        window.localStorage.setItem(gqlTabStateKey, "invalid-json")

        console.error = vi.fn()
        const getItemSpy = spyOnGetItem()

        await invokeSetupLocalPersistence()

        expect(getItemSpy).toHaveBeenCalledWith(gqlTabStateKey)

        expect(toastErrorFn).not.toHaveBeenCalledWith(gqlTabStateKey)

        expect(console.error).toHaveBeenCalledWith(
          `Failed parsing persisted GQL_TABS:`,
          window.localStorage.getItem(gqlTabStateKey)
        )
        expect(watchDebounced).toHaveBeenCalledWith(
          expect.any(Object),
          expect.any(Function),
          { debounce: 500, deep: true }
        )
      })
    })

    describe("setup REST tabs persistence", () => {
      // Key read from localStorage across test cases
      const restTabStateKey = `${STORE_NAMESPACE}:${STORE_KEYS.REST_TABS}`

      const loadTabsFromPersistedStateFn = vi.fn()
      const mock = { loadTabsFromPersistedState: loadTabsFromPersistedStateFn }

      it(`shows an error and sets the entry as a backup in localStorage if "${restTabStateKey}" read from localStorage doesn't match the schema`, async () => {
        // Invalid shape for `restTabState`
        // `lastActiveTabID` -> `string`
        const restTabState = { ...REST_TAB_STATE_MOCK, lastActiveTabID: 1234 }

        setStoreItem(restTabStateKey, restTabState)

        const getItemSpy = spyOnGetItem()
        const setItemSpy = spyOnSetItem()

        await invokeSetupLocalPersistence()

        expect(getItemSpy).toHaveBeenCalledWith(restTabStateKey)

        expect(toastErrorFn).toHaveBeenCalledWith(
          expect.stringContaining(restTabStateKey)
        )
        expect(setItemSpy).toHaveBeenCalledWith(
          `${restTabStateKey}-backup`,
          expect.stringContaining(JSON.stringify(restTabState))
        )
      })

      it(`skips schema parsing and the loading of persisted tabs if there is no "${restTabStateKey}" key present in localStorage`, async () => {
        window.localStorage.removeItem(restTabStateKey)

        const getItemSpy = spyOnGetItem()
        const setItemSpy = spyOnSetItem()

        await invokeSetupLocalPersistence({ mockRESTTabService: true, mock })

        expect(getItemSpy).toHaveBeenCalledWith(restTabStateKey)

        expect(toastErrorFn).not.toHaveBeenCalledWith(restTabStateKey)
        expect(setItemSpy).not.toHaveBeenCalled()
        expect(loadTabsFromPersistedStateFn).not.toHaveBeenCalled()

        expect(watchDebounced).toHaveBeenCalled()
      })

      it("loads tabs from the state persisted in localStorage and sets watcher for `persistableTabState`", async () => {
        const tabState = REST_TAB_STATE_MOCK
        await setStoreItem(restTabStateKey, tabState)

        const getItemSpy = spyOnGetItem()
        const setItemSpy = spyOnSetItem()

        await invokeSetupLocalPersistence({ mockRESTTabService: true, mock })

        expect(getItemSpy).toHaveBeenCalledWith(restTabStateKey)

        expect(toastErrorFn).not.toHaveBeenCalledWith(restTabStateKey)
        expect(setItemSpy).not.toHaveBeenCalled()

        expect(loadTabsFromPersistedStateFn).toHaveBeenCalledWith(tabState)
        expect(watchDebounced).toHaveBeenCalledWith(
          expect.any(Object),
          expect.any(Function),
          { debounce: 500, deep: true }
        )
      })

      it("logs an error to the console on failing to parse persisted rest tab state", async () => {
        window.localStorage.setItem(restTabStateKey, "invalid-json")

        console.error = vi.fn()
        const getItemSpy = spyOnGetItem()

        await invokeSetupLocalPersistence()

        expect(getItemSpy).toHaveBeenCalledWith(restTabStateKey)

        expect(toastErrorFn).not.toHaveBeenCalledWith(restTabStateKey)

        expect(console.error).toHaveBeenCalledWith(
          `Failed parsing persisted REST_TABS:`,
          window.localStorage.getItem(restTabStateKey)
        )
        expect(watchDebounced).toHaveBeenCalledWith(
          expect.any(Object),
          expect.any(Function),
          { debounce: 500, deep: true }
        )
      })
    })
  })

  it("`setLocalConfig` method sets a value in localStorage", async () => {
    const testKey = "test-key"
    const testValue = "test-value"

    const setItemSpy = spyOnSetItem()

    const service = bindPersistenceService()

    await service.setLocalConfig(testKey, testValue)
    expect(setItemSpy).toHaveBeenCalledWith(
      `${STORE_NAMESPACE}:${testKey}`,
      expect.stringContaining(testValue)
    )
  })

  it("`getLocalConfig` method gets a value from localStorage", async () => {
    const testKey = "test-key"
    const testValue = "test-value"

    const setItemSpy = spyOnSetItem()
    const getItemSpy = spyOnGetItem()

    const service = bindPersistenceService()

    await service.setLocalConfig(testKey, testValue)
    const retrievedValue = await service.getLocalConfig(testKey)

    expect(setItemSpy).toHaveBeenCalledWith(
      `${STORE_NAMESPACE}:${testKey}`,
      expect.stringContaining(testValue)
    )
    expect(getItemSpy).toHaveBeenCalledWith(`${STORE_NAMESPACE}:${testKey}`)
    expect(retrievedValue).toBe(testValue)
  })

  it("`removeLocalConfig` method clears a value in localStorage", async () => {
    const testKey = "test-key"
    const testValue = "test-value"

    const setItemSpy = spyOnSetItem()
    const removeItemSpy = spyOnRemoveItem()

    const service = bindPersistenceService()

    await service.setLocalConfig(testKey, testValue)
    await service.removeLocalConfig(testKey)

    expect(setItemSpy).toHaveBeenCalledWith(
      `${STORE_NAMESPACE}:${testKey}`,
      expect.stringContaining(testValue)
    )
    expect(removeItemSpy).toHaveBeenCalledWith(`${STORE_NAMESPACE}:${testKey}`)
  })
})
