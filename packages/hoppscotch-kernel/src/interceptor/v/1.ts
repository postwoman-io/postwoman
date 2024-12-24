import type { VersionedAPI } from '@type/versioning'

import * as E from 'fp-ts/Either'

export type Method =
    | "GET"
    | "POST"
    | "PUT"
    | "DELETE"
    | "PATCH"
    | "HEAD"
    | "OPTIONS"
    | "CONNECT"
    | "TRACE"

export type ContentType =
    | { kind: "text"; content: string; mediaType?: string }
    | { kind: "json"; content: unknown }
    | { kind: "form"; content: FormData }
    | {
        kind: 'binary';
        content: Uint8Array;
        mediaType?: string;
        filename?: string;
    }
    | { kind: "multipart"; content: FormData }
    | { kind: "urlencoded"; content: Record<string, string> }
    | { kind: "stream"; content: ReadableStream }

export type AuthType =
    | { kind: "none" }
    | { kind: "basic"; username: string; password: string }
    | { kind: "bearer"; token: string }
    | {
        kind: "digest"
        username: string
        password: string
        realm?: string
        nonce?: string
        opaque?: string
        algorithm?: "MD5" | "SHA-256" | "SHA-512"
        qop?: "auth" | "auth-int"
    }
    | {
        kind: "oauth2"
        accessToken: string
        tokenType?: string
        refreshToken?: string
    }
    | {
        kind: "apikey"
        key: string
        in: "header" | "query"
        name: string
    }

export type CertificateType =
    | {
        kind: "pem"
        cert: Uint8Array
        key: Uint8Array
    }
    | {
        kind: "pfx"
        data: Uint8Array
        password: string
    }

export interface Request {
    id: number
    url: string
    method: Method
    headers?: Record<string, string[]>
    params?: Record<string, string>
    content?: ContentType
    auth?: AuthType

    security?: {
        certificates?: {
            client?: CertificateType
            ca?: Array<Uint8Array>
        }
        validateCertificates: boolean
        verifyHost: boolean
    }

    proxy?: {
        url: string
        auth?: {
            username: string
            password: string
        }
        certificates?: {
            ca?: Uint8Array
            client?: CertificateType
        }
    }

    options?: {
        timeout?: number
        timeoutConnect?: number
        timeoutTLS?: number
        followRedirects?: boolean
        maxRedirects?: number
        retry?: {
            count: number
            interval: number
            conditions?: Array<(res: Response) => boolean>
        }
        cookies?: boolean
        decompress?: boolean
        keepAlive?: boolean
        tcpKeepAlive?: boolean
        tcpNoDelay?: boolean
        ipVersion?: "v4" | "v6" | "any"
    }
}

export interface RequestEvents {
    progress: {
        phase: 'upload' | 'download'
        loaded: number
        total?: number
    }
    stateChange: {
        state: 'preparing' | 'connecting' | 'sending' | 'waiting' | 'receiving' | 'done'
    }
    authChallenge: {
        type: 'basic' | 'digest' | 'oauth2'
        params: Record<string, string>
    }
    cookieReceived: {
        domain: string
        name: string
        value: string
        path?: string
        expires?: Date
        secure?: boolean
        httpOnly?: boolean
        sameSite?: 'Strict' | 'Lax' | 'None'
    }
    error: {
        phase: 'preparation' | 'connection' | 'request' | 'response'
        error: InterceptorError
    }
}

export type EventEmitter<T> = {
    on<K extends keyof T>(event: K, handler: (payload: T[K]) => void): () => void
    once<K extends keyof T>(event: K, handler: (payload: T[K]) => void): () => void
    off<K extends keyof T>(event: K, handler: (payload: T[K]) => void): void
}

export type MethodCapability =
    | 'GET'
    | 'POST'
    | 'PUT'
    | 'DELETE'
    | 'PATCH'
    | 'HEAD'
    | 'OPTIONS'
    | 'CONNECT'
    | 'TRACE'

export type HeaderCapability =
    | 'StringValues'
    | 'ArrayValues'

export type ContentCapability =
    | 'Text'
    | 'Json'
    | 'FormData'
    | 'Binary'
    | 'Multipart'
    | 'Urlencoded'
    | 'Streaming'
    | 'Compression'

export type AuthCapability =
    | 'Basic'
    | 'Bearer'
    | 'Digest'
    | 'OAuth2'
    | 'Mtls'
    | 'ApiKey'

export type SecurityCapability =
    | 'ClientCertificates'
    | 'CaCertificates'
    | 'CertificateValidation'
    | 'HostVerification'

export type ProxyCapability =
    | 'Http'
    | 'Https'
    | 'Socks'
    | 'Authentication'
    | 'Certificates'

export type AdvancedCapability =
    | 'Retry'
    | 'Redirects'
    | 'Timeout'
    | 'Cookies'
    | 'KeepAlive'
    | 'TcpOptions'
    | 'Ipv6'


export interface Capabilities {
    method: Set<MethodCapability>
    header: Set<HeaderCapability>
    content: Set<ContentCapability>
    auth: Set<AuthCapability>
    security: Set<SecurityCapability>
    proxy: Set<ProxyCapability>
    advanced: Set<AdvancedCapability>
}

export type UnsupportedFeatureError = {
    kind: "unsupported_feature"
    feature: string
    message: string
    interceptor: string
    alternatives?: Array<{
        interceptor: string
        description: string
    }>
}

export type InterceptorError =
    | UnsupportedFeatureError
    | { kind: "network"; message: string; cause?: unknown }
    | { kind: "timeout"; message: string; phase?: "connect" | "tls" | "response" }
    | { kind: "certificate"; message: string; cause?: unknown }
    | { kind: "auth"; message: string; cause?: unknown }
    | { kind: "proxy"; message: string; cause?: unknown }
    | { kind: "parse"; message: string; cause?: unknown }
    | { kind: "protocol"; message: string; cause?: unknown }
    | { kind: "abort"; message: string }

export interface Response {
    id: number
    status: number
    statusText: string
    headers: Record<string, string[]>
    content: ContentType

    meta: {
        timing: {
            start: number
            end: number
            phases?: {
                dns?: number
                connect?: number
                tls?: number
                send?: number
                wait?: number
                receive?: number
            }
        }
        size: {
            headers: number
            body: number
            total: number
        }
        tls?: {
            protocol: string
            cipher: string
            certificates?: Array<{
                subject: string
                issuer: string
                validFrom: string
                validTo: string
            }>
        }
        redirects?: Array<{
            url: string
            status: number
            headers: Record<string, string | string[]>
        }>
    }
}

export interface InterceptorV1 {
    readonly id: string
    readonly capabilities: Capabilities

    canHandle(request: Request): E.Either<UnsupportedFeatureError, true>

    execute(
        request: Request
    ): {
        cancel: () => void
        emitter: EventEmitter<RequestEvents>
        response: Promise<E.Either<InterceptorError, Response>>
    }
}

export const hasCapability = <T>(capabilities: Set<T>, capability: T): boolean =>
    capabilities.has(capability)

export function findSuitableInterceptor(
    request: Request,
    interceptors: InterceptorV1[]
): E.Either<UnsupportedFeatureError, InterceptorV1> {
    for (const interceptor of interceptors) {
        const result = interceptor.canHandle(request)
        if (E.isRight(result)) {
            return E.right(interceptor)
        }
    }

    const errors = interceptors
        .map(i => i.canHandle(request))
        .filter(E.isLeft)
        .map(e => e.left)

    return E.left(errors[0])
}

export const request = {
    new: (
        id: number,
        url: string,
        method: Method,
        init: Partial<Omit<Request, 'url' | 'method'>> = {}
    ): Request => ({
        id,
        url,
        method,
        ...init
    })
}

export const content = {
    text: (content: string, mediaType?: string): ContentType => ({
        kind: "text",
        content,
        mediaType
    }),

    json: <T>(content: T): ContentType => ({
        kind: "json",
        content
    }),

    binary: (content: Uint8Array, mediaType?: string): ContentType => ({
        kind: "binary",
        content,
        mediaType
    }),

    form: (content: FormData): ContentType => ({
        kind: "form",
        content
    }),

    urlencoded: (content: Record<string, string>): ContentType => ({
        kind: "urlencoded",
        content
    }),

    stream: (content: ReadableStream): ContentType => ({
        kind: "stream",
        content
    })
}

export const v1: VersionedAPI<InterceptorV1> = {
    version: { major: 1, minor: 0, patch: 0 },
    api: {
        id: "default",
        capabilities: {
            method: new Set<MethodCapability>(),
            header: new Set<HeaderCapability>(),
            content: new Set<ContentCapability>(),
            auth: new Set<AuthCapability>(),
            security: new Set<SecurityCapability>(),
            proxy: new Set<ProxyCapability>(),
            advanced: new Set<AdvancedCapability>()
        },
        canHandle: () => E.left({
            kind: "unsupported_feature",
            feature: "execution",
            message: "Default interceptor cannot handle requests",
            interceptor: "default"
        }),
        execute: () => ({
            cancel: () => {},
            emitter: {
                on: () => () => {},
                once: () => () => {},
                off: () => {}
            },
            response: Promise.resolve(
                E.left({
                    kind: "protocol",
                    message: "Not implemented"
                })
            )
        })
    }
}
