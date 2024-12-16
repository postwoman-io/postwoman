import { Component, computed, reactive, ref } from "vue"
import { pipe } from "fp-ts/function"
import * as O from "fp-ts/Option"
import { getService } from "~/modules/dioc"
import { getI18n } from "~/modules/i18n"
import { useToast } from "~/composables/toast"
import { OperationType } from "@urql/core"
import {
  GraphQLSchema,
  buildClientSchema,
  getIntrospectionQuery,
  printSchema,
  GraphQLObjectType,
  GraphQLEnumType,
  GraphQLInputObjectType,
  GraphQLInterfaceType,
} from "graphql"
import { GQLTabService } from "~/services/tab/graphql"
import { KernelInterceptorService } from "~/services/kernel-interceptor.service"
import {
  transformHoppGQLRequestToRequest,
  transformResponseToGQLResponseEvent,
} from "~/helpers/kernel"
import { makeGQLHistoryEntry, addGraphqlHistoryEntry } from "~/newstore/history"
import { GQLHeader, makeGQLRequest, HoppGQLAuth } from "@hoppscotch/data"
import * as E from "fp-ts/Either"
import { MediaType, RelayError } from "@hoppscotch/kernel"

const GQL_SCHEMA_POLL_INTERVAL = 7000

const GQL = {
  CONNECTION_INIT: "connection_init",
  CONNECTION_ACK: "connection_ack",
  CONNECTION_ERROR: "connection_error",
  CONNECTION_KEEP_ALIVE: "ka",
  START: "start",
  STOP: "stop",
  CONNECTION_TERMINATE: "connection_terminate",
  DATA: "data",
  ERROR: "error",
  COMPLETE: "complete",
}

export type GQLResponseEvent =
  | {
      type: "response"
      time: number
      operationName: string | undefined
      operationType: OperationType
      data: string
      rawQuery?: RunQueryOptions
    }
  | {
      type: "error"
      error: {
        type: string
        message: string
        component?: Component
      }
    }

export type ConnectionState =
  | "CONNECTING"
  | "CONNECTED"
  | "DISCONNECTED"
  | "ERROR"
export type SubscriptionState = "SUBSCRIBING" | "SUBSCRIBED" | "UNSUBSCRIBED"

type Connection = {
  state: ConnectionState
  subscriptionState: Map<string, SubscriptionState>
  socket: WebSocket | undefined
  schema: GraphQLSchema | null
  error?: {
    type: string
    message: (t: ReturnType<typeof getI18n>) => string
    component?: Component
  } | null
}

export type RunQueryOptions = {
  name?: string
  url: string
  headers: GQLHeader[]
  query: string
  variables: string
  auth: HoppGQLAuth
  operationName: string | undefined
  operationType: OperationType
}

const tabs = getService(GQLTabService)
const currentTabID = computed(() => tabs.currentTabID.value)

export const connection = reactive<Connection>({
  state: "DISCONNECTED",
  subscriptionState: new Map(),
  socket: undefined,
  schema: null,
  error: null,
})

export const schema = computed(() => connection.schema)
export const subscriptionState = computed(() =>
  connection.subscriptionState.get(currentTabID.value)
)

export const gqlMessageEvent = ref<GQLResponseEvent | "reset">()

export const schemaString = computed(() => {
  if (!connection.schema || !(connection.schema instanceof GraphQLSchema))
    return ""
  return printSchema(connection.schema)
})

export const queryFields = computed(() => {
  if (!connection.schema || !(connection.schema instanceof GraphQLSchema))
    return []
  const fields = connection.schema.getQueryType()?.getFields()
  return fields ? Object.values(fields) : []
})

export const mutationFields = computed(() => {
  if (!connection.schema || !(connection.schema instanceof GraphQLSchema))
    return []
  const fields = connection.schema.getMutationType()?.getFields()
  return fields ? Object.values(fields) : []
})

export const subscriptionFields = computed(() => {
  if (!connection.schema || !(connection.schema instanceof GraphQLSchema))
    return []
  const fields = connection.schema.getSubscriptionType()?.getFields()
  return fields ? Object.values(fields) : []
})

export const graphqlTypes = computed(() => {
  if (!connection.schema || !(connection.schema instanceof GraphQLSchema))
    return []

  const typeMap = connection.schema.getTypeMap()
  const queryTypeName = connection.schema.getQueryType()?.name ?? ""
  const mutationTypeName = connection.schema.getMutationType()?.name ?? ""
  const subscriptionTypeName =
    connection.schema.getSubscriptionType()?.name ?? ""

  return Object.values(typeMap).filter((type) => {
    return (
      !type.name.startsWith("__") &&
      ![queryTypeName, mutationTypeName, subscriptionTypeName].includes(
        type.name
      ) &&
      (type instanceof GraphQLObjectType ||
        type instanceof GraphQLInputObjectType ||
        type instanceof GraphQLEnumType ||
        type instanceof GraphQLInterfaceType)
    )
  })
})

let timeoutSubscription: any

export const connect = async (
  url: string,
  headers: GQLHeader[],
  isRunGQLOperation = false
) => {
  if (connection.state === "CONNECTED") {
    throw new Error(
      "A connection is already running. Close it before starting another."
    )
  }

  const kernelService = getService(KernelInterceptorService)
  const toast = useToast()
  const t = getI18n()

  connection.state = "CONNECTING"

  const poll = async () => {
    try {
      const kernelRequest = await transformHoppGQLRequestToRequest({
        v: 7,
        name: "Introspection Query",
        url,
        headers,
        query: getIntrospectionQuery(),
        variables: "",
        auth: { authType: "none", authActive: false },
      })

      const result = await kernelService.execute(kernelRequest).response

      if (E.isLeft(result)) throw new Error(result.left.toString())

      const response = result.right
      console.log("response", response)
      // NOTE: This pattern is repated often across codebase,
      // maybe consider making this into a kernel part or library,
      // similar to `relay.content` const object.
      const perhapsJson = pipe(
        response.body?.mediaType?.includes(MediaType.APPLICATION_JSON)
          ? O.of(new Uint8Array(response.body.body).buffer)
          : O.none,
        O.chain((body) =>
          O.tryCatch(() => {
            const jsonString = new TextDecoder("utf-8")
              .decode(body)
              .replaceAll("\x00", "")
            return JSON.parse(jsonString)
          })
        )
      )

      console.log("perhapsJson", perhapsJson)

      if (O.isNone(perhapsJson))
        throw new Error("Invalid introspection response")

      const json = perhapsJson.value

      console.log("json", json)
      const clientSchema = buildClientSchema(json.data)
      console.log("clientSchema", clientSchema)

      connection.schema = clientSchema as unknown as GraphQLSchema
      connection.error = null

      if (connection.state !== "CONNECTED") connection.state = "CONNECTED"

      timeoutSubscription = setTimeout(poll, GQL_SCHEMA_POLL_INTERVAL)
    } catch (error) {
      connection.state = "ERROR"
      if (!isRunGQLOperation) toast.error(t("graphql.connection_error_http"))
      console.error(error)
    }
  }

  await poll()
}

export const disconnect = () => {
  if (connection.state !== "CONNECTED") {
    throw new Error("No connections are running to be disconnected")
  }

  clearTimeout(timeoutSubscription)
  connection.state = "DISCONNECTED"
  connection.schema = null
}

export const reset = () => {
  if (connection.state === "CONNECTED") disconnect()

  connection.state = "DISCONNECTED"
  connection.schema = null
}

export const runGQLOperation = async (options: RunQueryOptions) => {
  if (connection.state !== "CONNECTED") {
    await connect(options.url, options.headers, true)
  }

  const { url, headers, query, variables, auth, operationType } = options

  if (operationType === "subscription") {
    return runSubscription(options)
  }

  const kernelService = getService(KernelInterceptorService)
  const request = makeGQLRequest({
    name: options.name ?? "Untitled Request",
    url,
    query,
    headers,
    variables,
    auth,
  })

  const result = await kernelService.execute(
    await transformHoppGQLRequestToRequest(request)
  ).response

  if (E.isLeft(result)) {
    const error = result.left as RelayError
    throw error
  }

  const response = await transformResponseToGQLResponseEvent(
    result.right,
    options
  )

  if (response.type === "response") {
    gqlMessageEvent.value = response
    addQueryToHistory(options, response.data)
  }

  return response
}

export const runSubscription = (options: RunQueryOptions) => {
  const { url, query, headers, operationName } = options
  const wsUrl = url.replace(/^http/, "ws")

  connection.subscriptionState.set(currentTabID.value, "SUBSCRIBING")
  connection.socket = new WebSocket(wsUrl, "graphql-ws")

  connection.socket.onopen = () => {
    connection.socket?.send(
      JSON.stringify({
        type: GQL.CONNECTION_INIT,
        payload: headers?.reduce(
          (acc, { key, value }) => ({ ...acc, [key]: value }),
          {}
        ),
      })
    )

    connection.socket?.send(
      JSON.stringify({
        type: GQL.START,
        id: "1",
        payload: { query, operationName },
      })
    )
  }

  gqlMessageEvent.value = "reset"

  connection.socket.onmessage = (event) => {
    const data = JSON.parse(event.data)

    switch (data.type) {
      case GQL.CONNECTION_ACK:
        connection.subscriptionState.set(currentTabID.value, "SUBSCRIBED")
        break
      case GQL.DATA:
        gqlMessageEvent.value = {
          type: "response",
          time: Date.now(),
          operationName,
          data: JSON.stringify(data.payload),
          operationType: "subscription",
        }
        break
    }
  }

  connection.socket.onclose = () => {
    connection.subscriptionState.set(currentTabID.value, "UNSUBSCRIBED")
  }

  addQueryToHistory(options, "")

  return connection.socket
}

export const socketDisconnect = () => {
  connection.socket?.close()
}

const addQueryToHistory = (options: RunQueryOptions, response: string) => {
  const { name, url, headers, query, variables, auth } = options
  addGraphqlHistoryEntry(
    makeGQLHistoryEntry({
      request: makeGQLRequest({
        name: name ?? "Untitled Request",
        url,
        query,
        headers,
        variables,
        auth,
      }),
      response,
      star: false,
    })
  )
}
