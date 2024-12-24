import type { VersionedAPI } from '@type/versioning'
import type { InterceptorV1, Request, Response, UnsupportedFeatureError, RequestEvents, EventEmitter } from '@interceptor/v/1'

import axios, { AxiosRequestConfig, AxiosResponse } from 'axios'
import * as E from 'fp-ts/Either'

function createEventEmitter<T extends Record<string, any>>(): {
  emitter: EventEmitter<T>
  emit: <K extends keyof T>(event: K, payload: T[K]) => void
} {
  const listeners = new Map<keyof T, Set<(payload: any) => void>>()
  const onceListeners = new WeakMap<(payload: any) => void, (payload: any) => void>()

  const emitter: EventEmitter<T> = {
    on(event, handler) {
      if (!listeners.has(event)) {
        listeners.set(event, new Set())
      }
      listeners.get(event)!.add(handler)
      return () => this.off(event, handler)
    },
    once(event, handler) {
      const wrappedHandler = (payload: any) => {
        handler(payload)
        this.off(event, wrappedHandler)
      }
      onceListeners.set(handler, wrappedHandler)
      return this.on(event, wrappedHandler)
    },
    off(event, handler) {
      const wrappedHandler = onceListeners.get(handler) ?? handler
      listeners.get(event)?.delete(wrappedHandler)
    }
  }

  const emit = <K extends keyof T>(event: K, payload: T[K]) => {
    listeners.get(event)?.forEach(handler => handler(payload))
  }

  return { emitter, emit }
}

const contentTypeConversions = {
  async toAxiosData(content: Request['content']): Promise<unknown> {
    if (!content) return undefined

    switch (content.kind) {
      case 'text':
      case 'json':
        return content.content
      case 'binary':
        return content.content.buffer
      case 'form':
      case 'multipart':
        return content.content
      case 'urlencoded': {
        const params = new URLSearchParams()
        Object.entries(content.content).forEach(([key, value]) => {
          params.append(key, value)
        })
        return params
      }
      case 'stream':
        return content.content
    }
  },

  async fromAxiosResponse(data: unknown, contentType?: string): Promise<Response['content']> {
    if (data instanceof ArrayBuffer || data instanceof Uint8Array) {
      return { kind: 'binary', content: new Uint8Array(data), mediaType: contentType }
    }

    if (typeof data === 'string') {
      return { kind: 'text', content: data, mediaType: contentType }
    }

    return { kind: 'json', content: data }
  }
}

const headerProcessor = {
  normalize(headers: Record<string, any>): Record<string, string[]> {
    return Object.fromEntries(
      Object.entries(headers)
        .filter(([_, value]) => value !== undefined)
        .map(([key, value]) => [
          key,
          Array.isArray(value) ? value.map(String) : [String(value)]
        ])
    )
  }
}

const authProcessor = {
  process(config: AxiosRequestConfig, auth: Request['auth']): void {
    if (!auth) return

    switch (auth.kind) {
      case 'basic':
        config.auth = { username: auth.username, password: auth.password }
        break
      case 'bearer':
        config.headers = headerProcessor.normalize({
          ...config.headers,
          'Authorization': `Bearer ${auth.token}`
        })
        break
      case 'apikey':
        if (auth.in === 'header') {
          config.headers = headerProcessor.normalize({
            ...config.headers,
            [auth.name]: auth.key
          })
        } else {
          config.params = { ...config.params, [auth.name]: auth.key }
        }
        break
    }
  }
}

const responseProcessor = {
  createMetadata(startTime: number, endTime: number, response: AxiosResponse): Response['meta'] {
    const headerSize = JSON.stringify(response.headers).length
    const bodySize = response.data instanceof ArrayBuffer ? response.data.byteLength : 0

    return {
      timing: {
        start: startTime,
        end: endTime,
      },
      size: {
        headers: headerSize,
        body: bodySize,
        total: headerSize + bodySize
      }
    }
  }
}

const errorProcessor = {
  handleError(e: unknown) {
    if (axios.isCancel(e)) {
      return E.left({ kind: 'abort', message: 'Request was cancelled' } as const)
    }

    if (axios.isAxiosError(e)) {
      if (e.code === 'ECONNABORTED') {
        return E.left({
          kind: 'timeout',
          message: 'Request timed out',
          phase: 'response'
        } as const)
      }

      return E.left({ kind: 'network', message: e.message ?? 'Network error' } as const)
    }

    return E.left({
      kind: 'network',
      message: 'An unknown error occurred',
      cause: e
    } as const)
  }
}

export const implementation: VersionedAPI<InterceptorV1> = {
  version: { major: 1, minor: 0, patch: 0 },
  api: {
    id: 'web',
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
        'StringValues',
        'ArrayValues'
      ]),
      content: new Set([
        'Text',
        'Json',
        'FormData',
        'Binary',
        'Multipart',
        'Urlencoded',
        'Streaming'
      ]),
      auth: new Set([
        'Basic',
        'Bearer',
        'ApiKey'
      ]),
      security: new Set([]),
      proxy: new Set([]),
      advanced: new Set([
        'Timeout',
        'Redirects'
      ])
    },

    canHandle(request: Request): E.Either<UnsupportedFeatureError, true> {
      const unsupportedFeatures = [
        request.security?.certificates && ['certificates', 'Web implementation does not support certificates'],
        request.proxy && ['proxy', 'Web implementation does not support proxy']
      ].filter(Boolean) as Array<[string, string]>

      if (unsupportedFeatures.length > 0) {
        const [feature, message] = unsupportedFeatures[0]
        return E.left({
          kind: 'unsupported_feature',
          feature,
          message,
          interceptor: 'web'
        })
      }

      return E.right(true)
    },

    execute(request: Request) {
      const cancelTokenSource = axios.CancelToken.source()
      const { emitter, emit } = createEventEmitter<RequestEvents>()

      const response = (async () => {
        try {
          const startTime = Date.now()

          const config: AxiosRequestConfig = {
            url: request.url,
            method: request.method,
            headers: request.headers ? headerProcessor.normalize(request.headers) : undefined,
            params: request.params,
            data: await contentTypeConversions.toAxiosData(request.content),
            cancelToken: cancelTokenSource.token,
            responseType: 'arraybuffer',
            maxRedirects: request.options?.maxRedirects,
            timeout: request.options?.timeout,
            decompress: request.options?.decompress ?? true,
            validateStatus: null
          }

          authProcessor.process(config, request.auth)

          const response = await axios(config)
          const endTime = Date.now()

          emit('stateChange', { state: 'done' })

          const responseObj: Response = {
            id: request.id,
            status: response.status,
            statusText: response.statusText,
            headers: headerProcessor.normalize(response.headers),
            content: await contentTypeConversions.fromAxiosResponse(
              response.data,
              response.headers['content-type']?.[0]
            ),
            meta: responseProcessor.createMetadata(startTime, endTime, response)
          }

          return E.right(responseObj)
        } catch (e) {
          emit('error', {
            phase: 'request',
            error: { kind: 'network', message: String(e) }
          })
          return errorProcessor.handleError(e)
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
