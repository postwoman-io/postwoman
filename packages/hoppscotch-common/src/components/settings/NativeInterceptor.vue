<script setup lang="ts">
import { ref, effectScope, onUnmounted, reactive, computed } from "vue"
import { useI18n } from "@composables/i18n"
import { useToast } from "@composables/toast"
import { useService } from "dioc/vue"
import { hasValidExtension } from "~/helpers/utils/file-extension"
import IconFileKey from "~icons/lucide/file-key"
import IconFileBadge from "~icons/lucide/file-badge"
import IconEyeOff from "~icons/lucide/eye-off"
import IconEye from "~icons/lucide/eye"
import IconTrash from "~icons/lucide/trash"
import IconCheckCircle from "~icons/lucide/check-circle"
import IconCircle from "~icons/lucide/circle"
import IconPlus from "~icons/lucide/plus"
import IconFile from "~icons/lucide/file"
import { NativeKernelInterceptorService } from "~/platform/std/kernel-interceptors/native"
import {
  CACertificateEntry,
  ClientCertificateEntry,
} from "~/platform/std/kernel-interceptors/native/persistence"

const ALLOWED_CA_EXTENSIONS = [".crt", ".cer", ".pem"]
const ALLOWED_CLIENT_EXTENSIONS = [".crt", ".cer", ".pem", ".pfx", ".p12"]

type FileState =
  | { type: "empty" }
  | { type: "loading" }
  | { type: "loaded"; filename: string; data: Uint8Array }

const t = useI18n()
const toast = useToast()
const service = useService(NativeKernelInterceptorService)
const scope = effectScope()

const modal = reactive({
  clientCerts: false,
  addClientCerts: false,
  caCerts: false,
})

const proxyConfig = reactive({
  auth: false,
  username: "",
  password: "",
  showPassword: false,
})

const clientCertForm = reactive({
  domain: "",
  tab: "pem" as const,
  pemCert: { type: "empty" } as FileState,
  pemKey: { type: "empty" } as FileState,
  pfxCert: { type: "empty" } as FileState,
  pfxPassword: "",
  showPassword: false,
})

const certificates = reactive({
  ca: [] as CACertificateEntry[],
  client: new Map<string, ClientCertificateEntry>(),
})

const validateCerts = computed({
  get: () => service.validateCerts,
  set: (value) => (service.validateCerts = value),
})

const verifyHost = computed({
  get: () => service.verifyHost,
  set: (value) => (service.verifyHost = value),
})

const proxyEnabled = computed({
  get: () => service.proxyEnabled,
  set: (value) => (service.proxyEnabled = value),
})

const followRedirects = computed({
  get: () => service.followRedirects,
  set: (value) => (service.followRedirects = value),
})

const maxRedirects = computed({
  get: () => service.maxRedirects,
  set: (value) => (service.maxRedirects = value),
})

const requestTimeout = computed({
  get: () => service.requestTimeout,
  set: (value) => (service.requestTimeout = value),
})

async function handleCAFileUpload(files: FileList) {
  const addedCertificates = []
  for (let i = 0; i < files.length; i++) {
    const file = files[i]
    if (!hasValidExtension(file.name, ALLOWED_CA_EXTENSIONS)) {
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
  certificates.ca.push(...addedCertificates)
}

async function handleClientFileUpload(
  type: "pem_cert" | "pem_key" | "pfx_cert",
  file: File
) {
  const targetRef =
    type === "pem_cert"
      ? clientCertForm.pemCert
      : type === "pem_key"
        ? clientCertForm.pemKey
        : clientCertForm.pfxCert

  targetRef.type = "loading"
  const data = new Uint8Array(await file.arrayBuffer())
  Object.assign(targetRef, {
    type: "loaded",
    filename: file.name,
    data,
  })
}

const clientCertificate = computed(() => {
  if (clientCertForm.tab === "pem") {
    if (
      clientCertForm.pemCert.type === "loaded" &&
      clientCertForm.pemKey.type === "loaded"
    ) {
      return {
        domain: clientCertForm.domain,
        enabled: true,
        cert: {
          PEMCert: {
            certificate_filename: clientCertForm.pemCert.filename,
            certificate_pem: clientCertForm.pemCert.data,
            key_filename: clientCertForm.pemKey.filename,
            key_pem: clientCertForm.pemKey.data,
          },
        },
      }
    }
  } else if (clientCertForm.pfxCert.type === "loaded") {
    return {
      domain: clientCertForm.domain.trim(),
      enabled: true,
      cert: {
        PFXCert: {
          certificate_filename: clientCertForm.pfxCert.filename,
          certificate_pfx: clientCertForm.pfxCert.data,
          password: clientCertForm.pfxPassword,
        },
      },
    }
  }
  return null
})

const isValidClientCertificate = computed(() => {
  if (!clientCertificate.value) return false
  if (certificates.client.has(clientCertificate.value.domain)) return false
  return true
})

function saveClientCertificate() {
  if (!clientCertificate.value) return
  certificates.client.set(
    clientCertificate.value.domain,
    clientCertificate.value
  )

  Object.assign(clientCertForm, {
    domain: "",
    tab: "pem",
    pemCert: { type: "empty" },
    pemKey: { type: "empty" },
    pfxCert: { type: "empty" },
    pfxPassword: "",
    showPassword: false,
  })
  modal.addClientCerts = false
}

function saveClientCertificates() {
  service.clientCertificates = certificates.client
  modal.clientCerts = false
}

function saveCACertificates() {
  service.caCertificates = certificates.ca
  modal.caCerts = false
}

function deleteCACertificate(index: number) {
  certificates.ca.splice(index, 1)
}

function deleteClientCertificate(domain: string) {
  certificates.client.delete(domain)
}

function toggleCACertificate(index: number) {
  certificates.ca[index].enabled = !certificates.ca[index].enabled
}

function toggleClientCertificate(domain: string) {
  const cert = certificates.client.get(domain)
  if (!cert) return

  certificates.client.set(domain, {
    ...cert,
    enabled: !cert.enabled,
  })
}

onUnmounted(() => {
  scope.stop()
})
</script>

<template>
  <div class="py-4 space-y-8">
    <section class="space-y-4">
      <div class="flex items-center justify-between">
        <HoppSmartToggle
          :on="validateCerts"
          @change="validateCerts = !validateCerts"
          >{{ t("settings.verify_certificates") }}</HoppSmartToggle
        >
      </div>

      <div class="flex items-center justify-between">
        <HoppSmartToggle :on="verifyHost" @change="verifyHost = !verifyHost">{{
          t("settings.verify_hostname")
        }}</HoppSmartToggle>
      </div>

      <div class="flex space-x-4">
        <HoppButtonSecondary
          :icon="IconFileKey"
          :label="t('settings.client_certificates')"
          outline
          @click="modal.clientCerts = true"
        />
        <HoppButtonSecondary
          :icon="IconFileBadge"
          :label="t('settings.ca_certificates')"
          outline
          @click="modal.caCerts = true"
        />
      </div>
    </section>

    <section class="space-y-4">
      <div class="flex items-center justify-between">
        <HoppSmartToggle
          :on="proxyEnabled"
          @change="proxyEnabled = !proxyEnabled"
          >{{ t("settings.use_proxy") }}</HoppSmartToggle
        >
      </div>

      <HoppSmartInput
        v-if="proxyEnabled"
        v-model="service.proxyUrl"
        :placeholder="t('settings.proxy_url')"
      />

      <div v-if="proxyEnabled" class="flex items-center justify-between">
        <HoppSmartToggle
          :on="proxyConfig.auth"
          @change="proxyConfig.auth = !proxyConfig.auth"
          >{{ t("settings.proxy_auth") }}</HoppSmartToggle
        >
      </div>

      <div v-if="proxyConfig.auth" class="space-y-4">
        <HoppSmartInput
          v-model="proxyConfig.username"
          :placeholder="t('settings.username')"
        />

        <div class="relative">
          <HoppSmartInput
            v-model="proxyConfig.password"
            :type="proxyConfig.showPassword ? 'text' : 'password'"
            :placeholder="t('settings.password')"
          >
            <template #button>
              <HoppButtonSecondary
                v-tippy="{ theme: 'tooltip' }"
                :title="
                  proxyConfig.showPassword ? t('action.hide') : t('action.show')
                "
                :icon="proxyConfig.showPassword ? IconEye : IconEyeOff"
                @click="proxyConfig.showPassword = !proxyConfig.showPassword"
              />
            </template>
          </HoppSmartInput>
        </div>
      </div>
    </section>

    <section class="space-y-4">
      <div class="flex items-center justify-between">
        <HoppSmartToggle
          :on="followRedirects"
          @change="followRedirects = !followRedirects"
          >{{ t("settings.follow_redirects") }}</HoppSmartToggle
        >
      </div>

      <HoppSmartInput
        v-if="followRedirects"
        v-model="maxRedirects"
        type="number"
        :min="0"
        :placeholder="t('settings.max_redirects')"
      />

      <HoppSmartInput
        v-model="requestTimeout"
        type="number"
        :min="0"
        :placeholder="t('settings.timeout_ms')"
      />
    </section>

    <HoppSmartModal
      v-if="modal.clientCerts"
      :title="t('settings.client_certificates')"
      @close="modal.clientCerts = false"
    >
      <template #body>
        <div class="flex flex-col space-y-4">
          <ul
            v-if="certificates.client.size > 0"
            class="mx-4 border border-dividerDark rounded"
          >
            <li
              v-for="[domain, certificate] in certificates.client"
              :key="domain"
              class="flex border-dividerDark px-2 items-center justify-between"
              :class="{ 'border-t border-dividerDark': true }"
            >
              <div class="flex space-x-2">
                <div class="truncate">{{ domain }}</div>
              </div>

              <div class="flex items-center space-x-1">
                <div class="text-secondaryLight mr-2">
                  {{ "PEMCert" in certificate.cert ? "PEM" : "PFX/PKCS12" }}
                </div>

                <HoppButtonSecondary
                  v-tippy="{ theme: 'tooltip' }"
                  :icon="certificate.enabled ? IconCheckCircle : IconCircle"
                  :title="
                    certificate.enabled
                      ? t('action.turn_off')
                      : t('action.turn_on')
                  "
                  color="green"
                  @click="toggleClientCertificate(domain)"
                />

                <HoppButtonSecondary
                  v-tippy="{ theme: 'tooltip' }"
                  :icon="IconTrash"
                  :title="t('action.remove')"
                  color="red"
                  @click="deleteClientCertificate(domain)"
                />
              </div>
            </li>
          </ul>

          <HoppButtonSecondary
            class="mx-4"
            :icon="IconPlus"
            :label="t('settings.add_cert_file')"
            filled
            outline
            @click="modal.addClientCerts = true"
          />
        </div>
      </template>

      <template #footer>
        <div class="flex space-x-2">
          <HoppButtonPrimary
            :label="t('action.save')"
            @click="saveClientCertificates"
          />
          <HoppButtonSecondary
            :label="t('action.cancel')"
            filled
            outline
            @click="modal.clientCerts = false"
          />
        </div>
      </template>
    </HoppSmartModal>

    <HoppSmartModal
      v-if="modal.addClientCerts"
      :title="t('settings.add_client_cert')"
      @close="modal.addClientCerts = false"
    >
      <template #body>
        <div class="space-y-4">
          <HoppSmartInput
            v-model="clientCertForm.domain"
            :autofocus="false"
            styles="flex-1"
            placeholder=" "
            :label="t('native.domain')"
            input-styles="input floating-input"
          />

          <HoppSmartTabs v-model="clientCertForm.tab">
            <HoppSmartTab :id="'pem'" :label="'PEM'">
              <div class="p-4 space-y-4">
                <div class="flex flex-col space-y-2">
                  <label>{{ t("native.cert") }}</label>
                  <HoppButtonSecondary
                    :icon="
                      clientCertForm.pemCert.type === 'loaded'
                        ? IconFile
                        : IconPlus
                    "
                    :loading="clientCertForm.pemCert.type === 'loading'"
                    :label="
                      clientCertForm.pemCert.type === 'loaded'
                        ? clientCertForm.pemCert.filename
                        : t('native.add_cert_file')
                    "
                    filled
                    outline
                    @click="$refs.pemCertInput.click()"
                  />
                  <input
                    ref="pemCertInput"
                    type="file"
                    class="hidden"
                    accept=".pem, .crt, .cer"
                    @change="
                      handleClientFileUpload('pem_cert', $event.target.files[0])
                    "
                  />
                </div>

                <div class="flex flex-col space-y-2">
                  <label>{{ t("native.key") }}</label>
                  <HoppButtonSecondary
                    :icon="
                      clientCertForm.pemKey.type === 'loaded'
                        ? IconFile
                        : IconPlus
                    "
                    :loading="clientCertForm.pemKey.type === 'loading'"
                    :label="
                      clientCertForm.pemKey.type === 'loaded'
                        ? clientCertForm.pemKey.filename
                        : t('native.add_key_file')
                    "
                    filled
                    outline
                    @click="$refs.pemKeyInput.click()"
                  />
                  <input
                    ref="pemKeyInput"
                    type="file"
                    class="hidden"
                    accept=".pem, .key"
                    @change="
                      handleClientFileUpload('pem_key', $event.target.files[0])
                    "
                  />
                </div>
              </div>
            </HoppSmartTab>

            <HoppSmartTab :id="'pfx'" :label="t('native.pfx_or_pkcs')">
              <div class="p-4 space-y-6">
                <div class="flex flex-col space-y-2">
                  <label>{{ t("native.pfx_or_pkcs_file") }}</label>
                  <HoppButtonSecondary
                    :icon="
                      clientCertForm.pfxCert.type === 'loaded'
                        ? IconFile
                        : IconPlus
                    "
                    :loading="clientCertForm.pfxCert.type === 'loading'"
                    :label="
                      clientCertForm.pfxCert.type === 'loaded'
                        ? clientCertForm.pfxCert.filename
                        : t('native.add_pfx_or_pkcs_file')
                    "
                    filled
                    outline
                    @click="$refs.pfxCertInput.click()"
                  />
                  <input
                    ref="pfxCertInput"
                    type="file"
                    class="hidden"
                    accept=".pfx, .p12"
                    @change="
                      handleClientFileUpload('pfx_cert', $event.target.files[0])
                    "
                  />
                </div>

                <div class="border border-divider rounded">
                  <HoppSmartInput
                    v-model="clientCertForm.pfxPassword"
                    :type="clientCertForm.showPassword ? 'text' : 'password'"
                    :label="t('authorization.password')"
                    input-styles="floating-input !border-0"
                    :placeholder="' '"
                  >
                    <template #button>
                      <HoppButtonSecondary
                        v-tippy="{ theme: 'tooltip' }"
                        :title="
                          clientCertForm.showPassword
                            ? t('hide.password')
                            : t('show.password')
                        "
                        :icon="
                          clientCertForm.showPassword ? IconEye : IconEyeOff
                        "
                        @click="
                          clientCertForm.showPassword =
                            !clientCertForm.showPassword
                        "
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
            :disabled="!isValidClientCertificate"
            @click="saveClientCertificate"
          />
          <HoppButtonSecondary
            :label="t('action.cancel')"
            filled
            outline
            @click="modal.addClientCerts = false"
          />
        </div>
      </template>
    </HoppSmartModal>

    <HoppSmartModal
      v-if="modal.caCerts"
      :title="t('native.ca_certs')"
      @close="modal.caCerts = false"
    >
      <template #body>
        <div class="flex flex-col space-y-4">
          <ul
            v-if="certificates.ca.length > 0"
            class="mx-4 border border-dividerDark rounded"
          >
            <li
              v-for="(certificate, index) in certificates.ca"
              :key="index"
              class="flex border-dividerDark px-2 items-center justify-between"
              :class="{ 'border-t border-dividerDark': index !== 0 }"
            >
              <div class="truncate">{{ certificate.filename }}</div>

              <div class="flex items-center space-x-1">
                <HoppButtonSecondary
                  v-tippy="{ theme: 'tooltip' }"
                  :icon="certificate.enabled ? IconCheckCircle : IconCircle"
                  :title="
                    certificate.enabled
                      ? t('action.turn_off')
                      : t('action.turn_on')
                  "
                  color="green"
                  @click="toggleCACertificate(index)"
                />

                <HoppButtonSecondary
                  v-tippy="{ theme: 'tooltip' }"
                  :icon="IconTrash"
                  :title="t('action.remove')"
                  @click="deleteCACertificate(index)"
                />
              </div>
            </li>
          </ul>

          <input
            ref="caFileInput"
            type="file"
            multiple
            class="hidden"
            accept=".crt, .cer, .pem"
            @change="handleCAFileUpload($event.target.files)"
          />

          <HoppButtonSecondary
            class="mx-4"
            :icon="IconPlus"
            :label="t('native.add_cert_file')"
            filled
            outline
            @click="$refs.caFileInput.click()"
          />
        </div>
      </template>

      <template #footer>
        <div class="flex space-x-2">
          <HoppButtonPrimary
            :label="t('action.save')"
            @click="saveCACertificates"
          />
          <HoppButtonSecondary
            :label="t('action.cancel')"
            filled
            outline
            @click="modal.caCerts = false"
          />
        </div>
      </template>
    </HoppSmartModal>
  </div>
</template>
