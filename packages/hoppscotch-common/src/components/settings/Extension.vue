<template>
  <div class="my-1 text-secondaryLight">
    <span v-if="extensionVersion != null">
      {{
        `${t("settings.extension_version")}: v${extensionVersion.major}.${
          extensionVersion.minor
        }`
      }}
    </span>
    <span v-else>
      {{ t("settings.extension_version") }}:
      {{ t("settings.extension_ver_not_reported") }}
    </span>
  </div>
  <div class="flex gap-2 py-2 w-fit">
    <HoppSmartItem
      to="https://chrome.google.com/webstore/detail/hoppscotch-browser-extens/amknoiejhlmhancpahfcfcfhllgkpbld"
      blank
      :icon="IconChrome"
      label="Chrome"
      :info-icon="hasChromeExtInstalled ? IconCheckCircle : undefined"
      :active-info-icon="hasChromeExtInstalled"
      outline
    />
    <HoppSmartItem
      to="https://addons.mozilla.org/en-US/firefox/addon/hoppscotch"
      blank
      :icon="IconFirefox"
      label="Firefox"
      :info-icon="hasFirefoxExtInstalled ? IconCheckCircle : undefined"
      :active-info-icon="hasFirefoxExtInstalled"
      outline
    />
  </div>
</template>

<script setup lang="ts">
import IconChrome from "~icons/brands/chrome"
import IconFirefox from "~icons/brands/firefox"
import IconCheckCircle from "~icons/lucide/check-circle"
import { useI18n } from "@composables/i18n"
import { ExtensionInterceptorService } from "~/platform/std/interceptors/extension"
import { useService } from "dioc/vue"

const t = useI18n()

const extensionService = useService(ExtensionInterceptorService)

const extensionVersion = extensionService.extensionVersion
const hasChromeExtInstalled = extensionService.chromeExtensionInstalled
const hasFirefoxExtInstalled = extensionService.firefoxExtensionInstalled
</script>
