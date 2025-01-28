import { Service } from "dioc"
import { markRaw } from "vue"
import { body } from "@hoppscotch/kernel"
import * as E from "fp-ts/Either"
import { pipe } from "fp-ts/function"
import axios, { CancelTokenSource } from "axios"
import { preProcessRelayRequest } from "~/helpers/functional/preprocess"
import {
  RelayRequest,
  RelayResponse,
  RelayCapabilities,
} from "@hoppscotch/kernel"
import type { getI18n } from "~/modules/i18n"
import {
  KernelInterceptor,
  KernelInterceptorError,
  ExecutionResult,
} from "~/services/kernel-interceptor.service"
import { KernelInterceptorAgentStore } from "./store"
import SettingsAgent from "~/components/settings/Agent.vue"
import SettingsAgentSubtitle from "~/components/settings/AgentSubtitle.vue"
import InterceptorsErrorPlaceholder from "~/components/interceptors/ErrorPlaceholder.vue"
import { CookieJarService } from "~/services/cookie-jar.service"

export class AgentKernelInterceptorService
  extends Service
  implements KernelInterceptor
{
  public static readonly ID = "AGENT_KERNEL_INTERCEPTOR_SERVICE"

  private store = this.bind(KernelInterceptorAgentStore)
  private readonly cookieJar = this.bind(CookieJarService)

  public readonly id = "agent"
  public readonly name = (t: ReturnType<typeof getI18n>) =>
    t("interceptor.agent.name")
  public readonly settingsEntry = markRaw({
    title: (t: ReturnType<typeof getI18n>) =>
      t("interceptor.agent.settings_title"),
    component: SettingsAgent,
  })
  public readonly subtitle = markRaw(SettingsAgentSubtitle)
  public selectable = { type: "selectable" as const }
  public readonly capabilities: RelayCapabilities = {
    method: new Set([
      "GET",
      "POST",
      "PUT",
      "DELETE",
      "PATCH",
      "HEAD",
      "OPTIONS",
    ]),
    header: new Set(["stringvalue", "arrayvalue", "multivalue"]),
    content: new Set([
      "text",
      "json",
      "xml",
      "form",
      "binary",
      "multipart",
      "urlencoded",
      "compression",
    ]),
    auth: new Set(["basic", "bearer", "apikey", "digest"]),
    security: new Set([
      "clientcertificates",
      "cacertificates",
      "certificatevalidation",
      "hostverification",
      "peerverification",
    ]),
    proxy: new Set(["http", "https", "authentication", "certificates"]),
    advanced: new Set(["redirects", "cookies", "localaccess"]),
  } as const

  public execute(request: RelayRequest): ExecutionResult {
    const reqID = Date.now()
    const cancelToken = axios.CancelToken.source()

    return {
      cancel: async () => {
        cancelToken.cancel()
        await this.store.cancelRequest(reqID)
      },
      response: pipe(
        this.executeRequest(request, reqID, cancelToken),
        (promise) =>
          promise.then((either) =>
            pipe(
              either,
              E.mapLeft((error): KernelInterceptorError => {
                if (error === "cancellation") return "cancellation"

                return {
                  humanMessage: {
                    heading: (t) => t("error.network_fail"),
                    description: (t) => t("helpers.network_fail"),
                  },
                  error,
                  component: InterceptorsErrorPlaceholder,
                }
              })
            )
          )
      ),
    }
  }

  private async executeRequest(
    request: RelayRequest,
    reqID: number,
    cancelToken: CancelTokenSource
  ): Promise<E.Either<"cancellation" | Error, RelayResponse>> {
    try {
      await this.store.checkAgentStatus()

      if (!this.store.isAgentRunning.value || !this.store.isAuthKeyPresent()) {
        throw new Error("Agent not running")
      }

      const effectiveRequest = this.store.completeRequest(
        preProcessRelayRequest(request)
      )
      const relevantCookies = this.cookieJar.getCookiesForURL(
        new URL(effectiveRequest.url!)
      )

      if (relevantCookies.length > 0) {
        effectiveRequest.headers!["Cookie"] = relevantCookies
          .map((cookie) => `${cookie.name!}=${cookie.value!}`)
          .join(";")
      }

      console.log("[AGENT]: effectiveRequest", effectiveRequest)
      const [nonceB16, encryptedReq] = await this.store.encryptRequest(
        effectiveRequest,
        reqID
      )

      const response = await axios.post(
        "http://localhost:9119/execute",
        encryptedReq,
        {
          headers: {
            Authorization: `Bearer ${this.store.authKey.value}`,
            "X-Hopp-Nonce": nonceB16,
            "Content-Type": "application/octet-stream",
          },
          cancelToken: cancelToken.token,
          responseType: "arraybuffer",
        }
      )

      const responseNonceB16 = response.headers["x-hopp-nonce"]
      const decryptedResponse = await this.store.decryptResponse(
        responseNonceB16,
        response.data
      )

      const transformedBody = body.body(
        decryptedResponse.body.body,
        decryptedResponse.body.mediaType
      )
      const transformedResponse = {
        ...decryptedResponse,
        body: { ...transformedBody },
      }

      return E.right(transformedResponse)
    } catch (e) {
      if (axios.isCancel(e)) {
        return E.left("cancellation")
      }

      return E.left(e instanceof Error ? e : new Error("Unknown error"))
    }
  }
}
