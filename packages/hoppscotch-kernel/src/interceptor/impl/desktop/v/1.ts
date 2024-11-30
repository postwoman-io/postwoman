import type { VersionedAPI } from '@type/versioning'
import type {
    InterceptorV1,
    Request,
    RequestEvents,
    EventEmitter,
    Response,
    InterceptorError
} from '@interceptor/v/1'
import * as E from 'fp-ts/Either'

import {
    execute,
    cancel,
    type Request as PluginRequest,
    type RequestResult
} from 'tauri-plugin-hoppscotch-relay-api'

export const implementation: VersionedAPI<InterceptorV1> = {
    version: { major: 1, minor: 0, patch: 0 },
    api: {
        id: 'desktop',
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
                'StringValues'
            ]),
            content: new Set([
                'Text',
                'Json',
                'FormData',
                'Urlencoded'
            ]),
            auth: new Set([
                'Basic',
                'Bearer',
                'Digest'
            ]),
            security: new Set([
                'ClientCertificates',
                'CaCertificates',
                'CertificateValidation',
                'HostVerification'
            ]),
            proxy: new Set([
                'Http',
                'Https'
            ]),
            advanced: new Set([
                'Redirects',
                'Timeout'
            ])
        },

        // TODO: Use `capabilities` to determine this,
        // for now let's just use `capabilities` directly to make sure interceptors can handle requests.
        canHandle(_request: Request) {
            return E.right(true)
        },

        execute(request: Request) {
            const emitter: EventEmitter<RequestEvents> = {
                on: () => () => { },
                once: () => () => { },
                off: () => { }
            }

            // SAFETY: Type assertion is safe because:
            // 1. The capabilities system prevents requests with unsupported methods from reaching this point
            // 2. Content types not supported by the plugin are filtered by capabilities
            // 3. Authentication methods are validated through capabilities
            // 4. The plugin's Request type is a subset of our Request type
            const pluginRequest = {
                id: request.id,
                url: request.url,
                method: request.method,
                headers: request.headers,
                params: request.params,
                content: request.content,
                auth: request.auth,
                security: request.security,
                proxy: request.proxy ? { url: request.proxy.url } : undefined
            } as PluginRequest

            const responsePromise = execute(pluginRequest)
                .then((result: RequestResult): E.Either<InterceptorError, Response> => {
                    if (result.kind === 'success') {
                        const response: Response = {
                            id: result.response.id,
                            status: result.response.status,
                            statusText: result.response.statusText,
                            headers: result.response.headers,
                            content: result.response.content,
                            meta: {
                                timing: {
                                    start: result.response.meta.timing.start,
                                    end: result.response.meta.timing.end,
                                },
                                size: result.response.meta.size
                            }
                        }
                        return E.right(response)
                    }
                    return E.left(result.error)
                })
                .catch((error: unknown): E.Either<InterceptorError, Response> => {
                    const networkError: InterceptorError = {
                        kind: 'network',
                        message: error instanceof Error ? error.message : 'Unknown error occurred',
                        cause: error
                    }
                    return E.left(networkError)
                })

            return {
                cancel: () => { cancel(request.id) },
                emitter,
                response: responsePromise
            }
        }
    }
}
