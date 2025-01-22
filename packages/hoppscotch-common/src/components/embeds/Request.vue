<template>
  <div class="sticky top-0 z-10">
    <div
      class="flex-none flex-shrink-0 p-4 bg-primary sm:flex sm:flex-shrink-0 sm:space-x-2"
    >
      <div
        class="flex flex-1 overflow-hidden border divide-x rounded text-secondaryDark divide-divider min-w-[12rem] overflow-x-auto border-divider"
      >
        <span
          class="flex items-center justify-center px-4 py-2 font-semibold transition rounded-l"
        >
          {{ tab.document.request.method }}
        </span>
        <div
          class="flex items-center flex-1 flex-shrink-0 min-w-0 truncate rounded-r"
        >
          <SmartEnvInput
            v-model="tab.document.request.endpoint"
            :readonly="true"
            :envs="tabRequestVariables"
          />
        </div>
      </div>
      <div class="flex mt-2 space-x-2 sm:mt-0">
        <HoppButtonPrimary
          id="send"
          :title="`${t(
            'action.send'
          )} <kbd>${getSpecialKey()}</kbd><kbd>↩</kbd>`"
          :label="`${!loading ? t('action.send') : t('action.cancel')}`"
          class="flex-1 min-w-20"
          outline
          @click="!loading ? newSendRequest() : cancelRequest()"
        />
        <div class="flex">
          <HoppButtonSecondary
            :title="`${t(
              'request.save'
            )} <kbd>${getSpecialKey()}</kbd><kbd>S</kbd>`"
            :label="t('request.save')"
            filled
            :icon="IconSave"
            class="flex-1 rounded"
            blank
            outline
            :to="sharedRequestURL"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { getPlatformSpecialKey as getSpecialKey } from "~/helpers/platformutils"
import IconSave from "~icons/lucide/save"
import { Ref } from "vue"
import { computed, useModel } from "vue"
import { ref } from "vue"
import { useI18n } from "~/composables/i18n"
import { useToast } from "~/composables/toast"
import * as E from "fp-ts/Either"
import { useStreamSubscriber } from "~/composables/stream"
import { HoppRESTResponse } from "~/helpers/types/HoppRESTResponse"
import { runRESTRequest$ } from "~/helpers/RequestRunner"
import { HoppTab } from "~/services/tab"
import { HoppRequestDocument } from "~/helpers/rest/document"

const toast = useToast()
const t = useI18n()

const props = defineProps<{
  modelTab: HoppTab<HoppRequestDocument>
  sharedRequestURL: string
}>()

const tab = useModel(props, "modelTab")

const requestCancelFunc: Ref<(() => void) | null> = ref(null)

const loading = ref(false)

const tabRequestVariables = computed(() => {
  return tab.value.document.request.requestVariables.map(({ key, value }) => ({
    key,
    value,
    secret: false,
    sourceEnv: "RequestVariable",
  }))
})

const { subscribeToStream } = useStreamSubscriber()

const newSendRequest = async () => {
  if (newEndpoint.value === "" || /^\s+$/.test(newEndpoint.value)) {
    toast.error(`${t("empty.endpoint")}`)
    return
  }

  ensureMethodInEndpoint()

  loading.value = true

  const [cancel, streamPromise] = runRESTRequest$(tab)
  const streamResult = await streamPromise

  requestCancelFunc.value = cancel
  if (E.isRight(streamResult)) {
    subscribeToStream(
      streamResult.right,
      (responseState) => {
        if (loading.value) {
          // Check exists because, loading can be set to false
          // when cancelled
          updateRESTResponse(responseState)
        }
      },
      () => {
        loading.value = false
      },
      () => {
        // TODO: Change this any to a proper type
        const result = (streamResult.right as any).value
        if (
          result.type === "network_fail" &&
          result.error?.error === "NO_PW_EXT_HOOK"
        ) {
          const errorResponse: HoppRESTResponse = {
            type: "extension_error",
            error: result.error.humanMessage.heading,
            component: result.error.component,
            req: result.req,
          }
          updateRESTResponse(errorResponse)
        }
        loading.value = false
      }
    )
  } else {
    loading.value = false
    toast.error(`${t("error.script_fail")}`)
    let error: Error
    if (typeof streamResult.left === "string") {
      error = { name: "RequestFailure", message: streamResult.left }
    } else {
      error = streamResult.left
    }
    updateRESTResponse({
      type: "script_fail",
      error,
    })
  }
}

const updateRESTResponse = (response: HoppRESTResponse | null) => {
  tab.value.document.response = response
}

const newEndpoint = computed(() => {
  return tab.value.document.request.endpoint
})

const ensureMethodInEndpoint = () => {
  if (
    !/^http[s]?:\/\//.test(newEndpoint.value) &&
    !newEndpoint.value.startsWith("<<")
  ) {
    const domain = newEndpoint.value.split(/[/:#?]+/)[0]
    if (domain === "localhost" || /([0-9]+\.)*[0-9]/.test(domain)) {
      tab.value.document.request.endpoint =
        "http://" + tab.value.document.request.endpoint
    } else {
      tab.value.document.request.endpoint =
        "https://" + tab.value.document.request.endpoint
    }
  }
}

const cancelRequest = () => {
  loading.value = false
  requestCancelFunc.value?.()

  updateRESTResponse(null)
}
</script>
