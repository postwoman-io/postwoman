<template>
  <div class="flex flex-1 flex-col">
    <div
      class="sticky top-lowerSecondaryStickyFold z-10 flex flex-shrink-0 items-center justify-between overflow-x-auto border-b border-dividerLight bg-primary pl-4"
    >
      <label class="truncate font-semibold text-secondaryLight">
        {{ t("response.body") }}
      </label>
      <div class="flex">
        <HoppButtonSecondary
          v-if="response.body"
          v-tippy="{ theme: 'tooltip', allowHTML: true }"
          :title="`${t(
            'action.download_file'
          )} <kbd>${getSpecialKey()}</kbd><kbd>J</kbd>`"
          :icon="downloadIcon"
          @click="downloadResponse"
        />
      </div>
    </div>
    <vue-pdf-embed
      :source="pdfsrc"
      class="flex flex-1 overflow-auto border-b border-dividerLight"
      type="application/pdf"
    />
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue"
import VuePdfEmbed from "vue-pdf-embed"
import { useI18n } from "@composables/i18n"
import { useDownloadResponse } from "@composables/lens-actions"
import { HoppRESTResponse } from "~/helpers/types/HoppRESTResponse"
import { defineActionHandler } from "~/helpers/actions"
import { getPlatformSpecialKey as getSpecialKey } from "~/helpers/platformutils"

const t = useI18n()

const props = defineProps<{
  response: HoppRESTResponse & {
    type: "success" | "fail"
  }
}>()

const pdfsrc = computed(() =>
  URL.createObjectURL(
    new Blob([props.response.body], {
      type: "application/pdf",
    })
  )
)

const filename = t("filename.lens", {
  request_name: props.response.req.name,
})

const { downloadIcon, downloadResponse } = useDownloadResponse(
  "application/pdf",
  computed(() => props.response.body),
  `${filename}.pdf`
)

defineActionHandler("response.file.download", () => downloadResponse())
</script>
