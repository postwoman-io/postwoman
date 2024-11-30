import { VersionedAPI } from '@type/versioning'
import { IoV1, SaveFileWithDialogOptions, OpenExternalLinkOptions } from '@io/v/1'

import { pipe } from 'fp-ts/function'
import * as S from 'fp-ts/string'
import * as RNEA from 'fp-ts/ReadonlyNonEmptyArray'

export const implementation: VersionedAPI<IoV1> = {
    version: { major: 1, minor: 0, patch: 0 },
    api: {
        async saveFileWithDialog(opts: SaveFileWithDialogOptions) {
            const file = new Blob([opts.data], { type: opts.contentType })
            const a = document.createElement("a")
            const url = URL.createObjectURL(file)

            a.href = url
            a.download = opts.suggestedFilename ?? pipe(
                url,
                S.split("/"),
                RNEA.last,
                S.split("#"),
                RNEA.head,
                S.split("?"),
                RNEA.head
            )

            document.body.appendChild(a)
            a.click()

            setTimeout(() => {
                document.body.removeChild(a)
                URL.revokeObjectURL(url)
            }, 1000)

            // Browsers provide no way to know if save was successful
            return { type: "unknown" as const }
        },

        async openExternalLink(opts: OpenExternalLinkOptions) {
            window.open(opts.url, "_blank")
            // Browsers provide no way to know if open was successful
            return { type: "unknown" as const }
        }
    }
}
