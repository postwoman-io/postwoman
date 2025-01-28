<template>
  <div
    class="sticky top-0 z-10 flex flex-shrink-0 space-x-2 overflow-x-auto bg-primary p-4"
  >
    <div class="inline-flex flex-1 space-x-2">
      <input
        id="url"
        v-model="url"
        type="url"
        autocomplete="off"
        spellcheck="false"
        class="w-full rounded border border-divider bg-primaryLight px-4 py-2 text-secondaryDark"
        :placeholder="`${t('graphql.url_placeholder')}`"
        :disabled="connected"
        @keyup.enter="onConnectClick"
      />
      <HoppButtonPrimary
        id="get"
        name="get"
        :loading="connection.state === 'CONNECTING'"
        :label="!connected ? t('action.connect') : t('action.disconnect')"
        class="w-32"
        @click="onConnectClick"
      />
    </div>
  </div>
  <HoppSmartModal
    v-if="connectionSwitchModal"
    dialog
    :dimissible="false"
    :title="t('graphql.switch_connection')"
    @close="connectionSwitchModal = false"
  >
    <template #body>
      <p class="mb-4">
        {{ t("graphql.connection_switch_url") }}:
        <kbd class="shortcut-key !ml-0"> {{ lastTwoUrls.at(0) }} </kbd>
      </p>
      <p class="mb-4">
        {{ t("graphql.connection_switch_new_url") }}:
        <kbd class="shortcut-key !ml-0"> {{ lastTwoUrls.at(1) }} </kbd>
      </p>
      <p>{{ t("graphql.connection_switch_confirm") }}</p>
    </template>
    <template #footer>
      <span class="flex space-x-2">
        <HoppButtonPrimary
          :label="t('action.connect')"
          :loading="connection.state === 'CONNECTING'"
          outline
          @click="switchConnection()"
        />
        <HoppButtonSecondary
          :label="t('action.cancel')"
          outline
          filled
          @click="cancelSwitch()"
        />
      </span>
    </template>
  </HoppSmartModal>
</template>

<script setup lang="ts">
import { platform } from "~/platform"
import { useI18n } from "@composables/i18n"
import { computed, ref, watch } from "vue"
import { connection } from "~/helpers/graphql/connection"
import { connect } from "~/helpers/graphql/connection"
import { disconnect } from "~/helpers/graphql/connection"
import { useService } from "dioc/vue"
import { defineActionHandler } from "~/helpers/actions"
import { GQLTabService } from "~/services/tab/graphql"
import { KernelInterceptorService } from "~/services/kernel-interceptor.service"

const t = useI18n()
const tabs = useService(GQLTabService)

const interceptorService = useService(KernelInterceptorService)

const connectionSwitchModal = ref(false)

const connected = computed(() => connection.state === "CONNECTED")

const url = computed({
  get: () => tabs.currentActiveTab.value?.document.request.url ?? "",
  set: (value) => {
    tabs.currentActiveTab.value!.document.request.url = value
  },
})

const onConnectClick = () => {
  if (!connected.value) {
    gqlConnect()
  } else {
    disconnect()
  }
}

const gqlConnect = () => {
  connect(url.value, tabs.currentActiveTab.value?.document.request.headers)

  platform.analytics?.logEvent({
    type: "HOPP_REQUEST_RUN",
    platform: "graphql-schema",
    strategy: interceptorService.current.value!.id,
  })
}

const switchConnection = () => {
  gqlConnect()
  connectionSwitchModal.value = false
}

const lastTwoUrls = ref<string[]>([])

watch(
  tabs.currentActiveTab,
  (newVal) => {
    if (newVal) {
      lastTwoUrls.value.push(newVal.document.request.url)
      if (lastTwoUrls.value.length > 2) {
        lastTwoUrls.value.shift()
      }
    }

    if (
      connected.value &&
      lastTwoUrls.value.length === 2 &&
      lastTwoUrls.value.at(0) !== lastTwoUrls.value.at(1)
    ) {
      disconnect()
      connectionSwitchModal.value = true
    }
  },
  {
    immediate: true,
  }
)

const cancelSwitch = () => {
  if (connected.value) disconnect()
  connectionSwitchModal.value = false
}

defineActionHandler(
  "gql.connect",
  gqlConnect,
  computed(() => !connected.value)
)

defineActionHandler("gql.disconnect", disconnect, connected)
</script>
