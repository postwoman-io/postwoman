import { GQLHeader, HoppGQLAuth, makeGQLRequest } from "@hoppscotch/data"
import { OperationType } from "@urql/core"
import { AwsV4Signer } from "aws4fetch"
import * as E from "fp-ts/Either"
import {
  GraphQLEnumType,
  GraphQLInputObjectType,
  GraphQLInterfaceType,
  GraphQLObjectType,
  GraphQLSchema,
  buildClientSchema,
  getIntrospectionQuery,
  printSchema,
} from "graphql"
import { Component, computed, reactive, ref } from "vue"
import { useToast } from "~/composables/toast"
import { getService } from "~/modules/dioc"
import { getI18n } from "~/modules/i18n"

import { addGraphqlHistoryEntry, makeGQLHistoryEntry } from "~/newstore/history"

import { InterceptorService } from "~/services/interceptor.service"
import { GQLTabService } from "~/services/tab/graphql"

const GQL_SCHEMA_POLL_INTERVAL = 7000

type RunQueryOptions = {
  name?: string
  url: string
  headers: GQLHeader[]
  query: string
  variables: string
  auth: HoppGQLAuth
  operationName: string | undefined
  operationType: OperationType
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

const tabs = getService(GQLTabService)
const currentTabID = computed(() => tabs.currentTabID.value)

export const connection = reactive<Connection>({
  state: "DISCONNECTED",
  subscriptionState: new Map<string, SubscriptionState>(),
  socket: undefined,
  schema: null,
  error: null,
})

export const schema = computed(() => connection.schema)
export const subscriptionState = computed(() => {
  return connection.subscriptionState.get(currentTabID.value)
})

export const gqlMessageEvent = ref<GQLResponseEvent | "reset">()

export const schemaString = computed(() => {
  if (!connection.schema) return ""
  return printSchema(connection.schema)
})

export const queryFields = computed(() => {
  if (!connection.schema) return []

  const fields = connection.schema.getQueryType()?.getFields()
  if (!fields) return []

  return Object.values(fields)
})

export const mutationFields = computed(() => {
  if (!connection.schema) return []

  const fields = connection.schema.getMutationType()?.getFields()
  if (!fields) return []

  return Object.values(fields)
})

export const subscriptionFields = computed(() => {
  if (!connection.schema) return []

  const fields = connection.schema.getSubscriptionType()?.getFields()
  if (!fields) return []

  return Object.values(fields)
})

export const graphqlTypes = computed(() => {
  if (!connection.schema) return []

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

  const toast = useToast()
  const t = getI18n()

  connection.state = "CONNECTING"

  const poll = async () => {
    try {
      await getSchema(url, headers)
      // polling for schema
      if (connection.state !== "CONNECTED") connection.state = "CONNECTED"
      timeoutSubscription = setTimeout(() => {
        poll()
      }, GQL_SCHEMA_POLL_INTERVAL)
    } catch (error) {
      connection.state = "ERROR"

      // Show an error toast if the introspection attempt failed and not while sending a request
      if (!isRunGQLOperation) {
        toast.error(t("graphql.connection_error_http"))
      }

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
}

export const reset = () => {
  if (connection.state === "CONNECTED") disconnect()

  connection.state = "DISCONNECTED"
  connection.schema = null
}

const getSchema = async (url: string, headers: GQLHeader[]) => {
  try {
    const introspectionQuery = JSON.stringify({
      query: getIntrospectionQuery(),
    })

    const finalHeaders: Record<string, string> = {}
    headers
      .filter((x) => x.active && x.key !== "")
      .forEach((x) => (finalHeaders[x.key] = x.value))

    const reqOptions = {
      method: "POST",
      url,
      headers: {
        ...finalHeaders,
        "content-type": "application/json",
      },
      data: introspectionQuery,
    }

    const interceptorService = getService(InterceptorService)

    const res = await interceptorService.runRequest(reqOptions).response

    if (E.isLeft(res)) {
      connection.state = "ERROR"

      if (
        res.left !== "cancellation" &&
        res.left.error === "NO_PW_EXT_HOOK" &&
        res.left.humanMessage
      ) {
        connection.error = {
          type: res.left.error,
          message: (t: ReturnType<typeof getI18n>) =>
            res.left.humanMessage.description(t),
          component: res.left.component,
        }
      }

      throw new Error(res.left.toString())
    }

    if (res.right.status !== 200) {
      connection.state = "ERROR"
      connection.error = {
        type: "HTTP_ERROR",
        message: (t: ReturnType<typeof getI18n>) =>
          t("graphql.connection_error_http"),
        component: undefined,
      }
      throw new Error("Failed to fetch schema. Status: " + res.right.status)
    }

    const data = res.right

    // HACK : Temporary trailing null character issue from the extension fix
    const response = new TextDecoder("utf-8")
      .decode(data.data as any)
      .replace(/\0+$/, "")

    const introspectResponse = JSON.parse(response)

    const schema = buildClientSchema(introspectResponse.data)

    connection.schema = schema
    connection.error = null
  } catch (e: any) {
    console.error(e)
    disconnect()
  }
}

export const runGQLOperation = async (options: RunQueryOptions) => {
  if (connection.state !== "CONNECTED") {
    await connect(options.url, options.headers, true)
  }

  const { url, headers, query, variables, auth, operationName, operationType } =
    options

  const finalHeaders: Record<string, string> = {}

  const parsedVariables = JSON.parse(variables || "{}")

  const params: Record<string, string> = {}

  if (auth.authActive) {
    if (auth.authType === "basic") {
      const username = auth.username
      const password = auth.password
      finalHeaders.Authorization = `Basic ${btoa(`${username}:${password}`)}`
    } else if (auth.authType === "bearer") {
      finalHeaders.Authorization = `Bearer ${auth.token}`
    } else if (auth.authType === "oauth-2") {
      const { addTo } = auth

      if (addTo === "HEADERS") {
        finalHeaders.Authorization = `Bearer ${auth.grantTypeInfo.token}`
      } else if (addTo === "QUERY_PARAMS") {
        params["access_token"] = auth.grantTypeInfo.token
      }
    } else if (auth.authType === "api-key") {
      const { key, value, addTo } = auth
      if (addTo === "HEADERS") {
        finalHeaders[key] = value
      } else if (addTo === "QUERY_PARAMS") {
        params[key] = value
      }
    } else if (auth.authType === "aws-signature") {
      const { accessKey, secretKey, region, serviceName, addTo, serviceToken } =
        auth

      const currentDate = new Date()
      const amzDate = currentDate.toISOString().replace(/[:-]|\.\d{3}/g, "")

      const signer = new AwsV4Signer({
        datetime: amzDate,
        signQuery: addTo === "QUERY_PARAMS",
        accessKeyId: accessKey,
        secretAccessKey: secretKey,
        region: region ?? "us-east-1",
        service: serviceName,
        url,
        sessionToken: serviceToken,
      })

      const sign = await signer.sign()

      if (addTo === "HEADERS") {
        sign.headers.forEach((v, k) => {
          finalHeaders[k] = v
        })
      } else if (addTo === "QUERY_PARAMS") {
        for (const [k, v] of sign.url.searchParams) {
          params[k] = v
        }
      }
    }
  }

  headers
    .filter((item) => item.active && item.key !== "")
    .forEach(({ key, value }) => (finalHeaders[key] = value))

  const reqOptions = {
    method: "POST",
    url,
    headers: {
      ...finalHeaders,
      "content-type": "application/json",
    },
    data: JSON.stringify({
      query,
      variables: parsedVariables,
      operationName,
    }),
    params: {
      ...params,
    },
  }

  if (operationType === "subscription") {
    return runSubscription(options, finalHeaders)
  }

  const interceptorService = getService(InterceptorService)
  const result = await interceptorService.runRequest(reqOptions).response

  if (E.isLeft(result)) {
    if (
      result.left !== "cancellation" &&
      result.left.error === "NO_PW_EXT_HOOK" &&
      result.left.humanMessage
    ) {
      connection.error = {
        type: result.left.error,
        message: (t: ReturnType<typeof getI18n>) =>
          result.left.humanMessage.description(t),
        component: result.left.component,
      }
    }
    throw new Error(result.left.toString())
  }

  const res = result.right

  // HACK: Temporary trailing null character issue from the extension fix
  const responseText = new TextDecoder("utf-8")
    .decode(res.data as any)
    .replace(/\0+$/, "")

  gqlMessageEvent.value = {
    type: "response",
    time: Date.now(),
    operationName: operationName ?? "query",
    data: responseText,
    rawQuery: options,
    operationType,
  }

  addQueryToHistory(options, responseText)

  return responseText
}

export const runSubscription = (
  options: RunQueryOptions,
  headers?: Record<string, string>
) => {
  const { url, query, operationName } = options
  const wsUrl = url.replace(/^http/, "ws")

  connection.subscriptionState.set(currentTabID.value, "SUBSCRIBING")

  connection.socket = new WebSocket(wsUrl, "graphql-ws")

  connection.socket.onopen = (event) => {
    console.log("WebSocket is open now.", event)

    connection.socket?.send(
      JSON.stringify({
        type: GQL.CONNECTION_INIT,
        payload: headers ?? {},
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
      case GQL.CONNECTION_ACK: {
        connection.subscriptionState.set(currentTabID.value, "SUBSCRIBED")
        break
      }
      case GQL.CONNECTION_ERROR: {
        console.error(data.payload)
        break
      }
      case GQL.CONNECTION_KEEP_ALIVE: {
        break
      }
      case GQL.DATA: {
        gqlMessageEvent.value = {
          type: "response",
          time: Date.now(),
          operationName,
          data: JSON.stringify(data.payload),
          operationType: "subscription",
        }
        break
      }
      case GQL.COMPLETE: {
        console.log("completed", data.id)
        break
      }
    }
  }

  connection.socket.onclose = (event) => {
    console.log("WebSocket is closed now.", event)
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
