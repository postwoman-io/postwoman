import {
  Environment,
  GlobalEnvironment,
  HoppCollection,
  RESTReqSchemaVersion,
} from "@hoppscotch/data"

import { HoppGQLDocument } from "~/helpers/graphql/document"
import { HoppRequestDocument } from "~/helpers/rest/document"
import { GQLHistoryEntry, RESTHistoryEntry } from "~/newstore/history"
import { SettingsDef, getDefaultSettings } from "~/newstore/settings"
import { SecretVariable } from "~/services/secret-environment.service"
import { PersistableTabState } from "~/services/tab"

type VUEX_DATA = {
  postwoman: {
    settings?: SettingsDef
    collections?: HoppCollection[]
    collectionsGraphql?: HoppCollection[]
    environments?: Environment[]
  }
}

const DEFAULT_SETTINGS = getDefaultSettings()

export const REST_COLLECTIONS_MOCK: HoppCollection[] = [
  {
    v: 4,
    name: "Echo",
    folders: [],
    requests: [
      {
        v: RESTReqSchemaVersion,
        endpoint: "https://echo.hoppscotch.io",
        name: "Echo test",
        params: [],
        headers: [],
        method: "GET",
        auth: { authType: "none", authActive: true },
        preRequestScript: "",
        testScript: "",
        body: { contentType: null, body: null },
        requestVariables: [],
        responses: {},
      },
    ],
    auth: { authType: "none", authActive: true },
    headers: [],
  },
]

export const GQL_COLLECTIONS_MOCK: HoppCollection[] = [
  {
    v: 4,
    name: "Echo",
    folders: [],
    requests: [
      {
        v: 7,
        name: "Echo test",
        url: "https://echo.hoppscotch.io/graphql",
        headers: [],
        variables: '{\n  "id": "1"\n}',
        query: "query Request { url }",
        auth: { authType: "none", authActive: true },
      },
    ],
    auth: { authType: "none", authActive: true },
    headers: [],
  },
]

export const ENVIRONMENTS_MOCK: Environment[] = [
  {
    v: 1,
    id: "ENV_1",
    name: "globals",
    variables: [
      {
        key: "test-global-key",
        value: "test-global-value",
        secret: false,
      },
    ],
  },
  {
    v: 1,
    id: "ENV_2",
    name: "Test",
    variables: [{ key: "test-key", value: "test-value", secret: false }],
  },
]

export const SELECTED_ENV_INDEX_MOCK = {
  type: "MY_ENV",
  index: 1,
}

export const WEBSOCKET_REQUEST_MOCK = {
  endpoint: "wss://echo-websocket.hoppscotch.io",
  protocols: [],
}

export const SOCKET_IO_REQUEST_MOCK = {
  endpoint: "wss://echo-socketio.hoppscotch.io",
  path: "/socket.io",
  version: "v4",
}

export const SSE_REQUEST_MOCK = {
  endpoint: "https://express-eventsource.herokuapp.com/events",
  eventType: "data",
}

export const MQTT_REQUEST_MOCK = {
  endpoint: "wss://test.mosquitto.org:8081",
  clientID: "hoppscotch",
}

export const GLOBAL_ENV_MOCK: GlobalEnvironment = {
  v: 1,
  variables: [{ key: "test-key", value: "test-value", secret: false }],
}

export const VUEX_DATA_MOCK: VUEX_DATA = {
  postwoman: {
    settings: { ...DEFAULT_SETTINGS, THEME_COLOR: "purple" },
    collections: REST_COLLECTIONS_MOCK,
    collectionsGraphql: GQL_COLLECTIONS_MOCK,
    environments: ENVIRONMENTS_MOCK,
  },
}

export const REST_HISTORY_MOCK: RESTHistoryEntry[] = [
  {
    v: 1,
    request: {
      auth: { authType: "none", authActive: true },
      body: { contentType: null, body: null },
      endpoint: "https://echo.hoppscotch.io",
      headers: [],
      method: "GET",
      name: "Untitled",
      params: [],
      preRequestScript: "",
      testScript: "",
      requestVariables: [],
      v: RESTReqSchemaVersion,
      responses: {},
    },
    responseMeta: { duration: 807, statusCode: 200 },
    star: false,
    updatedOn: new Date("2023-11-07T05:27:32.951Z"),
  },
]

export const GQL_HISTORY_MOCK: GQLHistoryEntry[] = [
  {
    v: 1,
    request: {
      v: 7,
      name: "Untitled",
      url: "https://echo.hoppscotch.io/graphql",
      query: "query Request { url }",
      headers: [],
      variables: "",
      auth: { authType: "none", authActive: true },
    },
    response: '{"data":{"url":"/graphql"}}',
    star: false,
    updatedOn: new Date("2023-11-07T05:28:21.073Z"),
  },
]

export const GQL_TAB_STATE_MOCK: PersistableTabState<HoppGQLDocument> = {
  lastActiveTabID: "5edbe8d4-65c9-4381-9354-5f1bf05d8ccc",
  orderedDocs: [
    {
      tabID: "5edbe8d4-65c9-4381-9354-5f1bf05d8ccc",
      doc: {
        request: {
          v: 7,
          name: "Untitled",
          url: "https://echo.hoppscotch.io/graphql",
          headers: [],
          variables: '{\n  "id": "1"\n}',
          query: "query Request { url }",
          auth: { authType: "none", authActive: true },
        },
        isDirty: true,
        optionTabPreference: "query",
        response: null,
      },
    },
  ],
}

export const REST_TAB_STATE_MOCK: PersistableTabState<HoppRequestDocument> = {
  lastActiveTabID: "e6e8d800-caa8-44a2-a6a6-b4765a3167aa",
  orderedDocs: [
    {
      tabID: "e6e8d800-caa8-44a2-a6a6-b4765a3167aa",
      doc: {
        request: {
          v: RESTReqSchemaVersion,
          endpoint: "https://echo.hoppscotch.io",
          name: "Echo test",
          params: [],
          headers: [],
          method: "GET",
          auth: { authType: "none", authActive: true },
          preRequestScript: "",
          testScript: "",
          body: { contentType: null, body: null },
          requestVariables: [],
          responses: {},
        },
        isDirty: false,
        type: "request",
        saveContext: {
          originLocation: "user-collection",
          folderPath: "0",
          requestIndex: 0,
        },
        response: null,
      },
    },
  ],
}

export const SECRET_ENVIRONMENTS_MOCK: Record<string, SecretVariable> = {
  clryz7ir7002al4162bsj0azg: {
    key: "test-key",
    value: "test-value",
    varIndex: 1,
  },
}
