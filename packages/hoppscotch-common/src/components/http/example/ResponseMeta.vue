<template>
  <div
    class="sticky top-0 z-50 flex-none flex-shrink-0 items-center justify-center whitespace-nowrap bg-primary p-4"
  >
    <div v-if="responseCtx" class="flex flex-1 flex-col">
      <div class="flex items-center text-tiny font-semibold">
        <div class="inline-flex flex-1 space-x-4">
          <div class="flex-1 flex items-center space-x-2">
            <span class="text-secondary"> {{ t("response.status") }}: </span>
            <div class="flex-1 flex whitespace-nowrap max-w-xs">
              <SmartEnvInput
                v-model="status"
                :auto-complete-source="getStatusCodeOptions"
                class="flex-1 border border-divider"
                @update:model-value="
                  (statusCode: string) => {
                    setResponseStatusCode(statusCode)
                  }
                "
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue"
import { useI18n } from "@composables/i18n"
import {
  getFullStatusCodePhrase,
  getStatusCodePhrase,
  getStatusAndCode,
  isValidStatusCode,
} from "~/helpers/utils/statusCodes"
import { HoppRESTRequestResponse } from "@hoppscotch/data"
import { useVModel } from "@vueuse/core"

const t = useI18n()

const props = defineProps<{
  response: HoppRESTRequestResponse
}>()

const emit = defineEmits<{
  (e: "update:response", val: HoppRESTRequestResponse): void
}>()

const responseCtx = useVModel(props, "response", emit)

const status = ref(
  getStatusCodePhrase(responseCtx.value.code, responseCtx.value.status)
)

const getStatusCodeOptions = computed(() => {
  return getFullStatusCodePhrase()
})

const setResponseStatusCode = (statusCode: string) => {
  if (!isValidStatusCode(statusCode)) {
    responseCtx.value.status = statusCode
    responseCtx.value.code = undefined
    return
  }
  responseCtx.value.code = getStatusAndCode(statusCode).code
  responseCtx.value.status = getStatusAndCode(statusCode).status
}
</script>
