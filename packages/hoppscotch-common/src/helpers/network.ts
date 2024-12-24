import { BehaviorSubject, Observable } from "rxjs"
import { HoppRESTRequest } from "@hoppscotch/data"
import * as E from "fp-ts/Either"
import { getService } from "~/modules/dioc"
import { HoppRESTResponse } from "./types/HoppRESTResponse"
import { EffectiveHoppRESTRequest } from "./utils/EffectiveURL"
import { KernelInterceptorService } from "~/services/kernel-interceptor.service"
import { Request, Response } from "@hoppscotch/kernel"
import { HoppRESTHeaders, HoppRESTParams } from "@hoppscotch/data"

type MixedRequest = EffectiveHoppRESTRequest & HoppRESTRequest

interface RESTRequest extends Omit<Request, "content"> {
  content?: {
    kind: "text" | "form" | "binary"
    content: string | FormData | Uint8Array
    mediaType?: string
  }
}

export class RESTRequestExecutor {
  private readonly kernelInterceptor: KernelInterceptorService
  private readonly logger: Console

  constructor() {
    this.kernelInterceptor = getService(KernelInterceptorService)
    this.logger = console
  }

  private normalizeParams(params: HoppRESTParams): Record<string, string> {
    this.logger.debug("[RESTRequestExecutor] Normalizing params:", params)

    const normalizedParams = params
      .filter(
        (param: { key: string; value: string; active: boolean }) => param.active
      )
      .reduce<Record<string, string>>(
        (
          acc: Record<string, string>,
          { key, value }: { key: string; value: string }
        ) => ({
          ...acc,
          [key]: value,
        }),
        {}
      )

    this.logger.debug(
      "[RESTRequestExecutor] Normalized params result:",
      normalizedParams
    )
    return normalizedParams
  }

  private normalizeHeaders(headers: HoppRESTHeaders): Record<string, string[]> {
    this.logger.debug("[RESTRequestExecutor] Normalizing headers:", headers)

    const normalizedHeaders = headers
      .filter(
        (header: { key: string; value: string; active: boolean }) =>
          header.active
      )
      .reduce<Record<string, string[]>>(
        (
          acc: Record<string, string[]>,
          { key, value }: { key: string; value: string }
        ) => ({
          ...acc,
          [key]: acc[key] ? [...acc[key], value] : [value],
        }),
        {}
      )

    this.logger.debug(
      "[RESTRequestExecutor] Normalized headers result:",
      normalizedHeaders
    )
    return normalizedHeaders
  }

  private async constructKernelRequest(
    req: MixedRequest
  ): Promise<RESTRequest> {
    this.logger.info(
      "[RESTRequestExecutor] Constructing kernel request for URL:",
      req.effectiveFinalURL
    )

    try {
      const kernelRequest = {
        id: Date.now(),
        url: req.effectiveFinalURL,
        method: req.method,
        headers: this.normalizeHeaders(req.effectiveFinalHeaders),
        params: this.normalizeParams(req.effectiveFinalParams),
        content: await this.constructRequestContent(req.effectiveFinalBody),
      }

      this.logger.debug(
        "[RESTRequestExecutor] Constructed kernel request:",
        kernelRequest
      )
      return kernelRequest
    } catch (error) {
      this.logger.error(
        "[RESTRequestExecutor] Error constructing kernel request:",
        error
      )
      throw error
    }
  }

  private async constructRequestContent(body: string | FormData | null | File) {
    this.logger.debug(
      "[RESTRequestExecutor] Constructing request content, type:",
      body ? typeof body : "null"
    )

    try {
      if (!body) {
        this.logger.debug(
          "[RESTRequestExecutor] No body provided, returning undefined"
        )
        return undefined
      }

      if (body instanceof FormData) {
        this.logger.debug("[RESTRequestExecutor] Processing FormData body")
        return {
          kind: "form" as const,
          content: body,
        }
      }

      if (body instanceof File) {
        this.logger.debug(
          "[RESTRequestExecutor] Processing File body:",
          body.name,
          body.type
        )
        const arrayBuffer = await body.arrayBuffer()
        return {
          kind: "binary" as const,
          content: new Uint8Array(arrayBuffer),
          mediaType: body.type,
          filename: body.name,
        }
      }

      this.logger.debug("[RESTRequestExecutor] Processing text body")
      return {
        kind: "text" as const,
        content: body,
      }
    } catch (error) {
      this.logger.error(
        "[RESTRequestExecutor] Error constructing request content:",
        error
      )
      throw error
    }
  }

  private extractHeaders(
    headers: Record<string, string[]>
  ): Array<{ key: string; value: string }> {
    this.logger.debug(
      "[RESTRequestExecutor] Extracting headers from record:",
      headers
    )

    const extractedHeaders = Object.entries(headers).flatMap(([key, value]) =>
      Array.isArray(value)
        ? value.map((v) => ({ key, value: v }))
        : [{ key, value }]
    )

    this.logger.debug(
      "[RESTRequestExecutor] Extracted headers result:",
      extractedHeaders
    )
    return extractedHeaders
  }

  private getResponseBody(res: Response): ArrayBuffer {
    this.logger.debug(
      "[RESTRequestExecutor] Getting response body for content kind:",
      res.content.kind
    )

    try {
      let result: ArrayBuffer
      switch (res.content.kind) {
        case "binary":
          result = res.content.content.buffer
          break
        case "text":
          result = new TextEncoder().encode(res.content.content).buffer
          break
        case "json":
          result = new TextEncoder().encode(
            JSON.stringify(res.content.content)
          ).buffer
          break
        default:
          this.logger.warn(
            "[RESTRequestExecutor] Unknown content kind:",
            res.content.kind
          )
          result = new ArrayBuffer(0)
      }

      this.logger.debug(
        "[RESTRequestExecutor] Response body size:",
        result.byteLength,
        "bytes"
      )
      return result
    } catch (error) {
      this.logger.error(
        "[RESTRequestExecutor] Error processing response body:",
        error
      )
      throw error
    }
  }

  private createResponseFromKernel(
    res: Response,
    req: EffectiveHoppRESTRequest
  ): HoppRESTResponse {
    this.logger.info(
      "[RESTRequestExecutor] Creating response from kernel, status:",
      res.status
    )

    try {
      const responseType = res.status >= 400 ? "fail" : "success"
      const response = {
        type: responseType,
        statusCode: res.status,
        statusText: res.statusText,
        body: this.getResponseBody(res),
        headers: this.extractHeaders(res.headers),
        meta: {
          responseSize: res.meta.size.total,
          responseDuration: res.meta.timing.end - res.meta.timing.start,
        },
        req,
      }

      this.logger.debug("[RESTRequestExecutor] Created response:", {
        type: response.type,
        statusCode: response.statusCode,
        responseSize: response.meta.responseSize,
        duration: response.meta.responseDuration,
      })
      return response
    } catch (error) {
      this.logger.error(
        "[RESTRequestExecutor] Error creating response from kernel:",
        error
      )
      throw error
    }
  }

  public async execute(
    request: MixedRequest
  ): Promise<[Observable<HoppRESTResponse>, () => void]> {
    this.logger.info("[RESTRequestExecutor] Executing request:", {
      method: request.method,
      url: request.effectiveFinalURL,
    })

    const response = new BehaviorSubject<HoppRESTResponse>({
      type: "loading",
      req: request,
    })

    try {
      const kernelRequest = await this.constructKernelRequest(request)
      this.logger.debug("[RESTRequestExecutor] Starting kernel execution")

      const { cancel, response: kernelResponse } =
        this.kernelInterceptor.execute(kernelRequest)

      kernelResponse.then((result) => {
        if (E.isRight(result)) {
          this.logger.info(
            "[RESTRequestExecutor] Request completed successfully"
          )
          response.next(this.createResponseFromKernel(result.right, request))
        } else {
          this.logger.error(
            "[RESTRequestExecutor] Request failed:",
            result.left
          )
          response.next({
            type: "network_fail",
            error: result.left,
            req: request,
          })
        }
        response.complete()
      })

      return [
        response,
        () => {
          this.logger.info("[RESTRequestExecutor] Request cancelled by user")
          cancel()
        },
      ]
    } catch (error) {
      this.logger.error("[RESTRequestExecutor] Error executing request:", error)
      throw error
    }
  }
}

export const restExecutor = new RESTRequestExecutor()

export async function createRESTNetworkRequestStream(
  request: EffectiveHoppRESTRequest
): Promise<[Observable<HoppRESTResponse>, () => void]> {
  console.info(
    "[RESTNetworkRequest] Creating request stream for:",
    request.effectiveFinalURL
  )
  return restExecutor.execute(request)
}
