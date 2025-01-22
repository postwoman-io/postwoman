import FileImportVue from "~/components/importExport/ImportExportSteps/FileImport.vue"
import { defineStep } from "~/composables/step-components"

import { v4 as uuidv4 } from "uuid"
import { Ref } from "vue"

export function FileSource(metadata: {
  acceptedFileTypes: string
  caption: string
  onImportFromFile: (content: string[]) => any | Promise<any>
  isLoading?: Ref<boolean>
  description?: string
}) {
  const stepID = uuidv4()

  return defineStep(stepID, FileImportVue, () => ({
    acceptedFileTypes: metadata.acceptedFileTypes,
    caption: metadata.caption,
    onImportFromFile: metadata.onImportFromFile,
    loading: metadata.isLoading?.value,
    description: metadata.description,
  }))
}
