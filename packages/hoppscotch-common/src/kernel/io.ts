import type {
  SaveFileWithDialogOptions,
  OpenExternalLinkOptions,
  SaveFileResponse,
  OpenExternalLinkResponse,
  EventCallback,
  UnlistenFn,
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

    listen: <T>(
      event: string,
      handler: EventCallback<T>
    ): Promise<UnlistenFn> => module().listen(event, handler),

    once: <T>(event: string, handler: EventCallback<T>): Promise<UnlistenFn> =>
      module().once(event, handler),

    emit: (event: string, payload?: unknown): Promise<void> =>
      module().emit(event, payload),
  } as const
})()
