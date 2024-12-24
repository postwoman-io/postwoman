import { AuthType, ContentType, Method, Request, Response } from "@hoppscotch/kernel"
import { HoppRESTResponse, HoppRESTResponseHeader } from "./types/HoppRESTResponse"
import { EffectiveHoppRESTRequest } from "./utils/EffectiveURL"
import { HoppRESTRequest } from "@hoppscotch/data"

const logger = {
    debug: (...args: any[]) => console.debug('[Hopp Debug]:', ...args),
    info: (...args: any[]) => console.info('[Hopp Info]:', ...args),
    warn: (...args: any[]) => console.warn('[Hopp Warn]:', ...args),
    error: (...args: any[]) => console.error('[Hopp Error]:', ...args)
}

const DIGEST_ALGORITHMS = ["MD5", "SHA-256", "SHA-512"] as const
type DigestAlgorithm = typeof DIGEST_ALGORITHMS[number]

const CONTENT_TYPE_MAPPING = {
    "application/json": "json",
    "application/ld+json": "json",
    "application/xml": "xml",
    "text/xml": "xml",
    "text/plain": "text",
    "text/html": "text",
    "multipart/form-data": "multipart",
    "application/x-www-form-urlencoded": "urlencoded",
    "application/octet-stream": "binary"
} as const

type ContentTypeMapping = typeof CONTENT_TYPE_MAPPING
type ValidContentType = keyof ContentTypeMapping

type HoppRESTFormDataEntry = {
    key: string
    active: boolean
    contentType?: string
} & (
        | { isFile: true; value: Blob[] | null }
        | { isFile: false; value: string }
    )

type HoppBodyType = EffectiveHoppRESTRequest["body"]
type HoppContentType = NonNullable<HoppBodyType["contentType"]>
type HoppAuth = EffectiveHoppRESTRequest["auth"]
type HoppAuthType = HoppAuth["authType"]

type RequestBodyTypeGuard<T extends HoppContentType> =
    T extends keyof ContentTypeMapping
    ? ContentType & { kind: ContentTypeMapping[T] }
    : never

const getOAuth2Base = (auth: HoppAuth) => {
    logger.debug('Getting OAuth2 base configuration', { authType: auth.authType })

    if (auth.authType !== "oauth-2") {
        logger.error('Invalid auth type for OAuth2', { authType: auth.authType })
        throw new Error("Not OAuth2 auth")
    }

    const base = {
        kind: "oauth2" as const,
        accessToken: auth.grantTypeInfo.token
    }

    logger.debug('OAuth2 base configuration created', { base })

    if (auth.grantTypeInfo.grantType === "IMPLICIT") {
        logger.info('Using implicit grant type')
        return base
    }

    if ("refreshToken" in auth.grantTypeInfo) {
        const { refreshToken } = auth.grantTypeInfo
        if (refreshToken && typeof refreshToken !== "string") {
            logger.error('Invalid refresh token format', { refreshToken })
            throw new Error("Invalid refresh token format")
        }
        if (refreshToken) {
            logger.info('Adding refresh token to OAuth2 config')
            return {
                ...base,
                refreshToken
            }
        }
    }

    return base
}

const isKnownContentType = (type: string): type is ValidContentType => {
    const isKnown = type in CONTENT_TYPE_MAPPING
    logger.debug('Content type validation', { type, isKnown })
    return isKnown
}

const convertArrayToRecord = <T extends { key: string; value: string; active: boolean }>(
    items: ReadonlyArray<T>
): Record<string, string[]> => {
    logger.debug('Converting array to record', { itemCount: items.length })

    const result = items
        .filter((item): item is T & { active: true } => item.active)
        .reduce<Record<string, string[]>>((acc, { key, value }) => ({
            ...acc,
            [key]: [...(acc[key] ?? []), value]
        }), {})

    logger.debug('Array converted to record', { result })
    return result
}

const convertFormData = (entries: ReadonlyArray<HoppRESTFormDataEntry>): FormData => {
    logger.debug('Converting form data', { entryCount: entries.length })

    const formData = new FormData()

    entries
        .filter((entry): entry is HoppRESTFormDataEntry & { active: true } => entry.active)
        .forEach(({ key, value, isFile, contentType }) => {
            if (!value) {
                logger.warn('Skipping empty form data entry', { key })
                return
            }

            if (isFile && Array.isArray(value)) {
                logger.debug('Processing file entry', { key, contentType })
                value.forEach(blob => {
                    if (blob instanceof Blob) {
                        if (contentType) {
                            const typedBlob = new Blob([blob], { type: contentType })
                            formData.append(key, typedBlob)
                        } else {
                            formData.append(key, blob)
                        }
                    }
                })
            } else if (!isFile) {
                logger.debug('Processing text entry', { key })
                formData.append(key, value)
            }
        })

    return formData
}

async function convertJsonBody(body: string): Promise<RequestBodyTypeGuard<"application/json">> {
    logger.debug('Converting JSON body', { bodyLength: body.length })
    try {
        const parsed = JSON.parse(body)
        logger.debug('JSON body parsed successfully')
        return {
            kind: "json",
            content: parsed,
            mediaType: "application/json"
        }
    } catch (error) {
        logger.error('JSON parsing failed', { error })
        throw error
    }
}

async function convertBinaryBody(file: File | null): Promise<RequestBodyTypeGuard<"application/octet-stream">> {
    logger.debug('Converting binary body', { fileName: file?.name })

    if (!file) {
        logger.error('Binary body requires a file')
        throw new Error("Binary body requires a file")
    }

    const buffer = await file.arrayBuffer()
    logger.debug('Binary body converted successfully', { bufferSize: buffer.byteLength })
    return {
        kind: "binary",
        content: new Uint8Array(buffer),
        mediaType: "application/octet-stream",
        filename: file.name
    }
}

const convertContent = async (
    body: HoppBodyType,
    effectiveBody: FormData | string | null | File,
    method: string
): Promise<ContentType | null> => {
    logger.info('Converting content', {
        contentType: body.contentType,
        method,
        effectiveBodyType: effectiveBody?.constructor.name
    })

    if (body.contentType === null) {
        if (["GET", "HEAD", "OPTIONS", "TRACE"].includes(method.toUpperCase())) {
            logger.debug('Null content type allowed for this method')
            return null
        }
        if (effectiveBody === null) {
            logger.debug('Null content type with null body')
            return null
        }
        logger.error('Content type required when body is present')
        throw new Error("Content type required when body is present")
    }

    if (!isKnownContentType(body.contentType)) {
        logger.error('Unknown content type', { contentType: body.contentType })
        throw new Error(`Unknown content type: ${body.contentType}`)
    }

    const contentType = body.contentType

    try {
        switch (contentType) {
            case "application/json":
            case "application/ld+json":
                logger.debug('Processing JSON content')
                if (effectiveBody === null) return null
                if (typeof effectiveBody !== "string") {
                    logger.error('Invalid JSON body type')
                    throw new Error("JSON body must be a string")
                }
                return convertJsonBody(effectiveBody)

            case "application/xml":
            case "text/xml":
                logger.debug('Processing XML content')
                if (effectiveBody === null) return null
                if (typeof effectiveBody !== "string") {
                    logger.error('Invalid XML body type')
                    throw new Error("XML body must be a string")
                }
                return {
                    kind: "xml",
                    content: effectiveBody,
                    mediaType: contentType
                }

            case "text/plain":
            case "text/html":
                logger.debug('Processing text content')
                if (effectiveBody === null) return null
                if (typeof effectiveBody !== "string") {
                    logger.error('Invalid text body type')
                    throw new Error("Text body must be a string")
                }
                return {
                    kind: "text",
                    content: effectiveBody,
                    mediaType: contentType
                }

            case "multipart/form-data": {
                logger.debug('Processing multipart form data')
                if (!(body.body instanceof Array)) {
                    if (body.body === null && ["GET", "HEAD"].includes(method.toUpperCase())) {
                        return null
                    }
                    logger.error('Invalid form data body type')
                    throw new Error("Form data body must be an array")
                }
                const formData = convertFormData(body.body as HoppRESTFormDataEntry[])
                return {
                    kind: "multipart",
                    content: formData,
                    mediaType: "multipart/form-data"
                }
            }

            case "application/x-www-form-urlencoded": {
                logger.debug('Processing URL encoded content')
                if (effectiveBody === null) return null
                if (typeof effectiveBody !== "string") {
                    logger.error('Invalid URL encoded body type')
                    throw new Error("URL encoded body must be a string")
                }
                const params = new URLSearchParams(effectiveBody)
                return {
                    kind: "urlencoded",
                    content: Object.fromEntries(params),
                    mediaType: "application/x-www-form-urlencoded"
                }
            }

            case "application/octet-stream": {
                // NOTE: This might fix edge cases where sending empty binary body
                // would pass on request that should have failed.
                logger.debug('Processing binary content')
                if (effectiveBody === null && ["POST", "PUT", "PATCH"].includes(method.toUpperCase())) {
                    logger.debug('Creating empty binary content for POST/PUT/PATCH')
                    return {
                        kind: "binary",
                        content: new Uint8Array(),
                        mediaType: "application/octet-stream",
                        filename: ""
                    }
                }

                if (!(effectiveBody instanceof File)) {
                    logger.error('Invalid binary body type')
                    throw new Error("Binary body must be a File")
                }
                return convertBinaryBody(effectiveBody)
            }

            default:
                logger.error('Unknown content type encountered', { contentType })
                throw Error(`Unknown content type: ${contentType}`)
        }
    } catch (error) {
        logger.error('Content conversion failed', { error })
        if (error instanceof Error) {
            throw new Error(`Content conversion failed: ${error.message}`)
        }
        throw error
    }
}

const convertAuth = (auth: EffectiveHoppRESTRequest["auth"]): AuthType => {
    logger.info('Converting authentication', {
        authType: auth.authType,
        authActive: auth.authActive
    })

    if (!auth.authActive) {
        logger.debug('Auth not active, returning none')
        return { kind: "none" }
    }

    try {
        switch (auth.authType) {
            case "none":
                logger.debug('No auth type specified')
                return { kind: "none" }

            case "basic":
                logger.debug('Processing basic auth')
                return {
                    kind: "basic",
                    username: auth.username,
                    password: auth.password
                }

            case "bearer":
                logger.debug('Processing bearer auth')
                return {
                    kind: "bearer",
                    token: auth.token
                }

            case "digest": {
                logger.debug('Processing digest auth')
                const { username, password, realm, nonce, qop, nc, cnonce, opaque, algorithm } = auth
                const digestAlgorithm = (algorithm === "MD5" ? "MD5" : "SHA-256") satisfies DigestAlgorithm
                return {
                    kind: "digest",
                    username,
                    password,
                    realm,
                    nonce,
                    qop,
                    nc,
                    cnonce,
                    opaque,
                    algorithm: digestAlgorithm
                }
            }

            case "api-key":
                logger.debug('Processing API key auth')
                return {
                    kind: "apikey",
                    key: auth.key,
                    value: auth.value,
                    in: auth.addTo === "HEADERS" ? "header" : "query"
                }

            case "oauth-2": {
                logger.debug('Processing OAuth2 auth', { grantType: auth.grantTypeInfo.grantType })
                const baseOAuth2 = getOAuth2Base(auth)

                switch (auth.grantTypeInfo.grantType) {
                    case "AUTHORIZATION_CODE":
                        return {
                            ...baseOAuth2,
                            grantType: {
                                kind: "authorization_code",
                                authEndpoint: auth.grantTypeInfo.authEndpoint,
                                tokenEndpoint: auth.grantTypeInfo.tokenEndpoint,
                                clientId: auth.grantTypeInfo.clientID,
                                clientSecret: auth.grantTypeInfo.clientSecret
                            }
                        }

                    case "CLIENT_CREDENTIALS":
                        return {
                            ...baseOAuth2,
                            grantType: {
                                kind: "client_credentials",
                                tokenEndpoint: auth.grantTypeInfo.authEndpoint,
                                clientId: auth.grantTypeInfo.clientID,
                                clientSecret: auth.grantTypeInfo.clientSecret
                            }
                        }

                    case "PASSWORD":
                        return {
                            ...baseOAuth2,
                            grantType: {
                                kind: "password",
                                tokenEndpoint: auth.grantTypeInfo.authEndpoint,
                                username: auth.grantTypeInfo.username,
                                password: auth.grantTypeInfo.password
                            }
                        }

                    case "IMPLICIT":
                        return {
                            ...baseOAuth2,
                            grantType: {
                                kind: "implicit",
                                authEndpoint: auth.grantTypeInfo.authEndpoint,
                                clientId: auth.grantTypeInfo.clientID
                            }
                        }
                }
            }

            case "aws-signature":
                logger.error('AWS signature auth not supported')
                throw new Error(`Auth type ${auth.authType} not supported`)

            case "inherit":
                logger.error('Inherit auth not supported')
                throw new Error(`Auth type ${auth.authType} not supported`)

            default:
                logger.error('Unknown auth type')
                throw new Error(`Auth type not supported`)
        }
    } catch (error) {
        logger.error('Auth conversion failed', { error })
        throw error
    }
}

export const convertEffectiveHoppRESTRequestToRequest = async (
    hopp: Readonly<EffectiveHoppRESTRequest>
): Promise<Request> => {
    logger.info('Converting REST request', {
        method: hopp.method,
        url: hopp.effectiveFinalURL
    })

    try {
        const method = hopp.method.toUpperCase()

        const [headers, params, content] = await Promise.all([
            Promise.resolve(convertArrayToRecord(hopp.effectiveFinalHeaders)),
            Promise.resolve(convertArrayToRecord(hopp.effectiveFinalParams)),
            convertContent(hopp.body, hopp.effectiveFinalBody, method)
        ])

        if (content && ["GET", "HEAD", "OPTIONS", "TRACE"].includes(method)) {
            logger.error('Invalid request: body not allowed for this method', { method })
            throw new Error(`${method} requests cannot have a body`)
        }

        const auth = convertAuth(hopp.auth)

        const request = {
            id: Date.now(),
            url: hopp.effectiveFinalURL,
            method,
            protocol: "http/1.1",
            ...(Object.keys(headers).length > 0 && { headers }),
            ...(Object.keys(params).length > 0 && { params }),
            ...(content && { content }),
            ...(auth && { auth })
        }

        logger.info('Request conversion completed', {
            id: request.id,
            method: request.method,
            url: request.url
        })

        return request
    } catch (error) {
        logger.error('Request conversion failed', { error })
        throw error
    }
}

type ResponseMetadata = {
    responseSize: number
    responseDuration: number
}

type ResponseData = {
    headers: HoppRESTResponseHeader[]
    body: ArrayBuffer
    statusCode: number
    statusText: string
    meta: ResponseMetadata
    req: HoppRESTRequest
}

export const convertResponseToHoppRESTResponse = (
    response: Response | null | undefined,
    originalRequest: HoppRESTRequest,
    meta: ResponseMetadata
): HoppRESTResponse => {
    logger.info('Converting response', response)

    if (!response) {
        logger.error('No response received')
        return {
            type: "network_fail",
            error: new Error("No response received"),
            req: originalRequest
        }
    }

    try {
        const headers = Object.entries(response.headers ?? {})
            .flatMap(([key, valuesUnknown]) => {
                if (!valuesUnknown) return []
                const values = Array.isArray(valuesUnknown) ? valuesUnknown.map(String) : [String(valuesUnknown)]
                return values.map((value): HoppRESTResponseHeader => ({
                    key: String(key),
                    value: value.trim()
                }))
            })

        logger.debug('Processed response headers', { headerCount: headers.length })

        const body = (() => {
            if (!response.content) {
                logger.debug('No response content')
                return new ArrayBuffer(0)
            }

            logger.debug('Processing response content', {
                contentKind: response.content.kind
            })

            switch (response.content.kind) {
                case "binary":
                    return response.content.content.buffer

                case "json":
                    return new TextEncoder().encode(
                        JSON.stringify(response.content.content, null, 2)
                    ).buffer

                case "stream":
                    logger.error('Stream responses not supported')
                    throw new Error("Stream responses not supported")

                case "form":
                case "multipart":
                case "urlencoded":
                    return new TextEncoder().encode(
                        JSON.stringify(Object.fromEntries(response.content.content), null, 2)
                    ).buffer

                default:
                    return new TextEncoder().encode(
                        String(response.content.content)
                    ).buffer
            }
        })()

        const responseData: ResponseData = {
            headers,
            body,
            statusCode: response.status,
            statusText: response.statusText || '',
            meta,
            req: originalRequest
        }

        logger.info('Response conversion completed', {
            statusCode: responseData.statusCode,
            bodySize: body.byteLength
        })

        if (response.status >= 200 && response.status < 300) {
            return {
                type: "success",
                ...responseData
            }
        }

        if (response.status >= 400) {
            return {
                type: "fail",
                ...responseData
            }
        }

        return {
            type: "fail",
            ...responseData
        }

    } catch (error) {
        logger.error('Response conversion failed', { error })

        if (error instanceof Error && error.message.includes("Stream")) {
            return {
                type: "network_fail",
                error: new Error("Stream responses are not supported"),
                req: originalRequest
            }
        }

        if (error instanceof Error) {
            return {
                type: "network_fail",
                error,
                req: originalRequest
            }
        }

        return {
            type: "network_fail",
            error: new Error("Unknown error during response conversion"),
            req: originalRequest
        }
    }
}
