import type { VersionedAPI } from '@type/versioning'
import type {
  RelayV1,
  Request,
  RequestEvents,
  EventEmitter,
  Response,
  RelayError,
  StatusCode,
} from '@relay/v/1'

import * as E from 'fp-ts/Either'
import axios, { AxiosRequestConfig, AxiosResponse } from 'axios'
import { AwsV4Signer } from 'aws4fetch'

const isStatusCode = (status: number): status is StatusCode =>
  status >= 100 && status < 600

function determineContent(response: AxiosResponse): Response['content'] {
  const contentType = normalizeHeaders(response.headers)['content-type']?.[0]
  const data = response.data

  if (data instanceof ArrayBuffer || data instanceof Uint8Array) {
    return {
      kind: 'binary',
      content: new Uint8Array(data),
      mediaType: 'application/octet-stream'
    }
  }

  if (typeof data === 'string') {
    if (contentType?.includes('application/json')) {
      try {
        return {
          kind: 'json',
          content: JSON.parse(data),
          mediaType: 'application/json'
        }
      } catch {
        // Fall through to text
      }
    }

    if (contentType?.includes('xml')) {
      return {
        kind: 'xml',
        content: data,
        mediaType: contentType.includes('application/xml') ? 'application/xml' : 'text/xml'
      }
    }

    // Handle text content types
    if (contentType?.includes('text/html')) {
      return {
        kind: 'text',
        content: data,
        mediaType: 'text/html'
      }
    }
    if (contentType?.includes('text/css')) {
      return {
        kind: 'text',
        content: data,
        mediaType: 'text/css'
      }
    }
    if (contentType?.includes('text/csv')) {
      return {
        kind: 'text',
        content: data,
        mediaType: 'text/csv'
      }
    }

    return {
      kind: 'text',
      content: data,
      mediaType: 'text/plain'
    }
  }

  if (data instanceof FormData) {
    return {
      kind: 'form',
      content: data,
      mediaType: 'application/x-www-form-urlencoded'
    }
  }

  if (data instanceof ReadableStream) {
    return {
      kind: 'stream',
      content: data,
      mediaType: contentType ?? 'application/octet-stream'
    }
  }

  return {
    kind: 'json',
    content: data,
    mediaType: 'application/json'
  }
}

function normalizeHeaders(headers: Record<string, any>): Record<string, string[]> {
  return Object.fromEntries(
    Object.entries(headers)
      .filter(([_, v]) => v !== undefined)
      .map(([k, v]) => [
        k.toLowerCase(),
        Array.isArray(v) ? v.map(String) : [String(v)]
      ])
  )
}

export const implementation: VersionedAPI<RelayV1> = {
  version: { major: 1, minor: 0, patch: 0 },
  api: {
    id: 'axios',
    capabilities: {
      method: new Set([
        'GET',
        'POST',
        'PUT',
        'DELETE',
        'PATCH',
        'HEAD',
        'OPTIONS'
      ]),
      header: new Set([
        'stringvalue',
        'arrayvalue',
        'multivalue'
      ]),
      content: new Set([
        'text',
        'json',
        'xml',
        'form',
        'binary',
        'multipart',
        'urlencoded',
        'stream',
        'compression'
      ]),
      auth: new Set([
        'basic',
        'bearer',
        'apikey',
        'aws'
      ]),
      security: new Set([]),
      proxy: new Set([]),
      advanced: new Set([])
    },

    canHandle(request: Request) {
      if (!this.capabilities.method.has(request.method)) {
        return E.left({
          kind: "unsupported_feature",
          feature: "method",
          message: `Method ${request.method} is not supported`,
          relay: "axios"
        })
      }

      if (request.content && !this.capabilities.content.has(request.content.kind)) {
        return E.left({
          kind: "unsupported_feature",
          feature: "content",
          message: `Content type ${request.content.kind} is not supported`,
          relay: "axios"
        })
      }

      if (request.auth && !this.capabilities.auth.has(request.auth.kind)) {
        return E.left({
          kind: "unsupported_feature",
          feature: "authentication",
          message: `Authentication type ${request.auth.kind} is not supported`,
          relay: "axios"
        })
      }

      if (request.security?.certificates) {
        return E.left({
          kind: "unsupported_feature",
          feature: "security",
          message: "Client certificates are not supported",
          relay: "axios"
        })
      }

      if (request.proxy) {
        return E.left({
          kind: "unsupported_feature",
          feature: "proxy",
          message: "Proxy is not supported",
          relay: "axios"
        })
      }

      return E.right(true)
    },

    execute(request: Request) {
      const cancelTokenSource = axios.CancelToken.source()
      const emitter: EventEmitter<RequestEvents> = {
        on: () => () => {},
        once: () => () => {},
        off: () => {}
      }

      const response: Promise<E.Either<RelayError, Response>> = (async () => {
        try {
          const startTime = Date.now()
          const config: AxiosRequestConfig = {
            url: request.url,
            method: request.method,
            headers: request.headers,
            params: request.params,
            data: request.content?.content,
            maxRedirects: request.meta?.options?.maxRedirects,
            timeout: request.meta?.options?.timeout,
            decompress: request.meta?.options?.decompress ?? true,
            validateStatus: null,
            cancelToken: cancelTokenSource.token
          }

          if (request.auth) {
            switch (request.auth.kind) {
              case 'basic':
                config.auth = {
                  username: request.auth.username,
                  password: request.auth.password
                }
                break
              case 'bearer':
                config.headers = {
                  ...config.headers,
                  Authorization: `Bearer ${request.auth.token}`
                }
                break
              case 'apikey':
                if (request.auth.in === 'header') {
                  config.headers = {
                    ...config.headers,
                    [request.auth.key]: request.auth.value
                  }
                } else {
                  config.params = {
                    ...config.params,
                    [request.auth.key]: request.auth.value
                  }
                }
                break
              case 'aws': {
                const { accessKey, secretKey, region, service, sessionToken, in: location } = request.auth
                const signer = new AwsV4Signer({
                  url: request.url,
                  method: request.method,
                  accessKeyId: accessKey,
                  secretAccessKey: secretKey,
                  region,
                  service,
                  sessionToken,
                  datetime: new Date().toISOString().replace(/[:-]|\.\d{3}/g, ""),
                  signQuery: false
                })
                const signed = await signer.sign()
                if (location === "query") {
                  config.url = signed.url.toString()
                } else {
                  const headers: Record<string, string> = {}
                  signed.headers.forEach((value, key) => {
                    headers[key] = value
                  })
                  config.headers = {
                    ...config.headers,
                    ...headers
                  }
                }
                break
              }
            }
          }

          const axiosResponse = await axios(config)
          const endTime = Date.now()

          if (!isStatusCode(axiosResponse.status)) {
            return E.left({
              kind: 'version',
              message: `Invalid status code: ${axiosResponse.status}`
            })
          }

          const response: Response = {
            id: request.id,
            status: axiosResponse.status,
            statusText: axiosResponse.statusText,
            version: request.version,
            headers: normalizeHeaders(axiosResponse.headers),
            content: determineContent(axiosResponse),
            meta: {
              timing: {
                start: startTime,
                end: endTime,
              },
              size: {
                headers: JSON.stringify(axiosResponse.headers).length,
                body: axiosResponse.data?.length ?? 0,
                total: JSON.stringify(axiosResponse.headers).length + (axiosResponse.data?.length ?? 0)
              }
            }
          }

          return E.right(response)
        } catch (error) {
          if (axios.isCancel(error)) {
            return E.left({ kind: 'abort', message: 'Request cancelled' })
          }

          if (axios.isAxiosError(error)) {
            if (error.code === 'ECONNABORTED') {
              return E.left({
                kind: 'timeout',
                message: 'Request timed out',
                phase: 'response'
              })
            }
            return E.left({
              kind: 'network',
              message: error.message
            })
          }

          return E.left({
            kind: 'network',
            message: error instanceof Error ? error.message : 'Unknown error occurred',
            cause: error
          })
        }
      })()

      return {
        cancel: () => cancelTokenSource.cancel(),
        emitter,
        response
      }
    }
  }
}
