import {
  type FormData,
  type FormDataValue,
  type RelayError,
  type RelayEventEmitter,
  type RelayRequest,
  type RelayRequestEvents,
  type RelayResponse,
  type RelayV1,
  type StatusCode,
  body,
} from '@relay/v/1'
import type { VersionedAPI } from '@type/versioning'

import { AwsV4Signer } from 'aws4fetch'
import axios, { AxiosRequestConfig } from 'axios'

import * as E from 'fp-ts/Either'
import * as R from 'fp-ts/Record'
import { pipe } from 'fp-ts/function'

const isStatusCode = (status: number): status is StatusCode =>
  status >= 100 && status < 600

const normalizeHeaders = (headers: Record<string, any>): Record<string, string> =>
  pipe(
    headers,
    R.filterWithIndex((_, v) => v !== undefined),
    R.map(String)
  )

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
        'urlencoded',
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

    canHandle(request: RelayRequest) {
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

    execute(request: RelayRequest) {
      const cancelTokenSource = axios.CancelToken.source()
      const emitter: RelayEventEmitter<RelayRequestEvents> = {
        on: () => () => {},
        once: () => () => {},
        off: () => {}
      }

      const response: Promise<E.Either<RelayError, RelayResponse>> = (async () => {
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
            cancelToken: cancelTokenSource.token,
            responseType: 'arraybuffer'
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

          const normalizedHeaders = normalizeHeaders(axiosResponse.headers)
          const contentType = normalizedHeaders['content-type'] || normalizedHeaders['Content-Type'] || normalizedHeaders['CONTENT-TYPE']

          const response: RelayResponse = {
            id: request.id,
            status: axiosResponse.status,
            statusText: axiosResponse.statusText,
            version: request.version,
            headers: normalizedHeaders,
            body: body.body(axiosResponse.data, contentType),
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
        cancel: async () => { cancelTokenSource.cancel() },
        emitter,
        response
      }
    }
  }
}
