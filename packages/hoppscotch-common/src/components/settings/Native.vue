<template>
  <div class="flex flex-col">
    <div class="flex items-center space-x-2 py-4">
      <h2 class="font-semibold flex-1">{{ selectedDomainDisplay }}</h2>
      <HoppButtonSecondary
        v-tippy="{
          theme: 'tooltip',
          content: t('settings.manage_domains_overrides'),
        }"
        :icon="IconSettings"
        outline
        class="rounded"
        @click="showDomainModal = true"
      />
    </div>

    <div class="flex flex-col space-y-4">
      <div class="flex items-center">
        <HoppSmartToggle
          :on="domainSettings[selectedDomain]?.security?.validateCertificates"
          @change="toggleValidateCertificates"
        />
        {{ t("settings.validate_certificates") }}
      </div>

      <div class="flex items-center">
        <HoppSmartToggle
          :on="domainSettings[selectedDomain]?.security?.verifyHost"
          @change="toggleVerifyHost"
        />
        {{ t("settings.verify_host") }}
      </div>

      <div class="flex items-center">
        <HoppSmartToggle
          :on="domainSettings[selectedDomain]?.security?.verifyPeer"
          @change="toggleVerifyPeer"
        />
        {{ t("settings.verify_peer") }}
      </div>

      <div class="flex space-x-4">
        <HoppButtonSecondary
          :icon="IconFileBadge"
          :label="t('settings.ca_certificates')"
          outline
          @click="showCACertModal = true"
        />
        <HoppButtonSecondary
          :icon="IconFileKey"
          :label="t('settings.client_certificates')"
          outline
          @click="showClientCertModal = true"
        />
      </div>

      <div class="flex items-center">
        <HoppSmartToggle
          :on="!!domainSettings[selectedDomain]?.proxy"
          @change="toggleProxy"
        />
        {{ t("settings.proxy") }}
      </div>
      <p class="my-1 text-secondaryLight">
        {{ t("settings.proxy_capabilities") }}
      </p>
      <div
        v-if="domainSettings[selectedDomain]?.proxy"
        class="flex flex-col space-y-2"
      >
        <HoppSmartInput
          :model-value="domainSettings[selectedDomain].proxy.url"
          :placeholder="' '"
          :label="t('settings.proxy_url')"
          input-styles="floating-input !border-0"
          @update:model-value="updateProxyUrl"
        />
        <div class="flex">
          <HoppSmartInput
            :model-value="domainSettings[selectedDomain].proxy.username"
            :placeholder="' '"
            :label="t('authorization.username')"
            input-styles="floating-input !border-0"
            @update:model-value="updateProxyUsername"
          />
          <HoppSmartInput
            :model-value="domainSettings[selectedDomain].proxy.password"
            :placeholder="' '"
            :label="t('authorization.password')"
            input-styles="floating-input !border-0"
            :type="showProxyPassword ? 'text' : 'password'"
            @update:model-value="updateProxyPassword"
          >
            <template #button>
              <HoppButtonSecondary
                v-tippy="{ theme: 'tooltip' }"
                :title="
                  showProxyPassword ? t('hide.password') : t('show.password')
                "
                :icon="showProxyPassword ? IconEye : IconEyeOff"
                @click="showProxyPassword = !showProxyPassword"
              />
            </template>
          </HoppSmartInput>
        </div>
      </div>
    </div>

    <HoppSmartModal
      v-if="showDomainModal"
      :title="t('settings.manage_domains_overrides')"
      @close="showDomainModal = false"
    >
      <template #body>
        <div class="space-y-4 p-4">
          <div class="flex space-x-2">
            <HoppSmartInput
              v-model="newDomain"
              :placeholder="'example.com'"
              class="flex-1"
            />
            <HoppButtonSecondary
              v-tippy="{ theme: 'tooltip', content: t('settings.add_domain') }"
              :icon="IconPlus"
              outline
              class="rounded"
              @click="addDomain"
            />
          </div>
          <div class="space-y-2">
            <div
              v-for="domain in domains"
              :key="domain"
              class="flex items-center justify-between p-2 rounded opacity-50 hover:bg-primaryLight hover:cursor-pointer hover:opacity-100"
              :class="{ 'bg-primaryLight': domain === selectedDomain }"
              @click="selectDomain(domain)"
            >
              <span class="py-2.5">{{
                domain === "*" ? t("settings.global_defaults") : domain
              }}</span>
              <HoppButtonSecondary
                v-if="domain !== '*'"
                v-tippy="{
                  theme: 'tooltip',
                  content: t('settings.remove_domain'),
                }"
                :icon="IconTrash"
                outline
                class="rounded"
                @click.stop="removeDomain(domain)"
              />
            </div>
          </div>
        </div>
      </template>
    </HoppSmartModal>

    <HoppSmartModal
      v-if="showClientCertModal"
      dialog
      :title="t('settings.client_certificates')"
      @close="showClientCertModal = false"
    >
      <template #body>
        <HoppSmartTabs v-model="certType">
          <HoppSmartTab id="pem" :label="t('PEM')">
            <div class="p-4 space-y-4">
              <div class="flex flex-col space-y-2">
                <label>{{ t("settings.certificate") }}</label>
                <HoppButtonSecondary
                  :icon="
                    domainSettings[selectedDomain]?.security?.certificates
                      ?.client?.kind === 'pem' &&
                    domainSettings[selectedDomain]?.security?.certificates
                      ?.client?.cert
                      ? IconFile
                      : IconPlus
                  "
                  :label="
                    (domainSettings[selectedDomain]?.security?.certificates
                      ?.client?.kind === 'pem' &&
                      domainSettings[selectedDomain]?.security?.certificates
                        ?.client?.cert?.name) ||
                    t('settings.select_file')
                  "
                  outline
                  @click="pickPEMCertificate"
                />
              </div>
              <div class="flex flex-col space-y-2">
                <label>{{ t("settings.key") }}</label>
                <HoppButtonSecondary
                  :icon="
                    domainSettings[selectedDomain]?.security?.certificates
                      ?.client?.kind === 'pem' &&
                    domainSettings[selectedDomain]?.security?.certificates
                      ?.client?.key
                      ? IconFile
                      : IconPlus
                  "
                  :label="
                    (domainSettings[selectedDomain]?.security?.certificates
                      ?.client?.kind === 'pem' &&
                      domainSettings[selectedDomain]?.security?.certificates
                        ?.client?.key?.name) ||
                    t('settings.select_file')
                  "
                  outline
                  @click="pickPEMKey"
                />
              </div>
            </div>
          </HoppSmartTab>
          <HoppSmartTab id="pfx" :label="t('PFX')">
            <div class="p-4 space-y-4">
              <div class="flex flex-col space-y-2">
                <label>{{ t("settings.certificate") }}</label>
                <HoppButtonSecondary
                  :icon="
                    domainSettings[selectedDomain]?.security?.certificates
                      ?.client?.kind === 'pfx' &&
                    domainSettings[selectedDomain]?.security?.certificates
                      ?.client?.data
                      ? IconFile
                      : IconPlus
                  "
                  :label="
                    (domainSettings[selectedDomain]?.security?.certificates
                      ?.client?.kind === 'pfx' &&
                      domainSettings[selectedDomain]?.security?.certificates
                        ?.client?.data?.name) ||
                    t('settings.select_file')
                  "
                  outline
                  @click="pickPFXCertificate"
                />
              </div>
              <div class="border border-divider rounded">
                <HoppSmartInput
                  v-model="pfxPassword"
                  type="password"
                  :label="t('settings.password')"
                  input-styles="floating-input !border-0"
                  :placeholder="' '"
                  @update:model-value="updatePFXPassword"
                />
              </div>
            </div>
          </HoppSmartTab>
        </HoppSmartTabs>
      </template>
      <template #footer>
        <div class="flex justify-end">
          <HoppButtonPrimary
            :label="t('action.done')"
            :disabled="isClientCertIncomplete"
            @click="showClientCertModal = false"
          />
          <HoppButtonSecondary
            :label="t('action.clear')"
            @click="clearClientCerts"
          />
        </div>
      </template>
    </HoppSmartModal>

    <HoppSmartModal
      v-if="showCACertModal"
      dialog
      :title="t('settings.ca_certificates')"
      @close="showCACertModal = false"
    >
      <template #body>
        <div class="flex flex-col space-y-4">
          <ul class="mx-4 border border-divider rounded">
            <li
              v-for="(cert, index) in domainSettings[selectedDomain]?.security
                ?.certificates?.ca"
              :key="index"
              class="flex border-dividerDark px-2 items-center justify-between"
              :class="{ 'border-t border-dividerDark': index !== 0 }"
            >
              <div class="truncate">{{ cert.name }}</div>
              <div class="flex items-center">
                <HoppButtonSecondary
                  v-tippy="{ theme: 'tooltip' }"
                  :icon="cert.include ? IconCheckCircle : IconCircle"
                  :title="
                    cert.include ? t('action.turn_off') : t('action.turn_on')
                  "
                  color="green"
                  @click="toggleCACertFromStore(index)"
                />
                <HoppButtonSecondary
                  v-tippy="{ theme: 'tooltip' }"
                  :icon="IconTrash"
                  :title="t('action.remove')"
                  @click="clearCACert(index)"
                />
              </div>
            </li>
          </ul>

          <div class="flex flex-col space-y-2 mx-4">
            <HoppButtonSecondary
              :icon="IconPlus"
              :label="t('settings.add_cert_file')"
              outline
              @click="pickCACertificate"
            />
          </div>
          <p class="text-center text-secondaryLight">
            {{ t("settings.ca_certificates_support") }}
          </p>
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end">
          <HoppButtonPrimary
            :label="t('action.done')"
            @click="showCACertModal = false"
          />
        </div>
      </template>
    </HoppSmartModal>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from "vue"
import { useService } from "dioc/vue"
import { useI18n } from "@composables/i18n"
import { useCertificatePicker } from "@composables/picker"
import { KernelInterceptorNativeStore } from "~/platform/std/kernel-interceptors/native/store"

import IconTrash from "~icons/lucide/trash"
import IconCheckCircle from "~icons/lucide/check-circle"
import IconCircle from "~icons/lucide/circle"
import IconFile from "~icons/lucide/file"
import IconPlus from "~icons/lucide/plus"
import IconEye from "~icons/lucide/eye"
import IconEyeOff from "~icons/lucide/eye-off"
import IconSettings from "~icons/lucide/settings"
import IconFileKey from "~icons/lucide/file-key"
import IconFileBadge from "~icons/lucide/file-badge"

const t = useI18n()
const store = useService(KernelInterceptorNativeStore)

const selectedDomain = ref("*")
const domainSettings = reactive<Record<string, any>>({})
const showDomainModal = ref(false)
const showProxyPassword = ref(false)
const newDomain = ref("")
const domains = ref<string[]>(store.getDomains())

const showClientCertModal = ref(false)
const showCACertModal = ref(false)
const isClientCertIncomplete = computed(() => {
  const client =
    domainSettings[selectedDomain.value]?.security?.certificates?.client
  if (!client) return false

  return client.kind === "pem"
    ? !client.cert || !client.key
    : !client.data || !client.password
})

const {
  certType,
  pfxPassword,
  pickPEMCertificate,
  pickPEMKey,
  pickPFXCertificate,
  pickCACertificate,
} = useCertificatePicker({
  async onPEMCertChange(file) {
    if (!file) return

    const cert = {
      include: true,
      name: file.name,
      size: file.size,
      lastModified: file.lastModified,
      content: new Uint8Array(await file.arrayBuffer()),
    }

    updateDomainSettings({
      security: {
        certificates: {
          client: {
            kind: "pem",
            cert,
            key: domainSettings[selectedDomain.value]?.security?.certificates
              ?.client?.key,
          },
        },
      },
    })
  },
  async onPEMKeyChange(file) {
    if (!file) return

    const key = {
      include: true,
      name: file.name,
      size: file.size,
      lastModified: file.lastModified,
      content: new Uint8Array(await file.arrayBuffer()),
    }

    updateDomainSettings({
      security: {
        certificates: {
          client: {
            kind: "pem",
            key,
            cert: domainSettings[selectedDomain.value]?.security?.certificates
              ?.client?.cert,
          },
        },
      },
    })
  },
  async onPFXChange(file) {
    if (!file) return

    const data = {
      include: true,
      name: file.name,
      size: file.size,
      lastModified: file.lastModified,
      content: new Uint8Array(await file.arrayBuffer()),
    }

    updateDomainSettings({
      security: {
        certificates: {
          client: {
            kind: "pfx",
            data,
            password: pfxPassword.value,
          },
        },
      },
    })
  },
  async onCACertAdd(file) {
    const cert = {
      include: true,
      name: file.name,
      size: file.size,
      lastModified: file.lastModified,
      content: new Uint8Array(await file.arrayBuffer()),
    }

    const currentCerts =
      domainSettings[selectedDomain.value]?.security?.certificates?.ca || []

    updateDomainSettings({
      security: {
        certificates: {
          ca: [...currentCerts, cert],
        },
      },
    })
  },
})

const selectedDomainDisplay = computed(() =>
  selectedDomain.value === "*"
    ? t("settings.global_defaults")
    : selectedDomain.value
)

function addDomain() {
  if (newDomain.value) {
    const domain = newDomain.value.toLowerCase()
    store.saveDomainSettings(domain, { version: "v1" })
    domains.value.push(domain)
    newDomain.value = ""
  }
}

function removeDomain(domain: string) {
  store.clearDomainSettings(domain)
  domains.value = domains.value.filter((d) => d !== domain)
  if (selectedDomain.value === domain) {
    selectedDomain.value = "*"
  }
}

function selectDomain(domain: string) {
  selectedDomain.value = domain
  if (!domainSettings[domain]) {
    const settings = store.getDomainSettings(domain)
    domainSettings[domain] = settings
  }
  showDomainModal.value = false
}

function updateDomainSettings(newSettings: any) {
  const domain = selectedDomain.value
  if (!domainSettings[domain]) {
    domainSettings[domain] = { version: "v1" }
  }

  const currentSettings = domainSettings[domain]

  domainSettings[domain] = {
    ...currentSettings,
    ...newSettings,
    security: {
      ...currentSettings?.security,
      ...newSettings.security,
      certificates: {
        ...currentSettings?.security?.certificates,
        ...newSettings.security?.certificates,
      },
    },
  }

  store.saveDomainSettings(domain, domainSettings[domain])
}

function toggleValidateCertificates() {
  updateDomainSettings({
    security: {
      validateCertificates:
        !domainSettings[selectedDomain.value]?.security?.validateCertificates,
    },
  })
}

function toggleVerifyHost() {
  updateDomainSettings({
    security: {
      verifyHost: !domainSettings[selectedDomain.value]?.security?.verifyHost,
    },
  })
}

function toggleVerifyPeer() {
  updateDomainSettings({
    security: {
      verifyPeer: !domainSettings[selectedDomain.value]?.security?.verifyPeer,
    },
  })
}

function toggleProxy() {
  updateDomainSettings({
    proxy: domainSettings[selectedDomain.value]?.proxy
      ? undefined
      : { url: "" },
  })
}

function updateProxyUrl(value: string) {
  const current = domainSettings[selectedDomain.value]?.proxy
  updateDomainSettings({
    proxy: { ...current, url: value },
  })
}

function updateProxyUsername(value: string) {
  const current = domainSettings[selectedDomain.value]?.proxy
  updateDomainSettings({
    proxy: {
      ...current,
      auth: {
        ...(current?.auth ?? {}),
        username: value,
      },
    },
  })
}

function updateProxyPassword(value: string) {
  const current = domainSettings[selectedDomain.value]?.proxy
  updateDomainSettings({
    proxy: {
      ...current,
      auth: {
        ...(current?.auth ?? {}),
        password: value,
      },
    },
  })
}

function updatePFXPassword(value: string) {
  const currentClient =
    domainSettings[selectedDomain.value]?.security?.certificates?.client
  if (currentClient?.kind !== "pfx") return

  updateDomainSettings({
    security: {
      certificates: {
        client: {
          ...currentClient,
          password: value,
        },
      },
    },
  })
}

function toggleCACertFromStore(index: number) {
  const currentCerts =
    domainSettings[selectedDomain.value]?.security?.certificates?.ca || []
  const newCerts = [...currentCerts]
  newCerts[index] = {
    ...newCerts[index],
    include: !newCerts[index].include,
  }

  updateDomainSettings({
    security: {
      certificates: {
        ca: newCerts,
      },
    },
  })
}

function clearCACert(index: number) {
  const currentCerts =
    domainSettings[selectedDomain.value]?.security?.certificates?.ca || []
  const newCerts = [...currentCerts]
  newCerts.splice(index, 1)

  updateDomainSettings({
    security: {
      certificates: {
        ca: newCerts.length ? newCerts : undefined,
      },
    },
  })
}

function clearClientCerts() {
  updateDomainSettings({
    security: {
      certificates: {
        client: undefined,
      },
    },
  })
}

onMounted(() => {
  const initialSettings = store.getDomainSettings("*")
  domainSettings["*"] = initialSettings
})
</script>
