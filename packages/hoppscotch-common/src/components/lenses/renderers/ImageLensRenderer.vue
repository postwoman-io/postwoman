<template>
  <div>
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
    <img
      class="max-w-full"
      :src="imageSource"
      loading="lazy"
      :alt="imageSource"
    />
  </div>
</template>

<script setup lang="ts">
import { useI18n } from "@composables/i18n"
import { defineActionHandler } from "~/helpers/actions"
import { getPlatformSpecialKey as getSpecialKey } from "~/helpers/platformutils"
import { computed, onMounted, ref, watch } from "vue"
import { HoppRESTResponse } from "~/helpers/types/HoppRESTResponse"
import { useDownloadResponse } from "~/composables/lens-actions"
import { flow, pipe } from "fp-ts/function"
import * as S from "fp-ts/string"
import * as RNEA from "fp-ts/ReadonlyNonEmptyArray"
import * as A from "fp-ts/Array"
import * as O from "fp-ts/Option"
import { objFieldMatches } from "~/helpers/functional/object"

const t = useI18n()

const props = defineProps<{
  response: HoppRESTResponse & { type: "success" | "fail" }
}>()

const imageSource = ref("")

const responseType = computed(() =>
  pipe(
    props.response,
    O.fromPredicate(objFieldMatches("type", ["fail", "success"] as const)),
    O.chain(
      // Try getting content-type
      flow(
        (res) => res.headers,
        A.findFirst((h) => h.key.toLowerCase() === "content-type"),
        O.map(flow((h) => h.value, S.split(";"), RNEA.head, S.toLowerCase))
      )
    ),
    O.getOrElse(() => "text/plain")
  )
)

const { downloadIcon, downloadResponse } = useDownloadResponse(
  responseType.value,
  computed(() => props.response.body),
  t("filename.lens", {
    request_name: props.response.req.name,
  })
)

watch(props.response, () => {
  imageSource.value = ""
  const buf = props.response.body
  const bytes = new Uint8Array(buf)
  const blob = new Blob([bytes.buffer], { type: responseType.value })

  const reader = new FileReader()
  reader.onload = ({ target }) => {
    // target.result will always be string because we're using FileReader.readAsDataURL
    imageSource.value = target!.result as string
  }
  reader.readAsDataURL(blob)
})

onMounted(() => {
  imageSource.value = ""
  const buf = props.response.body
  const bytes = new Uint8Array(buf)
  const blob = new Blob([bytes.buffer], { type: responseType.value })

  const reader = new FileReader()
  reader.onload = ({ target }) => {
    // target.result will always be string because we're using FileReader.readAsDataURL
    imageSource.value = target!.result as string
  }
  reader.readAsDataURL(blob)
})

defineActionHandler("response.file.download", () => downloadResponse())
</script>
