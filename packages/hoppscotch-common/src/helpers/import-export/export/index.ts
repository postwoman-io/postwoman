import * as E from "fp-ts/Either"
import { platform } from "~/platform"

/**
 * Create a downloadable file from a collection/environment and prompts the user to download it.
 * @param contentsJSON - JSON string of the collection
 * @param name - Name of the collection set as the file name
 * @returns {Promise<E.Right<string> | E.Left<string>>} - Returns a promise that resolves to an `Either` with `i18n` key for the status message
 */
export const initializeDownloadFile = async (
  contentsJSON: string,
  name: string | null
) => {
  const file = new Blob([contentsJSON], { type: "application/json" })
  const url = URL.createObjectURL(file)

  const fileName = name ?? url.split("/").pop()!.split("#")[0].split("?")[0]

  const result = await platform.kernelIO.saveFileWithDialog({
    data: contentsJSON,
    contentType: "application/json",
    suggestedFilename: `${fileName}.json`,
    filters: [
      {
        name: "Hoppscotch Collection/Environment JSON file",
        extensions: ["json"],
      },
    ],
  })

  if (result.type === "unknown" || result.type === "saved") {
    return E.right("state.download_started")
  }

  return E.left("state.download_failed")
}
