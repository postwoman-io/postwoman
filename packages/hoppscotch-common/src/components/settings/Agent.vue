<template>
  <div class="py-4 space-y-4">
    <div class="flex items-center">
      <HoppSmartToggle
        :on="allowSSLVerification"
        @change="allowSSLVerification = !allowSSLVerification"
      />
      {{ t("agent.verify_ssl_certs") }}
    </div>

    <div class="flex space-x-4">
      <!--
      <HoppButtonSecondary
        :icon="IconLucideFileBadge"
        :label="'CA Certificates'"
        outline
        @click="showCACertificatesModal = true"
      />
      -->
      <!--
      <HoppButtonSecondary
        :icon="IconLucideFileKey"
        :label="t('agent.client_certs')"
        outline
        @click="showClientCertificatesModal = true"
      />
      -->
    </div>

    <!--
    <ModalsNativeCACertificates
      :show="showCACertificatesModal"
      @hide-modal="showCACertificatesModal = false"
    />
    -->

    <!--
    <InterceptorsAgentModalNativeClientCertificates
      :show="showClientCertificatesModal"
      @hide-modal="showClientCertificatesModal = false"
    />
    -->

    <div class="pt-4 space-y-4">
      <div class="flex items-center">
        <HoppSmartToggle :on="allowProxy" @change="allowProxy = !allowProxy" />
        {{ t("agent.use_http_proxy") }}
      </div>

      <HoppSmartInput
        v-if="allowProxy"
        v-model="proxyURL"
        :autofocus="false"
        styles="flex-1"
        placeholder=" "
        :label="t('settings.proxy_url')"
        input-styles="input floating-input"
      />

      <p class="my-1 text-secondaryLight">
        {{ t("agent.proxy_capabilities") }}
      </p>
    </div>
  </div>
</template>

<!-- TODO: i18n -->
<script setup lang="ts">
import { computed, ref } from "vue"
import { useI18n } from "@composables/i18n"
// import IconLucideFileKey from "~icons/lucide/file-key"
import { useService } from "dioc/vue"
import {
  RequestDef,
  AgentInterceptorService,
} from "~/platform/std/interceptors/agent"
import { syncRef } from "@vueuse/core"

type RequestProxyInfo = RequestDef["proxy"]

const t = useI18n()

const agentInterceptorService = useService(AgentInterceptorService)

const allowSSLVerification = agentInterceptorService.validateCerts

// const showCACertificatesModal = ref(false)
// const showClientCertificatesModal = ref(false)

const allowProxy = ref(false)
const proxyURL = ref("")

const proxyInfo = computed<RequestProxyInfo>({
  get() {
    if (allowProxy.value) {
      return {
        url: proxyURL.value,
      }
    }

    return undefined
  },
  set(newData) {
    if (newData) {
      allowProxy.value = true
      proxyURL.value = newData.url
    } else {
      allowProxy.value = false
    }
  },
})

syncRef(agentInterceptorService.proxyInfo, proxyInfo, { direction: "both" })
</script>
