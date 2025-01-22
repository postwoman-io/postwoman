import UrlImport from "~/components/importExport/ImportExportSteps/UrlImport.vue"
import { defineStep } from "~/composables/step-components"

import { v4 as uuidv4 } from "uuid"
import { Ref } from "vue"

export function UrlSource(metadata: {
  caption: string
  onImportFromURL: (content: string) => any | Promise<any>
  fetchLogic?: (url: string) => Promise<any>
  isLoading?: Ref<boolean>
  description: string
}) {
  const stepID = uuidv4()

  return defineStep(stepID, UrlImport, () => ({
    caption: metadata.caption,
    onImportFromURL: (content: unknown) => {
      if (typeof content === "string") {
        metadata.onImportFromURL(content)
      }
    },
    loading: metadata.isLoading?.value,
    description: metadata.description,
  }))
}
