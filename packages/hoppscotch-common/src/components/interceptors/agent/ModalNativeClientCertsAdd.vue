<template>
  <HoppSmartModal
    v-if="show"
    dialog
    :title="t('agent.add_client_cert')"
    @close="emit('hide-modal')"
  >
    <template #body>
      <div class="space-y-4">
        <HoppSmartInput
          v-model="domain"
          :autofocus="false"
          styles="flex-1"
          placeholder=" "
          :label="t('agent.domain')"
          input-styles="input floating-input"
        />

        <HoppSmartTabs v-model="selectedTab">
          <HoppSmartTab :id="'pem'" :label="'PEM'">
            <div class="p-4 space-y-4">
              <div class="flex flex-col space-y-2">
                <label> {{ t("agent.cert") }} </label>
                <HoppButtonSecondary
                  :icon="pemCert?.type === 'loaded' ? IconFile : IconPlus"
                  :loading="pemCert?.type === 'loading'"
                  :label="
                    pemCert?.type === 'loaded'
                      ? pemCert.filename
                      : t('agent.add_cert_file')
                  "
                  filled
                  outline
                  @click="openFilePicker('pem_cert')"
                />
              </div>
              <div class="flex flex-col space-y-2">
                <label> {{ t("agent.key") }} </label>
                <HoppButtonSecondary
                  :icon="pemKey?.type === 'loaded' ? IconFile : IconPlus"
                  :loading="pemKey?.type === 'loading'"
                  :label="
                    pemKey?.type === 'loaded'
                      ? pemKey.filename
                      : t('agent.add_key_file')
                  "
                  filled
                  outline
                  @click="openFilePicker('pem_key')"
                />
              </div>
            </div>
          </HoppSmartTab>

          <HoppSmartTab :id="'pfx'" :label="t('agent.pfx_or_pkcs')">
            <div class="p-4 space-y-6">
              <div class="flex flex-col space-y-2">
                <label> {{ t("agent.pfx_or_pkcs_file") }} </label>
                <HoppButtonSecondary
                  :icon="pfxCert?.type === 'loaded' ? IconFile : IconPlus"
                  :loading="pfxCert?.type === 'loading'"
                  :label="
                    pfxCert?.type === 'loaded'
                      ? pfxCert.filename
                      : t('agent.add_pfx_or_pkcs_file')
                  "
                  filled
                  outline
                  @click="openFilePicker('pfx_cert')"
                />
              </div>

              <div class="border border-divider rounded">
                <HoppSmartInput
                  v-model="pfxPassword"
                  :type="showPfxPassword ? 'text' : 'password'"
                  :label="t('authorization.password')"
                  input-styles="floating-input !border-0 "
                  :placeholder="' '"
                >
                  <template #button>
                    <HoppButtonSecondary
                      v-tippy="{ theme: 'tooltip' }"
                      :title="
                        showPfxPassword
                          ? t('hide.password')
                          : t('show.password')
                      "
                      :icon="showPfxPassword ? IconEye : IconEyeOff"
                      @click="showPfxPassword = !showPfxPassword"
                    />
                  </template>
                </HoppSmartInput>
              </div>
            </div>
          </HoppSmartTab>
        </HoppSmartTabs>
      </div>
    </template>

    <template #footer>
      <div class="flex space-x-2">
        <HoppButtonPrimary
          :label="t('action.save')"
          :disabled="!isValidCertificate || anyFileSelectorIsLoading"
          @click="save"
        />
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
import IconEyeOff from "~icons/lucide/eye-off"
import IconEye from "~icons/lucide/eye"
import IconFile from "~icons/lucide/file"
import { ref, watch, computed } from "vue"
import { useFileDialog } from "@vueuse/core"
import { useToast } from "@composables/toast"
import { useI18n } from "@composables/i18n"
import { ClientCertificateEntry } from "~/platform/std/interceptors/agent"

const toast = useToast()

const props = defineProps<{
  show: boolean
  existingDomains: string[]
}>()

const emit = defineEmits<{
  (e: "hide-modal"): void
  (e: "save", certificate: ClientCertificateEntry): void
}>()

type FileSelectorState =
  | null
  | { type: "loading" }
  | { type: "loaded"; filename: string; data: Uint8Array }

const t = useI18n()

const domain = ref("")

const pemCert = ref<FileSelectorState>(null)
const pemKey = ref<FileSelectorState>(null)

const pfxCert = ref<FileSelectorState>(null)

const pfxPassword = ref("")
const showPfxPassword = ref(false)

const anyFileSelectorIsLoading = computed(
  () =>
    pemCert.value?.type === "loading" ||
    pemKey.value?.type === "loading" ||
    pfxCert.value?.type === "loading"
)

const currentlyPickingFile = ref<null | "pem_cert" | "pem_key" | "pfx_cert">(
  null
)

const selectedTab = ref<"pem" | "pfx">("pem")

watch(
  () => props.show,
  (show) => {
    if (!show) return

    currentlyPickingFile.value = null

    domain.value = ""
    pemCert.value = null
    pemKey.value = null
    pfxCert.value = null
    pfxPassword.value = ""
    showPfxPassword.value = false
    selectedTab.value = "pem"
  }
)

const certificate = computed<ClientCertificateEntry | null>(() => {
  if (selectedTab.value === "pem") {
    if (pemCert.value?.type === "loaded" && pemKey.value?.type === "loaded") {
      return <ClientCertificateEntry>{
        domain: domain.value,
        enabled: true,
        cert: {
          PEMCert: {
            certificate_filename: pemCert.value.filename,
            certificate_pem: pemCert.value.data,

            key_filename: pemKey.value.filename,
            key_pem: pemKey.value.data,
          },
        },
      }
    }
  } else {
    if (pfxCert.value?.type === "loaded") {
      return <ClientCertificateEntry>{
        domain: domain.value.trim(),
        enabled: true,
        cert: {
          PFXCert: {
            certificate_filename: pfxCert.value.filename,
            certificate_pfx: pfxCert.value.data,
            password: pfxPassword.value,
          },
        },
      }
    }
  }

  return null
})

const isValidCertificate = computed(() => {
  if (certificate.value === null) return false

  if (props.existingDomains.includes(certificate.value.domain)) {
    toast.error("A certificate for this domain already exists")
    return false
  }

  return ClientCertificateEntry.safeParse(certificate.value).success
})

const {
  open: openFileDialog,
  reset: resetFilePicker,
  onChange: onFilePickerChange,
} = useFileDialog({
  reset: true,
  multiple: false,
})

onFilePickerChange(async (files) => {
  if (!files) return

  const file = files.item(0)

  if (!file) return

  if (currentlyPickingFile.value === "pem_cert") {
    pemCert.value = { type: "loading" }
  } else if (currentlyPickingFile.value === "pem_key") {
    pemKey.value = { type: "loading" }
  } else if (currentlyPickingFile.value === "pfx_cert") {
    pfxCert.value = { type: "loading" }
  }

  const data = new Uint8Array(await file.arrayBuffer())

  if (currentlyPickingFile.value === "pem_cert") {
    pemCert.value = { type: "loaded", filename: file.name, data }
  } else if (currentlyPickingFile.value === "pem_key") {
    pemKey.value = { type: "loaded", filename: file.name, data }
  } else if (currentlyPickingFile.value === "pfx_cert") {
    pfxCert.value = { type: "loaded", filename: file.name, data }
  }

  currentlyPickingFile.value = null

  resetFilePicker()
})

function openFilePicker(type: "pem_cert" | "pem_key" | "pfx_cert") {
  currentlyPickingFile.value = type

  openFileDialog()
}

function save() {
  if (certificate.value) {
    emit("save", certificate.value)
    emit("hide-modal")
  }
}
</script>
