<template>
  <div class="flex flex-1 flex-col">
    <div
      class="sticky top-lowerSecondaryStickyFold z-10 flex flex-shrink-0 items-center justify-between overflow-x-auto border-b border-dividerLight bg-primary pl-4"
      :class="{ 'py-2': !responseBodyText }"
    >
      <label class="truncate font-semibold text-secondaryLight">
        {{ t("response.body") }}
      </label>
      <div class="flex">
        <HoppButtonSecondary
          v-if="response.body && !previewEnabled"
          v-tippy="{ theme: 'tooltip' }"
          :title="t('state.linewrap')"
          :class="{ '!text-accent': WRAP_LINES }"
          :icon="IconWrapText"
          @click.prevent="toggleNestedSetting('WRAP_LINES', 'httpResponseBody')"
        />
        <HoppButtonSecondary
          v-if="response.body"
          v-tippy="{ theme: 'tooltip', allowHTML: true }"
          :title="`${
            previewEnabled ? t('hide.preview') : t('response.preview_html')
          } <kbd>${getSpecialKey()}</kbd><kbd>Shift</kbd><kbd>P</kbd>`"
          :icon="!previewEnabled ? IconEye : IconEyeOff"
          @click.prevent="doTogglePreview"
        />
        <HoppButtonSecondary
          v-if="response.body"
          v-tippy="{ theme: 'tooltip', allowHTML: true }"
          :title="`${t(
            'action.download_file'
          )} <kbd>${getSpecialKey()}</kbd><kbd>J</kbd>`"
          :icon="downloadIcon"
          @click="downloadResponse"
        />
        <HoppButtonSecondary
          v-if="response.body"
          v-tippy="{ theme: 'tooltip', allowHTML: true }"
          :title="
            isSavable
              ? `${t(
                  'action.save_as_example'
                )} <kbd>${getSpecialKey()}</kbd><kbd>E</kbd>`
              : t('response.please_save_request')
          "
          :icon="IconSave"
          :class="{
            'opacity-75 cursor-not-allowed select-none': !isSavable,
          }"
          @click="isSavable ? saveAsExample() : null"
        />
        <HoppButtonSecondary
          v-if="response.body"
          v-tippy="{ theme: 'tooltip', allowHTML: true }"
          :title="`${t(
            'action.copy'
          )} <kbd>${getSpecialKey()}</kbd><kbd>.</kbd>`"
          :icon="copyIcon"
          @click="copyResponse"
        />
      </div>
    </div>
    <div v-show="!previewEnabled" class="h-full relative flex flex-col flex-1">
      <div ref="htmlResponse" class="absolute inset-0"></div>
    </div>
    <iframe
      v-show="previewEnabled"
      ref="previewFrame"
      class="covers-response"
      src="about:blank"
      loading="lazy"
      sandbox=""
    ></iframe>
  </div>
</template>

<script setup lang="ts">
import { useCodemirror } from "@composables/codemirror"
import { useI18n } from "@composables/i18n"
import {
  useCopyResponse,
  useDownloadResponse,
  usePreview,
  useResponseBody,
} from "@composables/lens-actions"
import { useService } from "dioc/vue"
import { reactive, ref, computed } from "vue"

import { useNestedSetting } from "~/composables/settings"
import { defineActionHandler } from "~/helpers/actions"
import { getPlatformSpecialKey as getSpecialKey } from "~/helpers/platformutils"
import type { HoppRESTResponse } from "~/helpers/types/HoppRESTResponse"
import { toggleNestedSetting } from "~/newstore/settings"
import { PersistenceService } from "~/services/persistence"
import IconEye from "~icons/lucide/eye"
import IconEyeOff from "~icons/lucide/eye-off"
import IconWrapText from "~icons/lucide/wrap-text"
import IconSave from "~icons/lucide/save"
import { HoppRESTRequestResponse } from "@hoppscotch/data"

const t = useI18n()
const persistenceService = useService(PersistenceService)

const props = defineProps<{
  response:
    | (HoppRESTResponse & { type: "success" | "fail" })
    | HoppRESTRequestResponse
  isSavable: boolean
  isEditable: boolean
}>()

const emit = defineEmits<{
  (e: "save-as-example"): void
}>()

const htmlResponse = ref<any | null>(null)
const WRAP_LINES = useNestedSetting("WRAP_LINES", "httpResponseBody")

const responseName = computed(() => {
  if ("type" in props.response) {
    if (props.response.type === "success" || props.response.type === "fail") {
      return props.response.req.name
    }
    return "Untitled"
  }

  return props.response.name
})

const { responseBodyText } = useResponseBody(props.response)
const { downloadIcon, downloadResponse } = useDownloadResponse(
  "text/html",
  responseBodyText,
  t("filename.lens", {
    request_name: responseName.value,
  })
)
const defaultPreview =
  persistenceService.getLocalConfig("lens_html_preview") === "true"

const { previewFrame, previewEnabled, togglePreview } = usePreview(
  defaultPreview,
  responseBodyText
)

const doTogglePreview = () => {
  persistenceService.setLocalConfig(
    "lens_html_preview",
    previewEnabled.value ? "false" : "true"
  )
  togglePreview()
}

const { copyIcon, copyResponse } = useCopyResponse(responseBodyText)

const saveAsExample = () => {
  emit("save-as-example")
}

useCodemirror(
  htmlResponse,
  responseBodyText,
  reactive({
    extendedEditorConfig: {
      mode: "htmlmixed",
      readOnly: !props.isEditable,
      lineWrapping: WRAP_LINES,
    },
    linter: null,
    completer: null,
    environmentHighlights: true,
  })
)

defineActionHandler("response.preview.toggle", () => doTogglePreview())
defineActionHandler("response.file.download", () => downloadResponse())
defineActionHandler("response.copy", () => copyResponse())
defineActionHandler("response.save-as-example", () => {
  props.isSavable ? saveAsExample() : null
})
</script>

<style lang="scss" scoped>
.covers-response {
  @apply bg-white;
  @apply h-full;
  @apply w-full;
  @apply border;
  @apply border-dividerLight;
  @apply z-10;
}
</style>
