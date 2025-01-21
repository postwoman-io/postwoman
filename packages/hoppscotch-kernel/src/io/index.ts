import { v1 } from './v/1'

export type {
  IoV1,
  SaveFileWithDialogOptions,
  SaveFileResponse,
  OpenExternalLinkOptions,
  OpenExternalLinkResponse,
  Event,
  EventCallback,
  UnlistenFn
} from './v/1'

export const VERSIONS = {
  v1,
} as const

export const latest = v1
