import type { VersionedAPI } from '@type/versioning'

export interface Event<T> {
  event: string
  id: number
  payload: T
}

export type EventCallback<T> = (event: Event<T>) => void | Promise<void>
export type UnlistenFn = () => void | Promise<void>

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

  listen: <T>(
    event: string,
    handler: EventCallback<T>
  ) => Promise<UnlistenFn>

  once: <T>(
    event: string,
    handler: EventCallback<T>
  ) => Promise<UnlistenFn>

  emit: (
    event: string,
    payload?: unknown
  ) => Promise<void>
}

export const v1: VersionedAPI<IoV1> = {
  version: { major: 1, minor: 0, patch: 0 },
  api: {
    saveFileWithDialog: async () => ({ type: "unknown" }),
    openExternalLink: async () => ({ type: "unknown" }),
    listen: async () => () => {},
    once: async () => () => {},
    emit: async () => {},
  }
}
