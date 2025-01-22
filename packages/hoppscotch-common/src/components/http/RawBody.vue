<template>
  <div class="flex flex-1 flex-col">
    <div
      class="sticky top-upperMobileStickyFold z-10 flex flex-shrink-0 items-center justify-between overflow-x-auto border-b border-dividerLight bg-primary pl-4 sm:top-upperMobileTertiaryStickyFold"
    >
      <label class="truncate font-semibold text-secondaryLight">
        {{ t("request.raw_body") }}
      </label>
      <div class="flex">
        <HoppButtonSecondary
          v-tippy="{ theme: 'tooltip' }"
          to="https://docs.hoppscotch.io/documentation/getting-started/rest/uploading-data"
          blank
          :title="t('app.wiki')"
          :icon="IconHelpCircle"
        />
        <HoppButtonSecondary
          v-tippy="{ theme: 'tooltip' }"
          :title="t('action.clear')"
          :icon="IconTrash2"
          @click="clearContent"
        />
        <HoppButtonSecondary
          v-tippy="{ theme: 'tooltip' }"
          :title="t('state.linewrap')"
          :class="{ '!text-accent': WRAP_LINES }"
          :icon="IconWrapText"
          @click.prevent="toggleNestedSetting('WRAP_LINES', 'httpRequestBody')"
        />
        <HoppButtonSecondary
          v-if="
            [
              'application/json',
              'application/ld+json',
              'application/hal+json',
              'application/vnd.api+json',
              'application/xml',
            ].includes(body.contentType)
          "
          v-tippy="{ theme: 'tooltip' }"
          :title="t('action.prettify')"
          :icon="prettifyIcon"
          @click="prettifyRequestBody"
        />
        <HoppButtonSecondary
          v-if="shouldEnableAIFeatures"
          v-tippy="{ theme: 'tooltip' }"
          :title="t('ai_experiments.modify_with_ai')"
          :icon="IconSparkles"
          @click="showModifyBodyModal"
        />
        <label for="payload">
          <HoppButtonSecondary
            v-tippy="{ theme: 'tooltip' }"
            :title="t('import.title')"
            :icon="IconFilePlus"
            @click="payload?.click()"
          />
        </label>
        <input
          ref="payload"
          class="input"
          name="payload"
          type="file"
          @change="uploadPayload($event)"
        />
      </div>
    </div>
    <div class="h-full relative flex flex-col flex-1">
      <div ref="rawBodyParameters" class="absolute inset-0"></div>
    </div>

    <AiexperimentsModifyBodyModal
      v-if="isModifyBodyModalOpen"
      :current-body="codemirrorValue ?? ''"
      @close-modal="isModifyBodyModalOpen = false"
      @update-body="(updatedBody) => (codemirrorValue = updatedBody)"
    ></AiexperimentsModifyBodyModal>
  </div>
</template>

<script setup lang="ts">
import IconHelpCircle from "~icons/lucide/help-circle"
import IconWrapText from "~icons/lucide/wrap-text"
import IconTrash2 from "~icons/lucide/trash-2"
import IconFilePlus from "~icons/lucide/file-plus"
import IconWand2 from "~icons/lucide/wand-2"
import IconCheck from "~icons/lucide/check"
import IconInfo from "~icons/lucide/info"
import IconSparkles from "~icons/lucide/sparkles"
import { computed, reactive, Ref, ref, watch } from "vue"
import * as TO from "fp-ts/TaskOption"
import { pipe } from "fp-ts/function"
import { HoppRESTReqBody, ValidContentTypes } from "@hoppscotch/data"
import { refAutoReset, useVModel } from "@vueuse/core"
import { useCodemirror } from "@composables/codemirror"
import { getEditorLangForMimeType } from "@helpers/editorutils"
import { pluckRef } from "@composables/ref"
import { useI18n } from "@composables/i18n"
import { useToast } from "@composables/toast"
import { isJSONContentType } from "~/helpers/utils/contenttypes"
import jsoncLinter from "~/helpers/editor/linting/jsonc"
import { readFileAsText } from "~/helpers/functional/files"
import xmlFormat from "xml-formatter"
import { useNestedSetting } from "~/composables/settings"
import { toggleNestedSetting } from "~/newstore/settings"
import { useAIExperiments } from "~/composables/ai-experiments"
import { prettifyJSONC } from "~/helpers/editor/linting/jsoncPretty"
import { useReadonlyStream } from "~/composables/stream"
import { platform } from "~/platform"
import { invokeAction } from "~/helpers/actions"

type PossibleContentTypes = Exclude<
  ValidContentTypes,
  "multipart/form-data" | "application/x-www-form-urlencoded"
>

type Body = HoppRESTReqBody & { contentType: PossibleContentTypes }

const props = defineProps<{
  modelValue: Body
}>()

const emit = defineEmits<{
  (e: "update:modelValue", val: Body): void
}>()

const body = useVModel(props, "modelValue", emit)

const t = useI18n()

const payload = ref<HTMLInputElement | null>(null)

const toast = useToast()

const rawParamsBody = pluckRef(body, "body")

const prettifyIcon = refAutoReset<
  typeof IconWand2 | typeof IconCheck | typeof IconInfo
>(IconWand2, 1000)

const rawInputEditorLang = computed(() =>
  getEditorLangForMimeType(body.value.contentType)
)
const langLinter = computed(() =>
  isJSONContentType(body.value.contentType) ? jsoncLinter : null
)

const WRAP_LINES = useNestedSetting("WRAP_LINES", "httpRequestBody")
const rawBodyParameters = ref<any | null>(null)

const codemirrorValue: Ref<string | undefined> =
  typeof rawParamsBody.value === "string"
    ? ref(rawParamsBody.value)
    : ref(undefined)

watch(rawParamsBody, (newVal) => {
  typeof newVal === "string"
    ? (codemirrorValue.value = newVal)
    : (codemirrorValue.value = undefined)
})

// propagate the edits from codemirror back to the body
watch(codemirrorValue, (updatedValue) => {
  if (updatedValue !== undefined && updatedValue !== rawParamsBody.value) {
    rawParamsBody.value = updatedValue
  }
})

useCodemirror(
  rawBodyParameters,
  codemirrorValue,
  reactive({
    extendedEditorConfig: {
      lineWrapping: WRAP_LINES,
      mode: rawInputEditorLang,
      placeholder: t("request.raw_body").toString(),
    },
    linter: langLinter,
    completer: null,
    environmentHighlights: true,
    predefinedVariablesHighlights: true,
  })
)

const clearContent = () => {
  rawParamsBody.value = ""
}

const uploadPayload = async (e: Event) => {
  await pipe(
    (e.target as HTMLInputElement).files?.[0],
    TO.of,
    TO.chain(TO.fromPredicate((f): f is File => f !== undefined)),
    TO.chain(readFileAsText),

    TO.matchW(
      () => toast.error(`${t("action.choose_file")}`),
      (result) => {
        rawParamsBody.value = result
        toast.success(`${t("state.file_imported")}`)
      }
    )
  )()
}

const prettifyRequestBody = () => {
  let prettifyBody = ""
  try {
    if (body.value.contentType.endsWith("json")) {
      prettifyBody = prettifyJSONC(rawParamsBody.value as string)
    } else if (body.value.contentType === "application/xml") {
      prettifyBody = prettifyXML(rawParamsBody.value as string)
    }
    rawParamsBody.value = prettifyBody
    prettifyIcon.value = IconCheck
  } catch (e) {
    console.error(e)
    prettifyIcon.value = IconInfo
    toast.error(`${t("error.json_prettify_invalid_body")}`)
  }
}

const isModifyBodyModalOpen = ref(false)

const currentUser = useReadonlyStream(
  platform.auth.getCurrentUserStream(),
  platform.auth.getCurrentUser()
)

const showModifyBodyModal = () => {
  if (!currentUser.value) {
    invokeAction("modals.login.toggle")
    return
  }

  isModifyBodyModalOpen.value = true
}

const { shouldEnableAIFeatures } = useAIExperiments()

const prettifyXML = (xml: string) => {
  return xmlFormat(xml, {
    indentation: "  ",
    collapseContent: true,
    lineSeparator: "\n",
  })
}
</script>

<style lang="scss" scoped>
:deep(.cm-panels) {
  @apply top-upperFourthStickyFold #{!important};
}
</style>
