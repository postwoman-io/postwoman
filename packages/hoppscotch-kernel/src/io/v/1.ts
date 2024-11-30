import type { VersionedAPI } from '@type/versioning'

export type SaveFileWithDialogOptions = {
  data: string | Uint8Array
  suggestedFilename: string
  contentType: string
  filters?: Array<{
    name: string
    extensions: string[]
  }>
}

export type OpenExternalLinkOptions = {
  url: string
}

export type SaveFileResponse =
  | { type: "unknown" }
  | { type: "cancelled" }
  | { type: "saved"; path: string }

export type OpenExternalLinkResponse =
  | { type: "unknown" }
  | { type: "cancelled" }
  | { type: "opened" }

export interface IoV1 {
  saveFileWithDialog: (
    opts: SaveFileWithDialogOptions
  ) => Promise<SaveFileResponse>
  openExternalLink: (
    opts: OpenExternalLinkOptions
  ) => Promise<OpenExternalLinkResponse>
}

export const v1: VersionedAPI<IoV1> = {
  version: { major: 1, minor: 0, patch: 0 },
  api: {
    saveFileWithDialog: async () => ({ type: "unknown" }),
    openExternalLink: async () => ({ type: "unknown" })
  }
}
