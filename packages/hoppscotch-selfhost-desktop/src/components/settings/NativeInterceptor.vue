<template>
  <div class="py-4 space-y-4">
    <div class="flex items-center">
      <HoppSmartToggle
        :on="allowSSLVerification"
        @change="allowSSLVerification = !allowSSLVerification"
      />
      Verify SSL Certificates
    </div>

    <div class="flex space-x-4">
      <HoppButtonSecondary
        :icon="IconLucideFileBadge"
        :label="'CA Certificates'"
        outline
        @click="showCACertificatesModal = true"
      />
      <HoppButtonSecondary
        :icon="IconLucideFileKey"
        :label="'Client Certificates'"
        @click="showClientCertificatesModal = true"
        outline
      />
    </div>

    <ModalsNativeCACertificates
      :show="showCACertificatesModal"
      @hide-modal="showCACertificatesModal = false"
    />
    <ModalsNativeClientCertificates
      :show="showClientCertificatesModal"
      @hide-modal="showClientCertificatesModal = false"
    />

    <div class="pt-4 space-y-4">
      <div class="flex items-center">
        <HoppSmartToggle :on="allowProxy" @change="allowProxy = !allowProxy" />
        Use HTTP Proxy
      </div>

      <HoppSmartInput
        v-if="allowProxy"
        v-model="proxyURL"
        :autofocus="false"
        styles="flex-1"
        placeholder=" "
        :label="'Proxy URL'"
        input-styles="input floating-input"
      />

      <p class="my-1 text-secondaryLight">
        Hoppscotch native interceptor supports HTTP/HTTPS/SOCKS proxies along with NTLM and Basic Auth in those proxies. Include the username and password for the proxy authentication in the URL itself.
      </p>
    </div>
  </div>
</template>

<!-- TODO: i18n -->
<script setup lang="ts">
import { computed, ref } from "vue"
import IconLucideFileBadge from "~icons/lucide/file-badge"
import IconLucideFileKey from "~icons/lucide/file-key"
import { useService } from "dioc/vue"
import { RequestDef, NativeInterceptorService } from "@platform/interceptors/native"
import { syncRef } from "@vueuse/core"

type RequestProxyInfo = RequestDef["proxy"]

const nativeInterceptorService = useService(NativeInterceptorService)

const allowSSLVerification = nativeInterceptorService.validateCerts

const showCACertificatesModal = ref(false)
const showClientCertificatesModal = ref(false)

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

syncRef(nativeInterceptorService.proxyInfo, proxyInfo, { direction: "both" })
</script>
