import { markRaw } from "vue"
import { Service } from "dioc"
import * as E from "fp-ts/Either"
import { Request, Response, FormDataValue } from "@hoppscotch/kernel"
import { Relay } from "~/kernel/relay"
import { KernelInterceptor } from "~/services/kernel-interceptor.service"
import { KernelInterceptorProxyStore } from "./store"
import SettingsProxy from "~/components/settings/Proxy.vue"
import { decodeB64StringToArrayBuffer } from "~/helpers/utils/b64"
import { v4 } from "uuid"

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
  implements KernelInterceptor
{
  public static readonly ID = "KERNEL_PROXY_INTERCEPTOR_SERVICE"
  private readonly store = this.bind(KernelInterceptorProxyStore)

  public readonly id = "proxy"
  public readonly name = () => "Proxy"
  public readonly selectable = { type: "selectable" as const }
  public readonly capabilities = Relay.capabilities()
  public readonly settingsEntry = markRaw({
    title: () => "Proxy",
    component: SettingsProxy,
  })

  public execute(req: Request) {
    const settings = this.store.getSettings()
    const proxyRequest: Request = {
      id: req.id,
      url: settings.proxyUrl,
      method: "POST",
      version: "HTTP/1.1",
      headers: {
        origin: ["https://hoppscotch.io"],
        "content-type": ["application/json"],
      },
      content: {
        kind: "json",
        content: {
          url: "https://echo.hoppscotch.io",
          method: "GET",
          headers: {},
          params: {},
          data: "",
          wantsBinary: true,
          accessToken: settings.accessToken,
        } satisfies ProxyRequest,
        mediaType: "application/json",
      },
    }

    const result = Relay.execute(proxyRequest)

    return {
      cancel: result.cancel,
      emitter: result.emitter,
      response: result.response.then(async (res: Response) => {
        if (E.isLeft(res)) return res

        console.error("res", res.right)

        const proxyResponse =
          res.right.content.kind === "text"
            ? (JSON.parse(res.right.content.content) as ProxyResponse)
            : null

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
          headers: Object.entries(proxyResponse.headers).reduce(
            (acc, [key, value]) => ({
              ...acc,
              [key.toLowerCase()]: [value],
            }),
            {}
          ),
          content: {
            kind: "text",
            content: proxyResponse.data,
            mediaType: "text/plain",
          },
        })
      }),
    }
  }
}
