import type { VersionedAPI } from '@type/versioning'

import * as E from 'fp-ts/Either'

export type Method =
    | "GET"        // Retrieve resource
    | "POST"       // Create resource
    | "PUT"        // Replace resource
    | "DELETE"     // Remove resource
    | "PATCH"      // Modify resource
    | "HEAD"       // GET without body
    | "OPTIONS"    // Get allowed methods
    | "CONNECT"    // Create tunnel
    | "TRACE"      // Loop-back test

export type Version = "HTTP/1.0" | "HTTP/1.1" | "HTTP/2" | "HTTP/3"

export type StatusCode =
    | 100  // Continue
    | 101  // Switching Protocols
    | 102  // Processing
    | 103  // Early Hints
    | 200  // OK
    | 201  // Created
    | 202  // Accepted
    | 203  // Non-Authoritative Info
    | 204  // No Content
    | 205  // Reset Content
    | 206  // Partial Content
    | 207  // Multi-Status
    | 208  // Already Reported
    | 226  // IM Used
    | 300  // Multiple Choices
    | 301  // Moved Permanently
    | 302  // Found
    | 303  // See Other
    | 304  // Not Modified
    | 305  // Use Proxy
    | 306  // Switch Proxy
    | 307  // Temporary Redirect
    | 308  // Permanent Redirect
    | 400  // Bad Request
    | 401  // Unauthorized
    | 402  // Payment Required
    | 403  // Forbidden
    | 404  // Not Found
    | 405  // Method Not Allowed
    | 406  // Not Acceptable
    | 407  // Proxy Auth Required
    | 408  // Request Timeout
    | 409  // Conflict
    | 410  // Gone
    | 411  // Length Required
    | 412  // Precondition Failed
    | 413  // Payload Too Large
    | 414  // URI Too Long
    | 415  // Unsupported Media
    | 416  // Range Not Satisfiable
    | 417  // Expectation Failed
    | 418  // I'm a teapot
    | 421  // Misdirected Request
    | 422  // Unprocessable Entity
    | 423  // Locked
    | 424  // Failed Dependency
    | 425  // Too Early
    | 426  // Upgrade Required
    | 428  // Precondition Required
    | 429  // Too Many Requests
    | 431  // Headers Too Large
    | 451  // Unavailable Legal
    | 500  // Server Error
    | 501  // Not Implemented
    | 502  // Bad Gateway
    | 503  // Service Unavailable
    | 504  // Gateway Timeout
    | 505  // HTTP Ver. Not Supported
    | 506  // Variant Negotiates
    | 507  // Insufficient Storage
    | 508  // Loop Detected
    | 510  // Not Extended
    | 511  // Network Auth Required

export type FormDataValue =
    | { kind: "text"; value: string }
    | { kind: "file"; filename: string; contentType: string; data: Uint8Array }

export type FormData = Map<string, FormDataValue[]>

export enum MediaType {
    TEXT_PLAIN = "text/plain",
    TEXT_HTML = "text/html",
    TEXT_CSS = "text/css",
    TEXT_CSV = "text/csv",
    APPLICATION_JSON = "application/json",
    APPLICATION_LD_JSON = "application/ld+json",
    APPLICATION_XML = "application/xml",
    TEXT_XML = "text/xml",
    APPLICATION_FORM = "application/x-www-form-urlencoded",
    APPLICATION_OCTET = "application/octet-stream",
    MULTIPART_FORM = "multipart/form-data"
}

export type ContentType =
    | { kind: "text"; content: string; mediaType: MediaType.TEXT_PLAIN | MediaType.TEXT_HTML | MediaType.TEXT_CSS | MediaType.TEXT_CSV }
    | { kind: "json"; content: unknown; mediaType: MediaType.APPLICATION_JSON | MediaType.APPLICATION_LD_JSON }
    | { kind: "xml"; content: string; mediaType: MediaType.APPLICATION_XML | MediaType.TEXT_XML }
    | { kind: "form"; content: FormData; mediaType: MediaType.APPLICATION_FORM }
    | { kind: "binary"; content: Uint8Array; mediaType: MediaType.APPLICATION_OCTET | string; filename?: string }
    | { kind: "multipart"; content: FormData; mediaType: MediaType.MULTIPART_FORM }
    | { kind: "urlencoded"; content: string; mediaType: MediaType.APPLICATION_FORM }
    | { kind: "stream"; content: ReadableStream; mediaType: string }

export interface RelayResponseBody {
    body: Uint8Array
    mediaType: MediaType | string
}

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
        nc?: string
        cnonce?: string
    }
    | {
        kind: "oauth2"
        grantType:
        | {
            kind: "authorization_code"
            authEndpoint: string
            tokenEndpoint: string
            clientId: string
            clientSecret?: string
        }
        | {
            kind: "client_credentials"
            tokenEndpoint: string
            clientId: string
            clientSecret?: string
        }
        | {
            kind: "password"
            tokenEndpoint: string
            username: string
            password: string
        }
        | {
            kind: "implicit"
            authEndpoint: string
            clientId: string
        }
        accessToken?: string
        refreshToken?: string
    }
    | {
        kind: "apikey"
        key: string
        value: string
        in: "header" | "query"
    }
    | {
        kind: "aws"
        accessKey: string
        secretKey: string
        region: string
        service: string
        sessionToken?: string
        in: "header" | "query"
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

export interface RelayRequestEvents {
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
        error: RelayError
    }
}

export type RelayEventEmitter<T> = {
    on<K extends keyof T>(event: K, handler: (payload: T[K]) => void): () => void
    once<K extends keyof T>(event: K, handler: (payload: T[K]) => void): () => void
    off<K extends keyof T>(event: K, handler: (payload: T[K]) => void): void
}

// NOTE: RelayCapabilities and their corresponding objects being two separate types
// even with sometimes identical contents is intentional.
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
    | 'stringvalue'
    | 'arrayvalue'
    | 'multivalue'

export type ContentCapability =
    | 'text'
    | 'json'
    | 'xml'
    | 'form'
    | 'binary'
    | 'multipart'
    | 'urlencoded'
    | 'stream'
    | 'compression'

export type AuthCapability =
    | 'none'
    | 'basic'
    | 'bearer'
    | 'digest'
    | 'oauth2'
    | 'apikey'
    | 'aws'
    | 'mtls'

export type SecurityCapability =
    | 'clientcertificates'
    | 'cacertificates'
    | 'certificatevalidation'
    | 'hostverification'
    | 'peerverification'

export type ProxyCapability =
    | 'http'
    | 'https'
    | 'socks'
    | 'authentication'
    | 'certificates'

export type AdvancedCapability =
    | 'retry'
    | 'redirects'
    | 'timeout'
    | 'cookies'
    | 'keepalive'
    | 'tcpoptions'
    | 'ipv6'
    | 'http2'
    | 'http3'
    | 'localaccess'

export interface RelayCapabilities {
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
    relay: string
    alternatives?: Array<{
        relay: string
        description: string
    }>
}

export type RelayError =
    | UnsupportedFeatureError
    | { kind: "network"; message: string; cause?: unknown }
    | { kind: "timeout"; message: string; phase?: "connect" | "tls" | "response" }
    | { kind: "certificate"; message: string; cause?: unknown }
    | { kind: "auth"; message: string; cause?: unknown }
    | { kind: "proxy"; message: string; cause?: unknown }
    | { kind: "parse"; message: string; cause?: unknown }
    | { kind: "version"; message: string; cause?: unknown }
    | { kind: "abort"; message: string }

export interface RelayRequest {
    id: number
    url: string
    method: Method
    version: Version
    headers?: Record<string, string>
    params?: Record<string, string>
    content?: ContentType
    auth?: AuthType

    security?: {
        certificates?: {
            client?: CertificateType
            ca?: Array<Uint8Array>
        }
        validateCertificates?: boolean
        verifyHost?: boolean
        verifyPeer?: boolean
    }

    proxy?: {
        url: string
        auth?: {
            username: string
            password: string
        }
        certificates?: {
            ca?: Uint8Array[]
            client?: CertificateType
        }
    }

    meta?: {
        timing?: {
            connect?: number
            request?: number
            tls?: number
        }
        retry?: {
            count: number
            delay: number
        }
        options?: {
            timeout?: number
            followRedirects?: boolean
            maxRedirects?: number
            decompress?: boolean
            cookies?: boolean
            keepAlive?: boolean
            tcpNoDelay?: boolean
            ipVersion?: "v4" | "v6" | "any"
        }
        http2?: {
            settings: Record<string, number>
            pushPromise: boolean
        }
        http3?: {
            quicConfig: Record<string, unknown>
        }
    }
}

export interface RelayResponse {
    id: number
    status: StatusCode
    statusText: string
    version: Version
    headers: Record<string, string>
    cookies?: Array<{
        name: string
        value: string
        domain?: string
        path?: string
        expires?: Date
        secure?: boolean
        httpOnly?: boolean
        sameSite?: 'Strict' | 'Lax' | 'None'
    }>
    body: RelayResponseBody

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
            version: string
            cipher: string
            certificates?: Array<{
                subject: string
                issuer: string
                validFrom: string
                validTo: string
            }>
        }
        http2?: {
            settings: Record<string, number>
            pushPromise: boolean
        }
        http3?: {
            quicConfig: Record<string, unknown>
        }
        redirects?: Array<{
            url: string
            status: StatusCode
            version: Version
            headers: Record<string, string>
        }>
    }
}

export interface RelayV1 {
    readonly id: string
    readonly capabilities: RelayCapabilities

    canHandle(request: RelayRequest): E.Either<UnsupportedFeatureError, true>

    execute(
        request: RelayRequest
    ): {
        cancel: () => Promise<void>
        emitter: RelayEventEmitter<RelayRequestEvents>
        response: Promise<E.Either<RelayError, RelayResponse>>
    }
}

export const hasCapability = <T>(capabilities: Set<T>, capability: T): boolean =>
    capabilities.has(capability)

export function findSuitableRelay(
    request: RelayRequest,
    relays: RelayV1[]
): E.Either<UnsupportedFeatureError, RelayV1> {
    for (const relay of relays) {
        const result = relay.canHandle(request)
        if (E.isRight(result)) {
            return E.right(relay)
        }
    }

    const errors = relays
        .map(i => i.canHandle(request))
        .filter(E.isLeft)
        .map(e => e.left)

    return E.left(errors[0])
}

export const body = {
    body: (
        body: ArrayBuffer | Uint8Array,
        contentType?: MediaType | string
    ): RelayResponseBody => ({
        body: new Uint8Array(body),
        mediaType: typeof contentType === 'string'
            ? Object.values(MediaType).find(t => contentType.includes(t)) ?? MediaType.APPLICATION_OCTET
            : contentType ?? MediaType.APPLICATION_OCTET
    }),
}

export const content = {
    text: (
        content: string,
        mediaType?: MediaType.TEXT_PLAIN | MediaType.TEXT_HTML | MediaType.TEXT_CSS | MediaType.TEXT_CSV
    ): ContentType => ({
        kind: "text",
        content,
        mediaType: mediaType ?? MediaType.TEXT_PLAIN
    }),

    json: <T>(
        content: T,
        mediaType?: MediaType.APPLICATION_JSON | MediaType.APPLICATION_LD_JSON | MediaType.APPLICATION_JSON
    ): ContentType => ({
        kind: "json",
        content,
        mediaType: mediaType ?? MediaType.APPLICATION_JSON
    }),

    xml: (
        content: string,
        mediaType?: MediaType.APPLICATION_XML | MediaType.TEXT_XML
    ): ContentType => ({
        kind: "xml",
        content,
        mediaType: mediaType ?? MediaType.APPLICATION_XML
    }),

    form: (content: FormData): ContentType => ({
        kind: "form",
        content,
        mediaType: MediaType.APPLICATION_FORM
    }),

    binary: (
        content: Uint8Array,
        mediaType: string = MediaType.APPLICATION_OCTET,
        filename?: string
    ): ContentType => ({
        kind: "binary",
        content,
        mediaType,
        filename
    }),

    multipart: (content: FormData): ContentType => ({
        kind: "multipart",
        content,
        mediaType: MediaType.MULTIPART_FORM
    }),

    urlencoded: (content: string): ContentType => ({
        kind: "urlencoded",
        content,
        mediaType: MediaType.APPLICATION_FORM
    }),

    stream: (content: ReadableStream, mediaType: string): ContentType => ({
        kind: "stream",
        content,
        mediaType
    })
}

export const v1: VersionedAPI<RelayV1> = {
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
            message: "Default relay cannot handle requests",
            relay: "default"
        }),
        execute: () => ({
            cancel: async () => {},
            emitter: {
                on: () => () => {},
                once: () => () => {},
                off: () => {}
            },
            response: Promise.resolve(
                E.left({
                    kind: "version",
                    message: "Not implemented"
                })
            )
        })
    }
}
