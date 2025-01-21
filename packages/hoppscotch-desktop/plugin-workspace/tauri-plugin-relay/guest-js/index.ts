import { invoke } from '@tauri-apps/api/core'

export type Method =
  | "GET"     // Retrieve resource
  | "POST"    // Create resource
  | "PUT"     // Replace resource
  | "DELETE"  // Remove resource
  | "PATCH"   // Modify resource
  | "HEAD"    // GET without body
  | "OPTIONS" // Get allowed methods
  | "CONNECT" // Create tunnel
  | "TRACE"   // Loop-back test

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
    | { kind: "urlencoded"; content: Record<string, string>; mediaType: MediaType.APPLICATION_FORM }
    | { kind: "stream"; content: ReadableStream; mediaType: string }

export interface ResponseBody {
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
  }
}

export interface Response {
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
  body: ResponseBody

  meta: {
    timing: {
      start: number
      end: number
    }
    size: {
      headers: number
      body: number
      total: number
    }
  }
}

export type UnsupportedFeatureError = {
  kind: "unsupported_feature"
  feature: string
  message: string
  relay: string
}

export type RelayError =
  | UnsupportedFeatureError
  | { kind: "network"; message: string; cause?: unknown }
  | { kind: "timeout"; message: string; phase?: "connect" | "tls" | "response" }
  | { kind: "certificate"; message: string; cause?: unknown }
  | { kind: "parse"; message: string; cause?: unknown }
  | { kind: "abort"; message: string }

export type RequestResult =
  | { kind: 'success'; response: Response }
  | { kind: 'error'; error: RelayError }

export async function execute(request: Request): Promise<RequestResult> {
  return await invoke<RequestResult>('plugin:relay|execute', { request })
}

export async function cancel(requestId: number): Promise<void> {
  return await invoke<void>('plugin:relay|cancel', { requestId })
}
