import type { VersionedAPI } from '@type/versioning'
import type {
    RelayV1,
    Request,
    RequestEvents,
    EventEmitter,
    Response,
    RelayError,
} from '@relay/v/1'
import * as E from 'fp-ts/Either'

import {
    execute,
    cancel,
    type Request as PluginRequest,
    type RequestResult
} from '@hoppscotch/plugin-relay'

export const implementation: VersionedAPI<RelayV1> = {
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
                'digest',
                'oauth2',
                'apikey'
            ]),
            security: new Set([
                'clientcertificates',
                'cacertificates',
                'certificatevalidation',
                'hostverification',
                'peerverification'
            ]),
            proxy: new Set([
                'http',
                'https',
                'authentication',
                'certificates'
            ]),
            advanced: new Set([
                'retry',
                'redirects',
                'timeout',
                'cookies',
                'keepalive',
                'tcpoptions',
                'http2',
                'http3'
            ])
        },

        canHandle(request: Request) {
            if (!this.capabilities.method.has(request.method)) {
                return E.left({
                    kind: "unsupported_feature",
                    feature: "method",
                    message: `Method ${request.method} is not supported`,
                    relay: "desktop"
                })
            }

            if (request.content && !this.capabilities.content.has(request.content.kind)) {
                return E.left({
                    kind: "unsupported_feature",
                    feature: "content",
                    message: `Content type ${request.content.kind} is not supported`,
                    relay: "desktop"
                })
            }

            if (request.auth && !this.capabilities.auth.has(request.auth.kind)) {
                return E.left({
                    kind: "unsupported_feature",
                    feature: "authentication",
                    message: `Authentication type ${request.auth.kind} is not supported`,
                    relay: "desktop"
                })
            }

            if (request.security?.certificates && !this.capabilities.security.has('clientcertificates')) {
                return E.left({
                    kind: "unsupported_feature",
                    feature: "security",
                    message: "Client certificates are not supported",
                    relay: "desktop"
                })
            }

            if (request.proxy && !this.capabilities.proxy.has(request.proxy.url.startsWith('https') ? 'https' : 'http')) {
                return E.left({
                    kind: "unsupported_feature",
                    feature: "proxy",
                    message: `Proxy protocol ${request.proxy.url.split(':')[0]} is not supported`,
                    relay: "desktop"
                })
            }

            return E.right(true)
        },

        execute(request: Request) {
            const emitter: EventEmitter<RequestEvents> = {
                on: () => () => {},
                once: () => () => {},
                off: () => {}
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
                version: request.version,
                headers: request.headers,
                params: request.params,
                content: request.content,
                auth: request.auth,
                security: request.security,
                proxy: request.proxy,
            } as PluginRequest

            const responsePromise = execute(pluginRequest)
                .then((result: RequestResult): E.Either<RelayError, Response> => {
                    if (result.kind === 'success') {
                        const response: Response = {
                            id: result.response.id,
                            status: result.response.status,
                            statusText: result.response.statusText,
                            version: result.response.version,
                            headers: result.response.headers,
                            cookies: result.response.cookies,
                            content: result.response.content,
                            meta: {
                                timing: {
                                    start: result.response.meta.timing.start,
                                    end: result.response.meta.timing.end,
                                },
                                size: result.response.meta.size,
                                                        }
                        }
                        return E.right(response)
                    }
                    return E.left(result.error)
                })
                .catch((error: unknown): E.Either<RelayError, Response> => {
                    const networkError: RelayError = {
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
