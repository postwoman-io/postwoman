import { createHmac, randomBytes } from "crypto"

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

export async function calculateHawkHeader(
  options: HawkOptions
): Promise<string> {
  const timestamp =
    options.timestamp || Math.floor(Date.now() / 1000).toString()
  const nonce = options.nonce || randomBytes(6).toString("base64")

  const url = new URL(options.url)
  const port = url.port || (url.protocol === "https:" ? "443" : "80")

  let payloadHash = ""
  if (options.includePayloadHash && options.payload) {
    const content =
      options.payload instanceof FormData || options.payload instanceof File
        ? await options.payload.text()
        : options.payload.toString()

    const hash = createHmac(options.algorithm, options.key)
      .update(content)
      .digest("base64")

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

  const mac = createHmac(options.algorithm, options.key)
    .update(normalized)
    .digest("base64")

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
