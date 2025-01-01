import type {
  SaveFileWithDialogOptions,
  OpenExternalLinkOptions,
  SaveFileResponse,
  OpenExternalLinkResponse,
} from "@hoppscotch/kernel"
import { getModule } from "."

export const Io = (() => {
  const module = () => getModule("io")

  return {
    saveFileWithDialog: (
      opts: SaveFileWithDialogOptions
    ): Promise<SaveFileResponse> => module().saveFileWithDialog(opts),
    openExternalLink: (
      opts: OpenExternalLinkOptions
    ): Promise<OpenExternalLinkResponse> => module().openExternalLink(opts),
  } as const
})()
