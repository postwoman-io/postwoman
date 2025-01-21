import { VersionedAPI } from '@type/versioning'
import { IoV1, SaveFileWithDialogOptions, OpenExternalLinkOptions } from '@io/v/1'

import { save } from "@tauri-apps/plugin-dialog"
import { writeFile, writeTextFile } from "@tauri-apps/plugin-fs"
import { open } from "@tauri-apps/plugin-shell"
import { listen as tauriListen, emit as tauriEmit, Event } from '@tauri-apps/api/event'

export const implementation: VersionedAPI<IoV1> = {
  version: { major: 1, minor: 0, patch: 0 },
  api: {
    async saveFileWithDialog(opts: SaveFileWithDialogOptions) {
      const path = await save({
        filters: opts.filters,
        defaultPath: opts.suggestedFilename,
      })

      if (!path) {
        return { type: "cancelled" as const }
      }

      if (typeof opts.data === "string") {
        await writeTextFile(path, opts.data)
      } else {
        await writeFile(path, opts.data)
      }

      return { type: "saved" as const, path }
    },

    async openExternalLink(opts: OpenExternalLinkOptions) {
      await open(opts.url)
      return { type: "opened" as const }
    },

    async listen<T>(event: string, handler: (event: Event<T>) => void) {
      return await tauriListen<T>(event, handler)
    },

    async once<T>(event: string, handler: (event: Event<T>) => void) {
      const unlistenFn = await tauriListen<T>(event, (e) => {
        unlistenFn()
        handler(e)
      })
      return unlistenFn
    },

    async emit(event: string, payload?: unknown) {
      await tauriEmit(event, payload)
    }
  }
}
