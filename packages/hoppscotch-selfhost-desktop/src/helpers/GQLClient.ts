import { ref } from "vue"
import { makeResult, makeErrorResult, Exchange, Operation } from "@urql/core"
import { makeFetchBody, makeFetchOptions } from "@urql/core/internal"
import { filter, make, merge, mergeMap, pipe, takeUntil, map } from "wonka"
import { gqlClientError$ } from "@hoppscotch/common/helpers/backend/GQLClient"
import { Store } from "tauri-plugin-store-api"
import { Body, getClient } from "@tauri-apps/api/http"
import { parse, serialize } from "cookie"
import { SubscriptionClient } from "subscriptions-transport-ws"
import { platform } from "@hoppscotch/common/platform"
import WSWrapper from "./wsWrapper"

const APP_DATA_PATH = "~/.hopp-desktop-app-data.dat"

export async function addCookieToFetchHeaders(
  store: Store,
  headers: HeadersInit = {}
) {
  try {
    const accessToken = await store.get<{ value: string }>("access_token")
    const refreshToken = await store.get<{ value: string }>("refresh_token")

    if (accessToken?.value && refreshToken?.value) {
      // Assert headers as an indexable type
      const headersIndexable = headers as { [key: string]: string }
      const existingCookies = parse(headersIndexable["Cookie"] || "")

      if (!existingCookies.access_token) {
        existingCookies.access_token = accessToken.value
      }
      if (!existingCookies.refresh_token) {
        existingCookies.refresh_token = refreshToken.value
      }

      // Serialize the cookies back into the headers
      const serializedCookies = Object.entries(existingCookies)
        .map(([name, value]) => serialize(name, value))
        .join("; ")
      headersIndexable["Cookie"] = serializedCookies
    }

    return headers
  } catch (error) {
    console.error("error while injecting cookie")
  }
}

function createHttpSource(operation: Operation, store: Store) {
  return make(({ next, complete }) => {
    getClient().then(async (httpClient) => {
      const fetchOptions = makeFetchOptions(operation)
      let headers = fetchOptions.headers
      headers = await addCookieToFetchHeaders(store, headers)

      const fetchBody = makeFetchBody(operation)
      httpClient
        .post(operation.context.url, Body.json(fetchBody), {
          headers,
        })
        .then((result) => {
          next(result.data)
          complete()
        })
        .catch((error) => {
          next(makeErrorResult(operation, error))
          complete()
        })
    })
    return () => {}
  })
}

export const tauriGQLFetchExchange =
  (store: Store): Exchange =>
  ({ forward }) =>
  (ops$) => {
    const subscriptionResults$ = pipe(
      ops$,
      filter((op) => op.kind === "query" || op.kind === "mutation"),
      mergeMap((operation) => {
        const { key, context } = operation

        const teardown$ = pipe(
          ops$,
          filter((op: Operation) => op.kind === "teardown" && op.key === key)
        )

        const source = createHttpSource(operation, store)

        return pipe(
          source,
          takeUntil(teardown$),
          map((result) => makeResult(operation, result as any))
        )
      })
    )

    const forward$ = pipe(
      ops$,
      filter(
        (op: Operation) => op.kind === "teardown" || op.kind != "subscription"
      ),
      forward
    )

    return merge([subscriptionResults$, forward$])
  }

const createSubscriptionClient = () => {
  return new SubscriptionClient(
    import.meta.env.VITE_BACKEND_WS_URL,
    {
      reconnect: true,
      connectionParams: () => platform.auth.getBackendHeaders(),
      connectionCallback(error) {
        if (error?.length > 0) {
          gqlClientError$.next({
            type: "SUBSCRIPTION_CONN_CALLBACK_ERR_REPORT",
            errors: error,
          })
        }
      },
      wsOptionArguments: [
        {
          store: new Store(APP_DATA_PATH),
        },
      ],
    },
    WSWrapper
  )
}

let subscriptionClient: SubscriptionClient | null

const isBackendGQLEventAdded = ref(false)

const resetSubscriptionClient = () => {
  if (subscriptionClient) {
    subscriptionClient.close()
  }
  subscriptionClient = createSubscriptionClient()
  if (!isBackendGQLEventAdded.value) {
    subscriptionClient.onConnected(() => {
      platform.auth.onBackendGQLClientShouldReconnect(() => {
        const currentUser = platform.auth.getCurrentUser()

        if (currentUser && subscriptionClient) {
          subscriptionClient?.client?.close()
        }

        if (currentUser && !subscriptionClient) {
          resetSubscriptionClient()
        }

        if (!currentUser && subscriptionClient) {
          subscriptionClient.close()
          resetSubscriptionClient()
        }
      })
    })
    isBackendGQLEventAdded.value = true
  }
}

export const getSubscriptionClient = () => {
  if (!subscriptionClient) resetSubscriptionClient()
  return subscriptionClient
}
