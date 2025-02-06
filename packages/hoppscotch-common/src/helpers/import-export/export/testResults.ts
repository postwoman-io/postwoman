import { HoppTestResult } from "~/helpers/types/HoppTestResult"
import { platform } from "~/platform"
import * as E from "fp-ts/Either"

export const exportTestResults = async (testResults: HoppTestResult) => {
  const contentsJSON = JSON.stringify(testResults, null, 2)
  const file = new Blob([contentsJSON], { type: "application/json" })
  const url = URL.createObjectURL(file)

  const fileName = url.split("/").pop()!.split("#")[0].split("?")[0]

  const result = await platform.kernelIO.saveFileWithDialog({
    data: contentsJSON,
    contentType: "application/json",
    suggestedFilename: `${fileName}.json`,
    filters: [
      {
        name: "Hoppscotch Test Results JSON file",
        extensions: ["json"],
      },
    ],
  })

  if (result.type === "unknown" || result.type === "saved") {
    return E.right("state.download_started")
  }

  return E.left("state.download_failed")
}
