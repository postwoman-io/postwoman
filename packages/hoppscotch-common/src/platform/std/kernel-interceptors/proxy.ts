import { Interceptor, RequestRunResult } from "~/services/interceptor.service"
import { AxiosRequestConfig, CancelToken } from "axios"
import * as E from "fp-ts/Either"
import { preProcessRequest } from "./helpers"
import { v4 } from "uuid"
import axios from "axios"
import { settingsStore } from "~/newstore/settings"
import { decodeB64StringToArrayBuffer } from "~/helpers/utils/b64"
import SettingsProxy from "~/components/settings/Proxy.vue"

type ProxyHeaders = {
  "multipart-part-key"?: string
}

type ProxyPayloadType =
  | FormData
  | (AxiosRequestConfig & { wantsBinary: true; accessToken: string })

const getProxyPayload = (
  req: AxiosRequestConfig,
  multipartKey: string | null
) => {
  let payload: ProxyPayloadType = {
    ...req,
    wantsBinary: true,
    accessToken: import.meta.env.VITE_PROXYSCOTCH_ACCESS_TOKEN ?? "",
  }

  if (payload.data instanceof FormData) {
    const formData = payload.data
    payload.data = ""
    formData.append(multipartKey!, JSON.stringify(payload))
    payload = formData
  }

  return payload
}

async function runRequest(
  req: AxiosRequestConfig,
  cancelToken: CancelToken
): RequestRunResult["response"] {
  const multipartKey =
    req.data instanceof FormData ? `proxyRequestData-${v4()}` : null

  const headers =
    req.data instanceof FormData
      ? <ProxyHeaders>{
          "multipart-part-key": multipartKey,
        }
      : <ProxyHeaders>{}

  const payload = getProxyPayload(req, multipartKey)

  try {
    // TODO: Validation for the proxy result
    const { data } = await axios.post(
      settingsStore.value.PROXY_URL ?? "https://proxy.hoppscotch.io",
      payload,
      {
        headers,
        cancelToken,
      }
    )

    if (!data.success) {
      return E.left({
        humanMessage: {
          heading: (t) => t("error.network_fail"),
          description: (t) => data.data?.message ?? t("error.proxy_error"),
        },
      })
    }

    if (data.isBinary) {
      data.data = decodeB64StringToArrayBuffer(data.data)
    }

    return E.right(data)
  } catch (e) {
    if (axios.isCancel(e)) {
      return E.left("cancellation")
    }
    return E.left({
      humanMessage: {
        heading: (t) => t("error.network_fail"),
        description: (t) => t("helpers.network_fail"),
      },
      error: e,
    })
  }
}

export const proxyInterceptor: Interceptor = {
  interceptorID: "proxy",
  name: (t) => t("settings.proxy"),
  selectable: { type: "selectable" },
  settingsPageEntry: {
    entryTitle: (t) => t("settings.proxy"),
    component: SettingsProxy,
  },
  runRequest(req) {
    const cancelToken = axios.CancelToken.source()

    const processedReq = preProcessRequest(req)

    const promise = runRequest(processedReq, cancelToken.token)

    return {
      cancel: () => cancelToken.cancel(),
      response: promise,
    }
  },
}
