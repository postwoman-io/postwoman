import {
  SaveFileWithDialogOptions,
  OpenExternalLinkOptions,
} from "@hoppscotch/kernel"

export const Io = {
  saveFileWithDialog: async (opts: SaveFileWithDialogOptions) => {
    if (!window.__KERNEL__) {
      throw new Error("Kernel is not initialized")
    }
    if (!window.__KERNEL__?.io) {
      throw new Error("Kernel io is not initialized")
    }
    await window.__KERNEL__.io.saveFileWithDialog(opts)
  },

  openExternalLink: async (opts: OpenExternalLinkOptions) => {
    if (!window.__KERNEL__) {
      throw new Error("Kernel is not initialized")
    }
    if (!window.__KERNEL__?.io) {
      throw new Error("Kernel io is not initialized")
    }
    await window.__KERNEL__.io.openExternalLink(opts)
  },
}
