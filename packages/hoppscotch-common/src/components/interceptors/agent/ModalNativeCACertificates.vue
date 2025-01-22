<template>
  <HoppSmartModal
    v-if="show"
    dialog
    :title="t('agent.ca_certs')"
    @close="emit('hide-modal')"
  >
    <template #body>
      <div class="flex flex-col space-y-4">
        <ul
          v-if="certificates.length > 0"
          class="mx-4 border border-dividerDark rounded"
        >
          <li
            v-for="(certificate, index) in certificates"
            :key="index"
            class="flex border-dividerDark px-2 items-center justify-between"
            :class="{ 'border-t border-dividerDark': index !== 0 }"
          >
            <div class="truncate">
              {{ certificate.filename }}
            </div>

            <div class="flex items-center">
              <HoppButtonSecondary
                v-tippy="{ theme: 'tooltip' }"
                :icon="certificate.enabled ? IconCheckCircle : IconCircle"
                :title="
                  certificate.enabled
                    ? t('action.turn_off')
                    : t('action.turn_on')
                "
                color="green"
                @click="toggleEntryEnabled(index)"
              />

              <HoppButtonSecondary
                v-tippy="{ theme: 'tooltip' }"
                :icon="IconTrash"
                :title="t('action.remove')"
                @click="deleteEntry(index)"
              />
            </div>
          </li>
        </ul>

        <HoppButtonSecondary
          class="mx-4"
          :icon="IconPlus"
          :label="t('agent.add_cert_file')"
          :loading="selectedFiles && selectedFiles!.length > 0"
          filled
          outline
          @click="openFilePicker"
        />

        <p class="text-center text-secondaryLight">
          Hoppscotch supports .crt, .cer or .pem files containing one or more
          certificates.
        </p>
      </div>
    </template>

    <template #footer>
      <div class="flex space-x-2">
        <HoppButtonPrimary :label="t('action.save')" @click="save" />
        <HoppButtonSecondary
          :label="t('action.cancel')"
          filled
          outline
          @click="emit('hide-modal')"
        />
      </div>
    </template>
  </HoppSmartModal>
</template>

<!-- TODO: i18n -->
<script setup lang="ts">
import IconPlus from "~icons/lucide/plus"
import IconCheckCircle from "~icons/lucide/check-circle"
import IconCircle from "~icons/lucide/circle"
import IconTrash from "~icons/lucide/trash"
import { useService } from "dioc/vue"
import { ref, watch } from "vue"
import { useFileDialog } from "@vueuse/core"
import { cloneDeep } from "lodash-es"
import { useI18n } from "@composables/i18n"
import {
  CACertificateEntry,
  AgentInterceptorService,
} from "~/platform/std/interceptors/agent"
import { useToast } from "@composables/toast"
import { hasValidExtension } from "~/helpers/utils/file-extension"

const t = useI18n()
const toast = useToast()

const props = defineProps<{
  show: boolean
}>()

const emit = defineEmits<{
  (e: "hide-modal"): void
}>()

const nativeInterceptorService = useService(AgentInterceptorService)

const certificates = ref<CACertificateEntry[]>([])

const {
  files: selectedFiles,
  open: openFilePicker,
  reset: resetFilePicker,
  onChange: onSelectedFilesChange,
} = useFileDialog({
  multiple: true,
})

const ALLOWED_EXTENSIONS = [".crt", ".cer", ".pem"]

function isValidCertType(filename: string): boolean {
  return hasValidExtension(filename, ALLOWED_EXTENSIONS)
}

// When files are selected, add them to the list of certificates and reset the file list
onSelectedFilesChange(async (files) => {
  if (files) {
    const addedCertificates: CACertificateEntry[] = []

    for (let i = 0; i < files.length; i++) {
      const file = files[i]

      if (!isValidCertType(file.name)) {
        toast.error(t("error.invalid_file_type", { filename: file.name }))
        continue
      }

      const data = new Uint8Array(await file.arrayBuffer())

      addedCertificates.push({
        filename: file.name,
        enabled: true,
        certificate: data,
      })
    }

    certificates.value.push(...addedCertificates)

    resetFilePicker()
  }
})

// When the modal is shown, clone the certificates from the service,
// We only write to the service when the user clicks on save
watch(
  () => props.show,
  (show) => {
    if (show) {
      certificates.value = cloneDeep(
        nativeInterceptorService.caCertificates.value
      )
    } else {
      resetFilePicker()
    }
  }
)

function save() {
  nativeInterceptorService.caCertificates.value = certificates.value
  emit("hide-modal")
}

function deleteEntry(index: number) {
  certificates.value.splice(index, 1)
}

function toggleEntryEnabled(index: number) {
  certificates.value[index].enabled = !certificates.value[index].enabled
}
</script>
