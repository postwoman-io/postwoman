<template>
  <div class="space-y-4">
    <div>
      <p class="flex items-center">
        <span
          class="inline-flex items-center justify-center flex-shrink-0 mr-4 border-4 rounded-full border-primary text-dividerDark"
          :class="{
            '!text-green-500': hasFile,
          }"
        >
          <icon-lucide-check-circle class="svg-icons" />
        </span>
        <span>
          {{ t(`${caption}`) }}
        </span>
      </p>

      <p v-if="description" class="ml-10 mt-2 text-secondaryLight">
        {{ t(description) }}
      </p>
    </div>

    <div class="flex flex-col border border-dashed rounded border-dividerDark">
      <input
        id="inputChooseFileToImportFrom"
        ref="inputChooseFileToImportFrom"
        name="inputChooseFileToImportFrom"
        type="file"
        class="p-4 cursor-pointer transition file:transition file:cursor-pointer text-secondary hover:text-secondaryDark file:mr-2 file:py-2 file:px-4 file:rounded file:border-0 file:text-secondary hover:file:text-secondaryDark file:bg-primaryLight hover:file:bg-primaryDark"
        :accept="acceptedFileTypes"
        multiple
        @change="onFileChange"
      />
    </div>

    <p v-if="showFileSizeLimitExceededWarning" class="text-red-500 ml-10">
      <template v-if="importFilesCount">
        {{
          t("import.file_size_limit_exceeded_warning_multiple_files", {
            sizeLimit: ALLOWED_FILE_SIZE_LIMIT,
            files:
              importFilesCount === 1 ? "file" : `${importFilesCount} files`,
          })
        }}
      </template>

      <template v-else>
        {{
          t("import.file_size_limit_exceeded_warning_single_file", {
            sizeLimit: ALLOWED_FILE_SIZE_LIMIT,
          })
        }}
      </template>
    </p>
    <div>
      <HoppButtonPrimary
        :disabled="disableImportCTA"
        :label="t('import.title')"
        :loading="loading"
        class="w-full"
        @click="emit('importFromFile', fileContent)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from "@composables/i18n"
import { useToast } from "@composables/toast"
import { computed, ref } from "vue"
import { platform } from "~/platform"

const props = withDefaults(
  defineProps<{
    caption: string
    acceptedFileTypes: string
    loading?: boolean
    description?: string
  }>(),
  {
    loading: false,
    description: undefined,
  }
)

const t = useI18n()
const toast = useToast()

const ALLOWED_FILE_SIZE_LIMIT = platform.limits?.collectionImportSizeLimit ?? 10 // Default to 10 MB

const importFilesCount = ref(0)

const hasFile = ref(false)
const showFileSizeLimitExceededWarning = ref(false)
const fileContent = ref<string[]>([])

const inputChooseFileToImportFrom = ref<HTMLInputElement | any>()

const emit = defineEmits<{
  (e: "importFromFile", content: string[]): void
}>()

// Disable the import CTA if no file is selected, the file size limit is exceeded, or during an import action indicated by the `isLoading` prop
const disableImportCTA = computed(
  () =>
    !hasFile.value || showFileSizeLimitExceededWarning.value || props.loading
)

const onFileChange = async () => {
  // Reset the state on entering the handler to avoid any stale state
  if (showFileSizeLimitExceededWarning.value) {
    showFileSizeLimitExceededWarning.value = false
  }

  if (importFilesCount.value) {
    importFilesCount.value = 0
  }

  const inputFileToImport = inputChooseFileToImportFrom.value

  if (!inputFileToImport) {
    hasFile.value = false
    return
  }

  if (!inputFileToImport.files || inputFileToImport.files.length === 0) {
    inputChooseFileToImportFrom.value = ""
    hasFile.value = false
    toast.show(t("action.choose_file").toString())
    return
  }

  const readerPromises: Promise<string | null>[] = []

  let totalFileSize = 0

  for (let i = 0; i < inputFileToImport.files.length; i++) {
    const file = inputFileToImport.files[i]

    totalFileSize += file.size / 1024 / 1024

    if (totalFileSize > ALLOWED_FILE_SIZE_LIMIT) {
      showFileSizeLimitExceededWarning.value = true
      break
    }

    const reader = new FileReader()

    readerPromises.push(
      new Promise((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string | null)
        reader.onerror = reject
        reader.readAsText(file)
      })
    )
  }

  importFilesCount.value = readerPromises.length

  const results = await Promise.allSettled(readerPromises)

  const contentsArr = results
    .filter((result) => result.status === "fulfilled")
    .map((result) => (result as { value: string | null }).value)
    .filter(Boolean) as string[]

  const errors = results.filter((result) => result.status === "rejected")
  if (errors.length) {
    toast.error(t("error.reading_files"))
  }

  fileContent.value = contentsArr
  hasFile.value = contentsArr.length > 0
}
</script>
