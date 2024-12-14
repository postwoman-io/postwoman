import { markRaw } from "vue"
import { Service } from "dioc"
import * as E from "fp-ts/Either"
import {
  RelayRequest,
  RelayResponse,
  FormDataValue,
  MediaType,
  Method,
  Version,
  ContentType,
} from "@hoppscotch/kernel"
import { Relay } from "~/kernel/relay"
import { KernelInterceptor } from "~/services/kernel-interceptor.service"
import { KernelInterceptorProxyStore } from "./store"
import SettingsProxy from "~/components/settings/Proxy.vue"
import { v4 } from "uuid"
import { decodeB64StringToArrayBuffer } from "~/helpers/utils/b64"

type ProxyRequest = {
  url: string
  method: string
  headers: Record<string, string>
  params: Record<string, string>
  data: string
  wantsBinary: boolean
  accessToken: string
  auth?: {
    username: string
    password: string
  }
}

type ProxyResponse = {
  success: boolean
  isBinary: boolean
  status: number
  data: string
  statusText: string
  headers: Record<string, string>
}

export class ProxyKernelInterceptorService
  extends Service
  implements KernelInterceptor {
  public static readonly ID = "KERNEL_PROXY_INTERCEPTOR_SERVICE"
  private readonly store = this.bind(KernelInterceptorProxyStore)

  public readonly id = "proxy"
  public readonly name = () => "Proxy"
  public readonly selectable = { type: "selectable" as const }
  public readonly capabilities = {
    method: new Set([
      'GET',
      'POST',
      'PUT',
      'DELETE',
      'PATCH',
      'HEAD',
      'OPTIONS'
    ]),
    header: new Set(['stringvalue']),
    content: new Set(['text']),
    auth: new Set(['basic']),
    security: new Set([]),
    proxy: new Set([]),
    advanced: new Set([])
  } as const
  public readonly settingsEntry = markRaw({
    title: () => "Proxy",
    component: SettingsProxy,
  })

  private constructProxyRequest(request: RelayRequest, accessToken: string): ProxyRequest {
    let wantsBinary = false
    let requestData = ""
    if (request.content) {
      if (request.content.kind === "text" || request.content.kind === "xml") {
        requestData = request.content.content
      } else if (request.content.kind === "json") {
        requestData = JSON.stringify(request.content.content)
      } else if (request.content.kind === "multipart" || request.content.kind === "form") {
        wantsBinary = true
        const formData = new FormData()
        request.content.content.forEach((values: FormDataValue[], key: string) => {
          values.forEach((value: FormDataValue) => {
            if (value.kind === "text") {
              formData.append(key, value.value)
            } else {
              const blob = new Blob([value.data], { type: value.contentType })
              formData.append(key, blob, value.filename)
            }
          })
        })
        requestData = formData.toString()
      }
    }

    return {
      accessToken,
      wantsBinary,
      url: request.url,
      method: request.method,
      headers: request.headers,
      params: request.params,
      data: requestData,
      auth: request.auth?.kind === "basic" ? {
        username: request.auth.username,
        password: request.auth.password,
      } : undefined,
    }
  }

  public execute(req: RelayRequest) {
    const settings = this.store.getSettings()
    const accessToken = settings.accessToken
    const proxyUrl = settings.proxyUrl

    const proxyRequest = this.constructProxyRequest(req, accessToken)

    const content: ContentType = {
      kind: "json",
      content: proxyRequest,
      mediaType: MediaType.APPLICATION_JSON
    }

    const proxyRelayRequest: RelayRequest = {
      id: Date.now(),
      url: proxyUrl,
      method: "POST" as Method,
      version: "HTTP/1.1" as Version,
      headers: {
        "content-type": content.mediaType,
        ...(content.kind === "multipart" ? {
          "multipart-part-key": `proxyRequestData-${v4()}`,
        } : {}),
      },
      content,
    }

    const result = Relay.execute(proxyRelayRequest)

    return {
      cancel: result.cancel,
      emitter: result.emitter,
      response: result.response.then(async (res: RelayResponse) => {
        if (E.isLeft(res)) return res

        console.log(res)

        const proxyResponse =
          res.right.body.mediaType === MediaType.TEXT_PLAIN
            ? JSON.parse(
              new TextDecoder().decode(new Uint8Array(res.right.body.body))
            ) as ProxyResponse
            : null;


        if (!proxyResponse?.success) {
          return E.left({
            kind: "network",
            message: "Proxy request failed",
          })
        }

        if (proxyResponse.isBinary) {
          const binaryData = decodeB64StringToArrayBuffer(proxyResponse.data)

          return E.right({
            ...res.right,
            content: {
              kind: "binary",
              content: new Uint8Array(binaryData),
              mediaType:
                proxyResponse.headers["content-type"] ||
                "application/octet-stream",
            },
          })
        }

        return E.right({
          ...res.right,
          status: proxyResponse.status,
          statusText: proxyResponse.statusText,
          headers: proxyResponse.headers,
          body: {
            body: proxyResponse.data,
            mediaType: "text/plain",
          }
        })
      }),
    }
  }
}
