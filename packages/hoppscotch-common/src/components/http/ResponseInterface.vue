<template>
  <HoppSmartSlideOver
    :show="show"
    :title="t('response.data_schema')"
    @close="close()"
  >
    <template #content>
      <div v-if="response" class="flex flex-col px-4 flex-1 overflow-y-auto">
        <div class="flex flex-col">
          <tippy
            interactive
            trigger="click"
            theme="popover"
            placement="bottom"
            :on-shown="() => tippyActions.focus()"
            class="mt-4"
          >
            <HoppSmartSelectWrapper>
              <HoppButtonSecondary
                :label="selectedInterface"
                outline
                class="flex-1 pr-8"
              />
            </HoppSmartSelectWrapper>
            <template #content="{ hide }">
              <div class="flex flex-col space-y-2">
                <div class="sticky top-0 z-10 flex-shrink-0 overflow-x-auto">
                  <input
                    v-model="searchQuery"
                    type="search"
                    autocomplete="off"
                    class="input flex w-full !bg-primaryContrast p-4 py-2"
                    :placeholder="`${t('action.search')}`"
                  />
                </div>
                <div
                  ref="tippyActions"
                  class="flex flex-col focus:outline-none"
                  tabindex="0"
                  @keyup.escape="hide()"
                >
                  <HoppSmartItem
                    v-for="lang in filteredResponseInterfaces"
                    :key="lang"
                    :label="lang"
                    :info-icon="
                      lang === selectedInterface ? IconCheck : undefined
                    "
                    :active-info-icon="lang === selectedInterface"
                    @click="
                      () => {
                        selectedInterface = lang
                        hide()
                      }
                    "
                  />
                  <HoppSmartPlaceholder
                    v-if="filteredResponseInterfaces.length === 0"
                    :text="`${t('state.nothing_found')} ‟${searchQuery}”`"
                  >
                    <template #icon>
                      <icon-lucide-search class="svg-icons opacity-75" />
                    </template>
                  </HoppSmartPlaceholder>
                </div>
              </div>
            </template>
          </tippy>
        </div>
        <div
          v-if="errorState"
          class="my-4 w-full overflow-auto whitespace-normal rounded bg-primaryLight px-4 font-mono text-red-400"
        >
          {{ t("error.something_went_wrong") }}
        </div>
        <div
          v-else-if="selectedInterface"
          class="my-4 rounded border border-dividerLight flex-1 overflow-hidden flex flex-col"
        >
          <div class="flex items-center justify-between pl-4">
            <label class="truncate font-semibold text-secondaryLight">
              {{ t("request.generated_code") }}
            </label>
            <div class="flex items-center">
              <HoppButtonSecondary
                v-tippy="{ theme: 'tooltip' }"
                :title="t('state.linewrap')"
                :class="{ '!text-accent': WRAP_LINES }"
                :icon="IconWrapText"
                @click.prevent="toggleNestedSetting('WRAP_LINES', 'codeGen')"
              />
              <HoppButtonSecondary
                v-tippy="{ theme: 'tooltip', allowHTML: true }"
                :title="t('action.download_file')"
                :icon="downloadIcon"
                @click="downloadResponse"
              />
              <HoppButtonSecondary
                v-tippy="{ theme: 'tooltip', allowHTML: true }"
                :title="t('action.copy')"
                :icon="copyIcon"
                @click="copyResponse"
              />
            </div>
          </div>
          <div
            class="h-full relative w-full flex flex-col flex-1 rounded-b border-t border-dividerLight"
          >
            <div ref="generatedCode" class="absolute inset-0"></div>
          </div>
        </div>
      </div>

      <HoppSmartPlaceholder
        v-else
        :src="`/images/states/${colorMode.value}/add_files.svg`"
        :alt="`${t('empty.response')}`"
        :text="`${t('empty.response')}`"
      >
      </HoppSmartPlaceholder>
    </template>
  </HoppSmartSlideOver>
</template>

<script setup lang="ts">
import { useCodemirror } from "@composables/codemirror"
import { useI18n } from "@composables/i18n"
import { computed, reactive, ref } from "vue"
import {
  getResponseBodyText,
  useCopyResponse,
  useDownloadResponse,
} from "~/composables/lens-actions"

import { useService } from "dioc/vue"
import { useNestedSetting } from "~/composables/settings"
import interfaceLanguages from "~/helpers/utils/interfaceLanguages"
import { toggleNestedSetting } from "~/newstore/settings"
import { RESTTabService } from "~/services/tab/rest"
import IconCheck from "~icons/lucide/check"
import IconWrapText from "~icons/lucide/wrap-text"
import jsonToLanguage from "~/helpers/utils/json-to-language"
import { watch } from "vue"
import { GQLTabService } from "~/services/tab/graphql"
import { useColorMode } from "~/composables/theming"

const t = useI18n()
const colorMode = useColorMode()

defineProps<{
  show: boolean
}>()

const emit = defineEmits<{
  (e: "close"): void
}>()

const restTabs = useService(RESTTabService)
const gqlTabs = useService(GQLTabService)

function getCurrentPageCategory(): "graphql" | "rest" | "other" {
  try {
    const url = new URL(window.location.href)

    if (url.pathname.startsWith("/graphql")) {
      return "graphql"
    } else if (url.pathname === "/") {
      return "rest"
    }
    return "other"
  } catch (e) {
    return "other"
  }
}

const selectedInterface = ref<(typeof interfaceLanguages)[number]>("TypeScript")
const response = computed(() => {
  let response = ""
  const pageCategory = getCurrentPageCategory()

  if (pageCategory === "rest") {
    const doc = restTabs.currentActiveTab.value.document
    if (doc.type === "request") {
      const res = doc.response
      if (res?.type === "success" || res?.type === "fail") {
        response = getResponseBodyText(res.body)
      }
    } else {
      const res = doc.response.body
      response = res
    }
  }

  if (pageCategory === "graphql") {
    const res = gqlTabs.currentActiveTab.value.document.response
    if (res && res.length === 1 && res[0].type === "response" && res[0].data) {
      response = JSON.stringify(JSON.parse(res[0].data), null, 2)
    }
  }

  return response
})
const errorState = ref(false)

const interfaceCode = ref("")

const setInterfaceCode = async () => {
  const res = await jsonToLanguage(
    selectedInterface.value,
    response.value || "{}"
  ) // to avoid possible errors empty object is passed
  interfaceCode.value = res.lines.join("\n")
}

watch(selectedInterface, setInterfaceCode)
watch(response, setInterfaceCode, { immediate: true })

const close = () => {
  emit("close")
}

// Template refs
const tippyActions = ref<any | null>(null)
const generatedCode = ref<any | null>(null)
const WRAP_LINES = useNestedSetting("WRAP_LINES", "codeGen")

useCodemirror(
  generatedCode,
  interfaceCode,
  reactive({
    extendedEditorConfig: {
      mode: "text/plain",
      readOnly: true,
      lineWrapping: WRAP_LINES,
    },
    linter: null,
    completer: null,
    environmentHighlights: false,
  })
)

const searchQuery = ref("")

const filteredResponseInterfaces = computed(() => {
  return interfaceLanguages.filter((lang) =>
    lang.toLowerCase().includes(searchQuery.value.toLowerCase())
  )
})

const { copyIcon, copyResponse } = useCopyResponse(interfaceCode)
const { downloadIcon, downloadResponse } = useDownloadResponse(
  "",
  interfaceCode,
  t("filename.response_interface")
)
</script>
