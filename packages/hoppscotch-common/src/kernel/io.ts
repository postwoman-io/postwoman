import {
  IoV1,
  SaveFileWithDialogOptions,
  OpenExternalLinkOptions,
} from "@hoppscotch/kernel"

export const Io: IoV1 = {
  saveFileWithDialog: async (opts: SaveFileWithDialogOptions) => {
    await window.__KERNEL__?.io.saveFileWithDialog(opts)
  },

  openExternalLink: async (opts: OpenExternalLinkOptions) => {
    await window.__KERNEL__?.io.openExternalLink(opts)
  },
}
