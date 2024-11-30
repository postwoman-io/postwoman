import { VersionedAPI } from '@type/versioning'
import { IoV1, SaveFileWithDialogOptions, OpenExternalLinkOptions } from '@io/v/1'

import { save } from "@tauri-apps/plugin-dialog"
import { writeFile, writeTextFile } from "@tauri-apps/plugin-fs"
import { open } from "@tauri-apps/plugin-shell"

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
        }
    }
}
