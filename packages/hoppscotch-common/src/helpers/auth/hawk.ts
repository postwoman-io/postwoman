interface HawkOptions {
  id: string
  key: string
  algorithm: "sha256" | "sha1"
  method: string
  url: string
  includePayloadHash: boolean
  payload?: string | FormData | File | null

  // Optional parameters
  user?: string
  nonce?: string
  ext?: string
  app?: string
  dlg?: string
  timestamp?: string
}

async function generateNonce(length: number = 6): Promise<string> {
  const array = new Uint8Array(length)
  crypto.getRandomValues(array)
  return btoa(String.fromCharCode(...array))
}

async function hmacSign(
  key: string,
  message: string,
  algorithm: "sha256" | "sha1"
): Promise<string> {
  const encoder = new TextEncoder()
  const keyData = encoder.encode(key)
  const messageData = encoder.encode(message)

  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyData,
    {
      name: "HMAC",
      hash: { name: `SHA-${algorithm === "sha256" ? "256" : "1"}` },
    },
    false,
    ["sign"]
  )

  const signature = await crypto.subtle.sign("HMAC", cryptoKey, messageData)

  return btoa(String.fromCharCode(...new Uint8Array(signature)))
}

async function getPayloadContent(
  payload: string | FormData | File | null
): Promise<string> {
  if (!payload) return ""

  if (payload instanceof FormData) {
    const pairs: string[] = []
    payload.forEach((value, key) => {
      pairs.push(`${key}=${value}`)
    })
    return pairs.join("&")
  }

  if (payload instanceof File) {
    return await payload.text()
  }

  return payload.toString()
}

export async function calculateHawkHeader(
  options: HawkOptions
): Promise<string> {
  const timestamp =
    options.timestamp || Math.floor(Date.now() / 1000).toString()
  const nonce = options.nonce || (await generateNonce())

  const url = new URL(options.url)
  const port = url.port || (url.protocol === "https:" ? "443" : "80")

  let payloadHash = ""
  if (options.includePayloadHash && options.payload) {
    const content = await getPayloadContent(options.payload)
    const hash = await hmacSign(options.key, content, options.algorithm)
    payloadHash = `hash="${hash}"`
  }

  const normalized = [
    timestamp,
    nonce,
    options.method.toUpperCase(),
    url.pathname + url.search,
    url.host,
    port,
    payloadHash,
    options.ext || "",
    options.app || "",
    options.dlg || "",
  ].join("\n")

  const mac = await hmacSign(options.key, normalized, options.algorithm)

  const header = [
    `Hawk id="${options.id}"`,
    `ts="${timestamp}"`,
    `nonce="${nonce}"`,
    `mac="${mac}"`,
  ]

  if (options.ext) header.push(`ext="${options.ext}"`)
  if (options.app) header.push(`app="${options.app}"`)
  if (options.dlg) header.push(`dlg="${options.dlg}"`)
  if (payloadHash) header.push(payloadHash)

  return header.join(", ")
}
