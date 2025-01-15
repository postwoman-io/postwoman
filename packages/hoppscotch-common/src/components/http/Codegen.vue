<template>
  <div class="flex flex-col">
    <label v-if="!hideLabel" for="requestType" class="px-4 pb-4">
      {{ t("request.choose_language") }}
    </label>
    <tippy
      interactive
      trigger="click"
      theme="popover"
      placement="bottom"
      :on-shown="() => tippyActions.focus()"
    >
      <HoppSmartSelectWrapper>
        <HoppButtonSecondary
          :label="
            CodegenDefinitions.find((x) => x.name === codegenType)!.caption
          "
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
              v-for="codegen in filteredCodegenDefinitions"
              :key="codegen.name"
              :label="codegen.caption"
              :info-icon="codegen.name === codegenType ? IconCheck : undefined"
              :active-info-icon="codegen.name === codegenType"
              @click="
                () => {
                  codegenType = codegen.name
                  hide()
                }
              "
            />
            <HoppSmartPlaceholder
              v-if="filteredCodegenDefinitions.length === 0"
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
    <div
      v-if="errorState"
      class="mt-4 w-full overflow-auto whitespace-normal rounded bg-primaryLight px-4 py-2 font-mono text-red-400"
    >
      {{ t("error.something_went_wrong") }}
    </div>
    <div
      v-else-if="codegenType"
      class="mt-4 rounded border border-dividerLight"
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
        ref="generatedCode"
        class="rounded-b border-t border-dividerLight"
      ></div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useCodemirror } from "@composables/codemirror"
import { useI18n } from "@composables/i18n"
import {
  Environment,
  HoppRESTAuth,
  HoppRESTHeaders,
  makeRESTRequest,
} from "@hoppscotch/data"
import * as O from "fp-ts/Option"
import { computed, reactive, ref } from "vue"
import {
  useCopyResponse,
  useDownloadResponse,
} from "~/composables/lens-actions"
import {
  CodegenDefinitions,
  CodegenName,
  generateCode,
} from "~/helpers/new-codegen"
import {
  getEffectiveRESTRequest,
  resolvesEnvsInBody,
} from "~/helpers/utils/EffectiveURL"
import { getAggregateEnvs } from "~/newstore/environments"

import { useService } from "dioc/vue"
import cloneDeep from "lodash-es/cloneDeep"
import { onMounted } from "vue"
import { useNestedSetting } from "~/composables/settings"
import { toggleNestedSetting } from "~/newstore/settings"
import { platform } from "~/platform"
import { RESTTabService } from "~/services/tab/rest"
import IconCheck from "~icons/lucide/check"
import IconWrapText from "~icons/lucide/wrap-text"
import { asyncComputed } from "@vueuse/core"
import { getDefaultRESTRequest } from "~/helpers/rest/default"

const t = useI18n()

const tabs = useService(RESTTabService)

// Get the current active request if the current active tab is a request else get the original request from the response tab
const currentActiveRequest = computed(() => {
  let effectiveRequest = null

  if (currentActiveTabDocument.value.type === "request") {
    effectiveRequest = currentActiveTabDocument.value.request
  }

  if (currentActiveTabDocument.value.type === "example-response") {
    effectiveRequest = makeRESTRequest({
      ...getDefaultRESTRequest(),
      ...currentActiveTabDocument.value.response.originalRequest,
    })
  }

  return cloneDeep(effectiveRequest) ?? getDefaultRESTRequest()
})

// Retrieve the document
const currentActiveTabDocument = computed(() =>
  cloneDeep(tabs.currentActiveTab.value.document)
)

const codegenType = ref<CodegenName>("shell-curl")
const errorState = ref(false)

defineProps({
  hideLabel: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits<{
  (e: "request-code", value: string): void
}>()

const requestCode = asyncComputed(async () => {
  // Generate code snippet action only applies to request documents
  if (currentActiveTabDocument.value.type !== "request") {
    errorState.value = true
    return ""
  }

  const aggregateEnvs = getAggregateEnvs()
  const requestVariables = currentActiveRequest.value?.requestVariables.map(
    (requestVariable) => {
      if (requestVariable.active)
        return {
          key: requestVariable.key,
          value: requestVariable.value,
          secret: false,
        }
      return {}
    }
  )
  const env: Environment = {
    v: 1,
    id: "env",
    name: "Env",
    variables: [
      ...(requestVariables as Environment["variables"]),
      ...aggregateEnvs,
    ],
  }

  // Calculating this before to keep the reactivity as asyncComputed will lose
  // reactivity tracking after the await point
  const lang = codegenType.value

  let requestHeaders: HoppRESTHeaders = []
  let requestAuth: HoppRESTAuth = { authType: "none", authActive: false }

  // Add inherited headers and auth from the parent
  const { auth, headers } = currentActiveRequest.value
  const { inheritedProperties } = currentActiveTabDocument.value

  requestAuth =
    auth.authType === "inherit" && auth.authActive
      ? (inheritedProperties?.auth?.inheritedAuth as HoppRESTAuth)
      : auth

  const inheritedHeaders =
    inheritedProperties?.headers?.flatMap((header) => header.inheritedHeader) ??
    []

  requestHeaders = [...inheritedHeaders, ...headers]

  const finalRequest = {
    ...currentActiveRequest.value,
    auth: requestAuth,
    headers: requestHeaders,
  }

  const effectiveRequest = await getEffectiveRESTRequest(
    finalRequest,
    env,
    true
  )

  const result = generateCode(
    lang,
    makeRESTRequest({
      ...effectiveRequest,
      body: resolvesEnvsInBody(effectiveRequest.body, env),
      headers: effectiveRequest.effectiveFinalHeaders.map((header) => ({
        ...header,
        active: true,
      })),
      params: effectiveRequest.effectiveFinalParams.map((param) => ({
        ...param,
        active: true,
      })),
      endpoint: effectiveRequest.effectiveFinalURL,
      requestVariables: effectiveRequest.effectiveFinalRequestVariables.map(
        (requestVariable) => ({
          ...requestVariable,
          active: true,
        })
      ),
    })
  )

  if (O.isSome(result)) {
    errorState.value = false
    emit("request-code", result.value)
    return result.value
  }
  errorState.value = true
  return ""
})

// Template refs
const tippyActions = ref<any | null>(null)
const generatedCode = ref<any | null>(null)
const WRAP_LINES = useNestedSetting("WRAP_LINES", "codeGen")

useCodemirror(
  generatedCode,
  requestCode,
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

onMounted(() => {
  platform.analytics?.logEvent({
    type: "HOPP_REST_CODEGEN_OPENED",
  })
})

const searchQuery = ref("")

const filteredCodegenDefinitions = computed(() => {
  return CodegenDefinitions.filter((obj) =>
    Object.values(obj).some((val) =>
      val.toLowerCase().includes(searchQuery.value.toLowerCase())
    )
  )
})

const { copyIcon, copyResponse } = useCopyResponse(requestCode)
const { downloadIcon, downloadResponse } = useDownloadResponse(
  "",
  requestCode,
  t("filename.codegen", {
    request_name: currentActiveRequest.value.name,
  })
)
</script>
