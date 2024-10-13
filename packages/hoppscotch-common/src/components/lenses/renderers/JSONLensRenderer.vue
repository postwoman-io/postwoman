<template>
  <div v-if="showResponse" class="flex flex-1 flex-col">
    <div
      class="sticky top-lowerSecondaryStickyFold z-10 flex flex-shrink-0 items-center justify-between overflow-x-auto border-b border-dividerLight bg-primary pl-4"
      :class="{ 'py-2': !responseBodyText }"
    >
      <label class="truncate font-semibold text-secondaryLight">
        {{ t("response.body") }}
      </label>
      <div class="flex items-center">
        <HoppButtonSecondary
          v-if="showResponse"
          v-tippy="{ theme: 'tooltip' }"
          :title="t('state.linewrap')"
          :class="{ '!text-accent': WRAP_LINES }"
          :icon="IconWrapText"
          @click.prevent="toggleNestedSetting('WRAP_LINES', 'httpResponseBody')"
        />
        <HoppButtonSecondary
          v-if="showResponse"
          v-tippy="{ theme: 'tooltip' }"
          :title="t('action.filter')"
          :icon="IconFilter"
          :class="{ '!text-accent': toggleFilter }"
          @click.prevent="toggleFilterState"
        />
        <HoppButtonSecondary
          v-if="showResponse"
          v-tippy="{ theme: 'tooltip', allowHTML: true }"
          :title="`${t(
            'action.download_file'
          )} <kbd>${getSpecialKey()}</kbd><kbd>J</kbd>`"
          :icon="downloadIcon"
          @click="downloadResponse"
        />
        <HoppButtonSecondary
          v-if="showResponse && !isEditable"
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
          v-if="showResponse"
          v-tippy="{ theme: 'tooltip', allowHTML: true }"
          :title="`${t(
            'action.copy'
          )} <kbd>${getSpecialKey()}</kbd><kbd>.</kbd>`"
          :icon="copyIcon"
          @click="copyResponse"
        />
        <tippy
          v-if="showResponse"
          interactive
          trigger="click"
          theme="popover"
          :on-shown="() => copyInterfaceTippyActions.focus()"
        >
          <HoppButtonSecondary
            v-tippy="{ theme: 'tooltip' }"
            :title="t('action.more')"
            :icon="IconMore"
          />
          <template #content="{ hide }">
            <div
              ref="copyInterfaceTippyActions"
              class="flex flex-col focus:outline-none"
              tabindex="0"
              @keyup.escape="hide()"
            >
              <HoppSmartItem
                :label="t('response.generate_data_schema')"
                :icon="IconNetwork"
                @click="
                  () => {
                    invokeAction('response.schema.toggle')
                    hide()
                  }
                "
              />
            </div>
          </template>
        </tippy>
      </div>
    </div>
    <div
      v-if="toggleFilter"
      class="sticky top-lowerTertiaryStickyFold z-10 flex flex-shrink-0 overflow-x-auto border-b border-dividerLight bg-primary"
    >
      <div
        class="inline-flex flex-1 items-center border-divider bg-primaryLight text-secondaryDark"
      >
        <span class="inline-flex flex-1 items-center px-4">
          <icon-lucide-search class="h-4 w-4 text-secondaryLight" />
          <input
            v-model="filterQueryText"
            v-focus
            class="input !border-0 !px-2"
            :placeholder="`${t('response.filter_response_body')}`"
            type="text"
          />
        </span>
        <div
          v-if="filterResponseError"
          class="flex items-center justify-center rounded px-2 py-1 text-tiny text-accentContrast"
          :class="{
            'bg-red-500':
              filterResponseError.type === 'JSON_PARSE_FAILED' ||
              filterResponseError.type === 'JSON_PATH_QUERY_ERROR',
            'bg-amber-500': filterResponseError.type === 'RESPONSE_EMPTY',
          }"
        >
          <icon-lucide-info class="svg-icons mr-1.5" />
          <span>{{ filterResponseError.error }}</span>
        </div>
        <HoppButtonSecondary
          v-if="showResponse"
          v-tippy="{ theme: 'tooltip' }"
          :title="t('app.wiki')"
          :icon="IconHelpCircle"
          to="https://github.com/JSONPath-Plus/JSONPath"
          blank
        />
      </div>
    </div>
    <div class="h-full relative overflow-auto flex flex-col flex-1">
      <div ref="jsonResponse" class="absolute inset-0 h-full"></div>
    </div>
    <div
      v-if="outlinePath"
      class="sticky bottom-0 z-10 flex flex-shrink-0 flex-nowrap overflow-auto overflow-x-auto border-t border-dividerLight bg-primaryLight px-2"
    >
      <div
        v-for="(item, index) in outlinePath"
        :key="`item-${index}`"
        class="flex items-center"
      >
        <tippy
          interactive
          trigger="click"
          theme="popover"
          :on-shown="() => tippyActions[index].focus()"
        >
          <div v-if="item.kind === 'RootObject'" class="outline-item">{}</div>
          <div v-if="item.kind === 'RootArray'" class="outline-item">[]</div>
          <div v-if="item.kind === 'ArrayMember'" class="outline-item">
            {{ item.index }}
          </div>
          <div v-if="item.kind === 'ObjectMember'" class="outline-item">
            {{ item.name }}
          </div>
          <template #content="{ hide }">
            <div
              v-if="item.kind === 'ArrayMember' || item.kind === 'ObjectMember'"
            >
              <div
                v-if="item.kind === 'ArrayMember'"
                ref="tippyActions"
                class="flex flex-col focus:outline-none"
                tabindex="0"
                @keyup.escape="hide()"
              >
                <HoppSmartItem
                  v-for="(arrayMember, astIndex) in item.astParent.values"
                  :key="`ast-${astIndex}`"
                  :label="`${astIndex}`"
                  @click="
                    () => {
                      jumpCursor(arrayMember)
                      hide()
                    }
                  "
                />
              </div>
              <div
                v-if="item.kind === 'ObjectMember'"
                ref="tippyActions"
                class="flex flex-col focus:outline-none"
                tabindex="0"
                @keyup.escape="hide()"
              >
                <HoppSmartItem
                  v-for="(objectMember, astIndex) in item.astParent.members"
                  :key="`ast-${astIndex}`"
                  :label="objectMember.key.value"
                  @click="
                    () => {
                      jumpCursor(objectMember)
                      hide()
                    }
                  "
                />
              </div>
            </div>
            <div
              v-if="item.kind === 'RootObject'"
              ref="tippyActions"
              class="flex flex-col"
            >
              <HoppSmartItem
                label="{}"
                @click="
                  () => {
                    jumpCursor(item.astValue)
                    hide()
                  }
                "
              />
            </div>
            <div
              v-if="item.kind === 'RootArray'"
              ref="tippyActions"
              class="flex flex-col"
            >
              <HoppSmartItem
                label="[]"
                @click="
                  () => {
                    jumpCursor(item.astValue)
                    hide()
                  }
                "
              />
            </div>
          </template>
        </tippy>
        <icon-lucide-chevron-right
          v-if="index + 1 !== outlinePath.length"
          class="svg-icons text-secondaryLight opacity-50"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import IconWrapText from "~icons/lucide/wrap-text"
import IconFilter from "~icons/lucide/filter"
import IconMore from "~icons/lucide/more-horizontal"
import IconHelpCircle from "~icons/lucide/help-circle"
import IconNetwork from "~icons/lucide/network"
import IconSave from "~icons/lucide/save"
import * as LJSON from "lossless-json"
import * as O from "fp-ts/Option"
import * as E from "fp-ts/Either"
import { pipe } from "fp-ts/function"
import { computed, ref, reactive } from "vue"
import { JSONPath } from "jsonpath-plus"
import { useCodemirror } from "@composables/codemirror"
import { HoppRESTResponse } from "~/helpers/types/HoppRESTResponse"
import jsonParse, { JSONObjectMember, JSONValue } from "~/helpers/jsonParse"
import { getJSONOutlineAtPos } from "~/helpers/newOutline"
import {
  convertIndexToLineCh,
  convertLineChToIndex,
} from "~/helpers/editor/utils"
import { useI18n } from "@composables/i18n"
import {
  useCopyResponse,
  useResponseBody,
  useDownloadResponse,
} from "@composables/lens-actions"
import { defineActionHandler, invokeAction } from "~/helpers/actions"
import { getPlatformSpecialKey as getSpecialKey } from "~/helpers/platformutils"
import { useNestedSetting } from "~/composables/settings"
import { toggleNestedSetting } from "~/newstore/settings"
import { HoppRESTRequestResponse } from "@hoppscotch/data"

const t = useI18n()

const props = defineProps<{
  response: HoppRESTResponse | HoppRESTRequestResponse
  isSavable: boolean
  isEditable: boolean
}>()

const emit = defineEmits<{
  (e: "save-as-example"): void
  (e: "update:response", val: HoppRESTRequestResponse): void
}>()

const showResponse = computed(() => {
  if ("type" in props.response) {
    return props.response.type === "success" || props.response.type === "fail"
  }

  return "body" in props.response
})

const isHttpResponse = computed(() => {
  return (
    "type" in props.response &&
    (props.response.type === "success" || props.response.type === "fail")
  )
})

const toggleFilter = ref(false)
const filterQueryText = ref("")

type BodyParseError =
  | { type: "JSON_PARSE_FAILED" }
  | { type: "JSON_PATH_QUERY_FAILED"; error: Error }

const responseJsonObject = computed(() => {
  if (isHttpResponse.value) {
    const { responseBodyText } = useResponseBody(
      props.response as HoppRESTResponse
    )

    return pipe(
      responseBodyText.value,
      E.tryCatchK(
        LJSON.parse,
        (): BodyParseError => ({ type: "JSON_PARSE_FAILED" })
      )
    )
  }

  return undefined
})

const responseName = computed(() => {
  if ("type" in props.response) {
    if (props.response.type === "success") {
      return props.response.req.name
    }
    return "Untitled"
  }

  return props.response.name
})

const { responseBodyText } = useResponseBody(props.response)

const jsonResponseBodyText = computed(() => {
  if (filterQueryText.value.length > 0 && responseJsonObject.value) {
    return pipe(
      responseJsonObject.value,
      E.chain((parsedJSON) =>
        E.tryCatch(
          () =>
            JSONPath({
              path: filterQueryText.value,
              json: parsedJSON as any,
            }),
          (err): BodyParseError => ({
            type: "JSON_PATH_QUERY_FAILED",
            error: err as Error,
          })
        )
      ),
      E.map(JSON.stringify)
    )
  }
  return E.right(responseBodyText.value)
})

const jsonBodyText = computed(() => {
  const { responseBodyText } = useResponseBody(
    props.response as HoppRESTResponse
  )

  return pipe(
    jsonResponseBodyText.value,
    E.getOrElse(() => responseBodyText.value),
    O.tryCatchK(LJSON.parse),
    O.map((val) => LJSON.stringify(val, undefined, 2)),
    O.getOrElse(() => responseBodyText.value)
  )
})

const ast = computed(() =>
  pipe(
    jsonBodyText.value,
    O.tryCatchK(jsonParse),
    O.getOrElseW(() => null)
  )
)

const filterResponseError = computed(() =>
  pipe(
    jsonResponseBodyText.value,
    E.match(
      (e) => {
        switch (e.type) {
          case "JSON_PATH_QUERY_FAILED":
            return { type: "JSON_PATH_QUERY_ERROR", error: e.error.message }
          case "JSON_PARSE_FAILED":
            return {
              type: "JSON_PARSE_FAILED",
              error: t("error.json_parsing_failed").toString(),
            }
        }
      },
      (result) =>
        result === "[]"
          ? {
              type: "RESPONSE_EMPTY",
              error: t("error.no_results_found").toString(),
            }
          : undefined
    )
  )
)

const saveAsExample = () => {
  emit("save-as-example")
}

const { copyIcon, copyResponse } = useCopyResponse(jsonBodyText)
const { downloadIcon, downloadResponse } = useDownloadResponse(
  "application/json",
  jsonBodyText,
  t("filename.lens", {
    request_name: responseName.value,
  })
)

// Template refs
const tippyActions = ref<any | null>(null)
const jsonResponse = ref<any | null>(null)
const WRAP_LINES = useNestedSetting("WRAP_LINES", "httpResponseBody")
const copyInterfaceTippyActions = ref<any | null>(null)

const { cursor } = useCodemirror(
  jsonResponse,
  jsonBodyText,
  reactive({
    extendedEditorConfig: {
      mode: "application/ld+json",
      readOnly: !props.isEditable,
      lineWrapping: WRAP_LINES,
    },
    linter: null,
    completer: null,
    environmentHighlights: true,
    onChange: (update: string) => {
      emit("update:response", { ...props.response, body: update })
    },
  })
)

const jumpCursor = (ast: JSONValue | JSONObjectMember) => {
  const pos = convertIndexToLineCh(jsonBodyText.value, ast.start)
  pos.line--
  cursor.value = pos
}

const outlinePath = computed(() =>
  pipe(
    ast.value,
    O.fromNullable,
    O.map((ast) =>
      getJSONOutlineAtPos(
        ast,
        convertLineChToIndex(jsonBodyText.value, cursor.value)
      )
    ),
    O.getOrElseW(() => null)
  )
)

const toggleFilterState = () => {
  filterQueryText.value = ""
  toggleFilter.value = !toggleFilter.value
}

defineActionHandler("response.file.download", () => downloadResponse())
defineActionHandler("response.copy", () => copyResponse())
defineActionHandler("response.save-as-example", () => {
  props.isSavable ? saveAsExample() : null
})
</script>

<style lang="scss" scoped>
.outline-item {
  @apply cursor-pointer;
  @apply flex-shrink-0 flex-grow-0;
  @apply text-secondaryLight;
  @apply inline-flex;
  @apply items-center;
  @apply px-2;
  @apply py-1;
  @apply transition;
  @apply hover:text-secondary;
}
</style>
