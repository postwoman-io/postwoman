import { HoppRESTResponse } from "../types/HoppRESTResponse"
import jsonLens from "./jsonLens"
import rawLens from "./rawLens"
import imageLens from "./imageLens"
import htmlLens from "./htmlLens"
import xmlLens from "./xmlLens"
import pdfLens from "./pdfLens"
import audioLens from "./audioLens"
import videoLens from "./videoLens"
import { defineAsyncComponent } from "vue"

export type Lens = {
  lensName: string
  isSupportedContentType: (contentType: string) => boolean
  renderer: string
  rendererImport: ReturnType<typeof defineAsyncComponent>
}

export const lenses: Lens[] = [
  jsonLens,
  imageLens,
  htmlLens,
  xmlLens,
  pdfLens,
  audioLens,
  videoLens,
  rawLens,
]

export function getSuitableLenses(response: HoppRESTResponse): Lens[] {
  // return empty array if response is loading or error
  if (
    response.type === "loading" ||
    response.type === "network_fail" ||
    response.type === "script_fail" ||
    response.type === "fail" ||
    response.type === "extension_error"
  )
    return []

  // Lowercase the content-type key because HTTP Headers are case-insensitive by spec
  const contentType = response.headers.find(
    (h) => h.key.toLowerCase() === "content-type"
  )

  if (!contentType) return [rawLens]

  const result = []
  for (const lens of lenses) {
    if (lens.isSupportedContentType(contentType.value)) result.push(lens)
  }
  return result
}

type LensRenderers = {
  [key: string]: Lens["rendererImport"]
}

export function getLensRenderers(): LensRenderers {
  const response: LensRenderers = {}
  for (const lens of lenses) {
    response[lens.renderer] = lens.rendererImport
  }
  return response
}
