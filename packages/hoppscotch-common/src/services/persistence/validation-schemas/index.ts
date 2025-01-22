import {
  Environment,
  GQLHeader,
  HoppGQLAuth,
  HoppGQLRequest,
  HoppRESTAuth,
  HoppRESTRequest,
  HoppRESTHeaders,
  HoppRESTRequestResponse,
  HoppCollection,
} from "@hoppscotch/data"
import { entityReference } from "verzod"
import { z } from "zod"
import { HoppAccentColors, HoppBgColors } from "~/newstore/settings"

const ThemeColorSchema = z.enum([
  "green",
  "teal",
  "blue",
  "indigo",
  "purple",
  "yellow",
  "orange",
  "red",
  "pink",
])

const BgColorSchema = z.enum(["system", "light", "dark", "black"])

const EncodeMode = z.enum(["enable", "disable", "auto"])

const SettingsDefSchema = z.object({
  syncCollections: z.boolean(),
  syncHistory: z.boolean(),
  syncEnvironments: z.boolean(),
  PROXY_URL: z.string(),
  CURRENT_INTERCEPTOR_ID: z.string(),
  URL_EXCLUDES: z.object({
    auth: z.boolean(),
    httpUser: z.boolean(),
    httpPassword: z.boolean(),
    bearerToken: z.boolean(),
    oauth2Token: z.optional(z.boolean()),
  }),
  THEME_COLOR: ThemeColorSchema,
  BG_COLOR: BgColorSchema,
  ENCODE_MODE: EncodeMode.catch("enable"),
  TELEMETRY_ENABLED: z.boolean(),
  EXPAND_NAVIGATION: z.boolean(),
  SIDEBAR: z.boolean(),
  SIDEBAR_ON_LEFT: z.boolean(),
  COLUMN_LAYOUT: z.boolean(),

  WRAP_LINES: z.optional(
    z.object({
      httpRequestBody: z.boolean().catch(true),
      httpResponseBody: z.boolean().catch(true),
      httpHeaders: z.boolean().catch(true),
      httpParams: z.boolean().catch(true),
      httpUrlEncoded: z.boolean().catch(true),
      httpPreRequest: z.boolean().catch(true),
      httpTest: z.boolean().catch(true),
      httpRequestVariables: z.boolean().catch(true),
      graphqlQuery: z.boolean().catch(true),
      graphqlResponseBody: z.boolean().catch(true),
      graphqlHeaders: z.boolean().catch(false),
      graphqlVariables: z.boolean().catch(false),
      graphqlSchema: z.boolean().catch(true),
      importCurl: z.boolean().catch(true),
      codeGen: z.boolean().catch(true),
      cookie: z.boolean().catch(true),
      multipartFormdata: z.boolean().catch(true),
    })
  ),

  HAS_OPENED_SPOTLIGHT: z.optional(z.boolean()),
  ENABLE_AI_EXPERIMENTS: z.optional(z.boolean()),
  AI_REQUEST_NAMING_STYLE: z
    .string()
    .optional()
    .catch("DESCRIPTIVE_WITH_SPACES"),
})

const HoppRESTRequestSchema = entityReference(HoppRESTRequest)

const HoppGQLRequestSchema = entityReference(HoppGQLRequest)

const HoppRESTCollectionSchema = entityReference(HoppCollection)

const HoppGQLCollectionSchema = entityReference(HoppCollection)

export const VUEX_SCHEMA = z.object({
  postwoman: z.optional(
    z.object({
      settings: z.optional(SettingsDefSchema),
      //! Versioned entities
      collections: z.optional(z.array(HoppRESTCollectionSchema)),
      collectionsGraphql: z.optional(z.array(HoppGQLCollectionSchema)),
      environments: z.optional(z.array(entityReference(Environment))),
    })
  ),
})

export const THEME_COLOR_SCHEMA = z.enum(HoppAccentColors)

export const NUXT_COLOR_MODE_SCHEMA = z.enum(HoppBgColors)

export const LOCAL_STATE_SCHEMA = z.union([
  z.object({}).strict(),
  z
    .object({
      REMEMBERED_TEAM_ID: z.optional(z.string()),
    })
    .strict(),
])

export const SETTINGS_SCHEMA = SettingsDefSchema.extend({
  EXTENSIONS_ENABLED: z.optional(z.boolean()),
  PROXY_ENABLED: z.optional(z.boolean()),
})

export const REST_HISTORY_ENTRY_SCHEMA = z
  .object({
    v: z.number(),
    //! Versioned entity
    request: HoppRESTRequestSchema,
    responseMeta: z
      .object({
        duration: z.nullable(z.number()),
        statusCode: z.nullable(z.number()),
      })
      .strict(),
    star: z.boolean(),
    id: z.optional(z.string()),
    updatedOn: z.optional(z.union([z.date(), z.string()])),
  })
  .strict()

export const GQL_HISTORY_ENTRY_SCHEMA = z
  .object({
    v: z.number(),
    //! Versioned entity
    request: HoppGQLRequestSchema,
    response: z.string(),
    star: z.boolean(),
    id: z.optional(z.string()),
    updatedOn: z.optional(z.union([z.date(), z.string()])),
  })
  .strict()

export const REST_COLLECTION_SCHEMA = HoppRESTCollectionSchema

export const GQL_COLLECTION_SCHEMA = HoppGQLCollectionSchema

export const ENVIRONMENTS_SCHEMA = z.array(entityReference(Environment))

export const SELECTED_ENV_INDEX_SCHEMA = z.nullable(
  z.discriminatedUnion("type", [
    z
      .object({
        type: z.literal("NO_ENV_SELECTED"),
      })
      .strict(),
    z
      .object({
        type: z.literal("MY_ENV"),
        index: z.number(),
      })
      .strict(),
    z.object({
      type: z.literal("TEAM_ENV"),
      teamID: z.string(),
      teamEnvID: z.string(),
      environment: entityReference(Environment),
    }),
  ])
)

export const WEBSOCKET_REQUEST_SCHEMA = z.nullable(
  z
    .object({
      endpoint: z.string(),
      protocols: z.array(
        z
          .object({
            value: z.string(),
            active: z.boolean(),
          })
          .strict()
      ),
    })
    .strict()
)

export const SOCKET_IO_REQUEST_SCHEMA = z.nullable(
  z
    .object({
      endpoint: z.string(),
      path: z.string(),
      version: z.union([z.literal("v4"), z.literal("v3"), z.literal("v2")]),
    })
    .strict()
)

export const SSE_REQUEST_SCHEMA = z.nullable(
  z
    .object({
      endpoint: z.string(),
      eventType: z.string(),
    })
    .strict()
)

export const MQTT_REQUEST_SCHEMA = z.nullable(
  z
    .object({
      endpoint: z.string(),
      clientID: z.optional(z.string()),
    })
    .strict()
)

const EnvironmentVariablesSchema = z.union([
  z.object({
    key: z.string(),
    value: z.string(),
    secret: z.literal(false).catch(false),
  }),
  z.object({
    key: z.string(),
    secret: z.literal(true),
  }),
  z.object({
    key: z.string(),
    value: z.string(),
  }),
])

const OperationTypeSchema = z.enum([
  "subscription",
  "query",
  "mutation",
  "teardown",
])

const RunQueryOptionsSchema = z
  .object({
    name: z.optional(z.string()),
    url: z.string(),
    headers: z.array(GQLHeader),
    query: z.string(),
    variables: z.string(),
    auth: HoppGQLAuth,
    operationName: z.optional(z.string()),
    operationType: OperationTypeSchema,
  })
  .strict()

const HoppGQLSaveContextSchema = z.nullable(
  z.discriminatedUnion("originLocation", [
    z
      .object({
        originLocation: z.literal("user-collection"),
        folderPath: z.string(),
        requestIndex: z.number(),
      })
      .strict(),
    z
      .object({
        originLocation: z.literal("team-collection"),
        requestID: z.string(),
        teamID: z.optional(z.string()),
        collectionID: z.optional(z.string()),
      })
      .strict(),
  ])
)

const GQLResponseEventSchema = z.array(
  z
    .object({
      time: z.number(),
      operationName: z.optional(z.string()),
      operationType: OperationTypeSchema,
      data: z.string(),
      rawQuery: z.optional(RunQueryOptionsSchema),
    })
    .strict()
)

const validGqlOperations = [
  "query",
  "headers",
  "variables",
  "authorization",
] as const

const HoppInheritedPropertySchema = z
  .object({
    auth: z.object({
      parentID: z.string(),
      parentName: z.string(),
      inheritedAuth: z.union([HoppRESTAuth, HoppGQLAuth]),
    }),
    headers: z.array(
      z.object({
        parentID: z.string(),
        parentName: z.string(),
        inheritedHeader: z.union([HoppRESTHeaders, GQLHeader]),
      })
    ),
  })
  .strict()

export const GQL_TAB_STATE_SCHEMA = z
  .object({
    lastActiveTabID: z.string(),
    orderedDocs: z.array(
      z.object({
        tabID: z.string(),
        doc: z
          .object({
            // Versioned entity
            request: entityReference(HoppGQLRequest),
            isDirty: z.boolean(),
            saveContext: z.optional(HoppGQLSaveContextSchema),
            response: z.optional(z.nullable(GQLResponseEventSchema)),
            responseTabPreference: z.optional(z.string()),
            optionTabPreference: z.optional(z.enum(validGqlOperations)),
            inheritedProperties: z.optional(HoppInheritedPropertySchema),
          })
          .strict(),
      })
    ),
  })
  .strict()

const HoppTestExpectResultSchema = z
  .object({
    status: z.enum(["fail", "pass", "error"]),
    message: z.string(),
  })
  .strict()

// @ts-expect-error recursive schema
const HoppTestDataSchema = z.lazy(() =>
  z
    .object({
      description: z.string(),
      expectResults: z.array(HoppTestExpectResultSchema),
      tests: z.array(HoppTestDataSchema),
    })
    .strict()
)

export const SECRET_ENVIRONMENT_VARIABLE_SCHEMA = z.union([
  z.object({}).strict(),

  z.record(
    z.string(),
    z.array(
      z
        .object({
          key: z.string(),
          value: z.string(),
          varIndex: z.number(),
        })
        .strict()
    )
  ),
])

const HoppTestResultSchema = z
  .object({
    tests: z.array(HoppTestDataSchema),
    expectResults: z.array(HoppTestExpectResultSchema),
    description: z.string(),
    scriptError: z.boolean(),
    envDiff: z
      .object({
        global: z
          .object({
            additions: z.array(EnvironmentVariablesSchema),
            updations: z.array(
              EnvironmentVariablesSchema.refine(
                (x) => "secret" in x && !x.secret
              ).and(
                z.object({
                  previousValue: z.optional(z.string()),
                })
              )
            ),
            deletions: z.array(EnvironmentVariablesSchema),
          })
          .strict(),
        selected: z
          .object({
            additions: z.array(EnvironmentVariablesSchema),
            updations: z.array(
              EnvironmentVariablesSchema.refine(
                (x) => "secret" in x && !x.secret
              ).and(
                z.object({
                  previousValue: z.optional(z.string()),
                })
              )
            ),
            deletions: z.array(EnvironmentVariablesSchema),
          })
          .strict(),
      })
      .strict(),
  })
  .strict()

const HoppRESTResponseHeaderSchema = z
  .object({
    key: z.string(),
    value: z.string(),
  })
  .strict()

const HoppRESTResponseSchema = z.discriminatedUnion("type", [
  z
    .object({
      type: z.literal("loading"),
      // !Versioned entity
      req: HoppRESTRequestSchema,
    })
    .strict(),
  z
    .object({
      type: z.literal("fail"),
      headers: z.array(HoppRESTResponseHeaderSchema),
      body: z.instanceof(ArrayBuffer),
      statusCode: z.number(),
      meta: z
        .object({
          responseSize: z.number(),
          responseDuration: z.number(),
        })
        .strict(),
      // !Versioned entity
      req: HoppRESTRequestSchema,
    })
    .strict(),
  z
    .object({
      type: z.literal("network_fail"),
      error: z.unknown(),
      // !Versioned entity
      req: HoppRESTRequestSchema,
    })
    .strict(),
  z
    .object({
      type: z.literal("script_fail"),
      error: z.instanceof(Error),
    })
    .strict(),
  z
    .object({
      type: z.literal("success"),
      headers: z.array(HoppRESTResponseHeaderSchema),
      body: z.instanceof(ArrayBuffer),
      statusCode: z.number(),
      meta: z
        .object({
          responseSize: z.number(),
          responseDuration: z.number(),
        })
        .strict(),
      // !Versioned entity
      req: HoppRESTRequestSchema,
    })
    .strict(),
])

const HoppRESTSaveContextSchema = z.nullable(
  z.discriminatedUnion("originLocation", [
    z
      .object({
        originLocation: z.literal("user-collection"),
        folderPath: z.string(),
        requestIndex: z.number(),
        exampleID: z.optional(z.string()),
      })
      .strict(),
    z
      .object({
        originLocation: z.literal("team-collection"),
        requestID: z.string(),
        teamID: z.optional(z.string()),
        collectionID: z.optional(z.string()),
        exampleID: z.optional(z.string()),
      })
      .strict(),
  ])
)

const validRestOperations = [
  "params",
  "bodyParams",
  "headers",
  "authorization",
  "preRequestScript",
  "tests",
  "requestVariables",
] as const

export const REST_TAB_STATE_SCHEMA = z
  .object({
    lastActiveTabID: z.string(),
    orderedDocs: z.array(
      z.object({
        tabID: z.string(),
        doc: z.union([
          z.object({
            type: z.literal("test-runner").catch("test-runner"),
            config: z.object({
              delay: z.number(),
              iterations: z.number(),
              keepVariableValues: z.boolean(),
              persistResponses: z.boolean(),
              stopOnError: z.boolean(),
            }),
            status: z.enum(["idle", "running", "stopped", "error"]),
            collection: HoppRESTCollectionSchema,
            collectionType: z.enum(["my-collections", "team-collections"]),
            collectionID: z.optional(z.string()),
            resultCollection: z.optional(HoppRESTCollectionSchema),
            testRunnerMeta: z.object({
              totalRequests: z.number(),
              completedRequests: z.number(),
              totalTests: z.number(),
              passedTests: z.number(),
              failedTests: z.number(),
              totalTime: z.number(),
            }),
            request: z.nullable(entityReference(HoppRESTRequest)),
            response: z.nullable(HoppRESTResponseSchema),
            testResults: z.optional(z.nullable(HoppTestResultSchema)),
            isDirty: z.boolean(),
            inheritedProperties: z.optional(HoppInheritedPropertySchema),
          }),
          z.object({
            // !Versioned entity
            request: entityReference(HoppRESTRequest),
            type: z.literal("request").catch("request"),
            isDirty: z.boolean(),
            saveContext: z.optional(HoppRESTSaveContextSchema),
            response: z.optional(z.nullable(HoppRESTResponseSchema)),
            testResults: z.optional(z.nullable(HoppTestResultSchema)),
            responseTabPreference: z.optional(z.string()),
            optionTabPreference: z.optional(z.enum(validRestOperations)),
            inheritedProperties: z.optional(HoppInheritedPropertySchema),
            cancelFunction: z.optional(z.function()),
          }),
          z.object({
            type: z.literal("example-response").catch("example-response"),
            response: HoppRESTRequestResponse,
            saveContext: z.optional(HoppRESTSaveContextSchema),
            isDirty: z.boolean(),
          }),
        ]),
      })
    ),
  })
  .strict()
