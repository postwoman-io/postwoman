<template>
  <HoppSmartModal
    v-if="show"
    dialog
    :title="t('agent.client_certs')"
    @close="emit('hide-modal')"
  >
    <template #body>
      <div class="flex flex-col space-y-4">
        <ul
          v-if="certificateMap.size > 0"
          class="mx-4 border border-dividerDark rounded"
        >
          <li
            v-for="([domain, certificate], index) in certificateMap"
            :key="domain"
            class="flex border-dividerDark px-2 items-center justify-between"
            :class="{ 'border-t border-dividerDark': index !== 0 }"
          >
            <div class="flex space-x-2">
              <div class="truncate">
                {{ domain }}
              </div>
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
                @click="toggleEntryEnabled(domain)"
              />

              <HoppButtonSecondary
                v-tippy="{ theme: 'tooltip' }"
                :icon="IconTrash"
                :title="t('action.remove')"
                color="red"
                @click="deleteEntry(domain)"
              />
            </div>
          </li>
        </ul>

        <HoppButtonSecondary
          class="mx-4"
          :icon="IconPlus"
          :label="t('agent.add_cert_file')"
          filled
          outline
          @click="showAddModal = true"
        />
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

  <InterceptorsAgentModalNativeClientCertsAdd
    :show="showAddModal"
    :existing-domains="Array.from(certificateMap.keys())"
    @hide-modal="showAddModal = false"
    @save="saveCertificate"
  />
</template>

<!-- TODO: i18n -->
<script setup lang="ts">
import IconPlus from "~icons/lucide/plus"
import IconCheckCircle from "~icons/lucide/check-circle"
import IconCircle from "~icons/lucide/circle"
import IconTrash from "~icons/lucide/trash"
import { ref, watch } from "vue"
import { useI18n } from "@composables/i18n"
import { useService } from "dioc/vue"
import { cloneDeep } from "lodash-es"
import {
  ClientCertificateEntry,
  AgentInterceptorService,
} from "~/platform/std/interceptors/agent"

const props = defineProps<{
  show: boolean
}>()

const emit = defineEmits<{
  (e: "hide-modal"): void
}>()

const t = useI18n()

const nativeInterceptorService = useService(AgentInterceptorService)

const certificateMap = ref(new Map<string, ClientCertificateEntry>())

const showAddModal = ref(false)

watch(
  () => props.show,
  (show) => {
    if (show) {
      certificateMap.value = cloneDeep(
        nativeInterceptorService.clientCertificates.value
      )
    }
  }
)

function save() {
  nativeInterceptorService.clientCertificates.value = cloneDeep(
    certificateMap.value
  )
  emit("hide-modal")
}

function saveCertificate(cert: ClientCertificateEntry) {
  certificateMap.value.set(cert.domain, cert)
}

function toggleEntryEnabled(domain: string) {
  const certificate = certificateMap.value.get(domain)

  if (certificate) {
    certificateMap.value.set(domain, {
      ...certificate,
      enabled: !certificate.enabled,
    })
  }
}

function deleteEntry(domain: string) {
  certificateMap.value.delete(domain)
}
</script>
