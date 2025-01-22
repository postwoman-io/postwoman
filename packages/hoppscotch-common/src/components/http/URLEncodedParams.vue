<template>
  <div class="flex flex-1 flex-col">
    <div
      class="sticky top-upperMobileStickyFold z-10 flex flex-shrink-0 items-center justify-between overflow-x-auto border-b border-dividerLight bg-primary pl-4 sm:top-upperMobileTertiaryStickyFold"
    >
      <label class="truncate font-semibold text-secondaryLight">
        {{ t("request.body") }}
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
          :title="t('action.clear_all')"
          :icon="IconTrash2"
          @click="clearContent()"
        />
        <HoppButtonSecondary
          v-if="isBulkEditing"
          v-tippy="{ theme: 'tooltip' }"
          :title="t('state.linewrap')"
          :class="{ '!text-accent': wrapLines }"
          :icon="IconWrapText"
          @click.prevent="toggleNestedSetting('WRAP_LINES', 'httpUrlEncoded')"
        />
        <HoppButtonSecondary
          v-tippy="{ theme: 'tooltip' }"
          :title="t('state.bulk_mode')"
          :icon="IconEdit"
          :class="{ '!text-accent': isBulkEditing }"
          @click="toggleBulkEdit"
        />
        <HoppButtonSecondary
          v-tippy="{ theme: 'tooltip' }"
          :title="t('add.new')"
          :icon="IconPlus"
          :disabled="isBulkEditing"
          @click="addUrlEncodedParam"
        />
      </div>
    </div>
    <div
      v-if="isBulkEditing"
      class="h-full relative w-full flex flex-col flex-1"
    >
      <div ref="bulkEditor" class="absolute inset-0"></div>
    </div>
    <div v-else>
      <draggable
        v-model="workingUrlEncodedParams"
        :item-key="(param) => `param-${param.id}`"
        animation="250"
        handle=".draggable-handle"
        draggable=".draggable-content"
        ghost-class="cursor-move"
        chosen-class="bg-primaryLight"
        drag-class="cursor-grabbing"
      >
        <template #item="{ element: param, index }">
          <div
            class="draggable-content group flex divide-x divide-dividerLight border-b border-dividerLight"
          >
            <span>
              <HoppButtonSecondary
                v-tippy="{
                  theme: 'tooltip',
                  delay: [500, 20],
                  content:
                    index !== workingUrlEncodedParams?.length - 1
                      ? t('action.drag_to_reorder')
                      : null,
                }"
                :icon="IconGripVertical"
                class="opacity-0"
                :class="{
                  'draggable-handle cursor-grab group-hover:opacity-100':
                    index !== workingUrlEncodedParams?.length - 1,
                }"
                tabindex="-1"
              />
            </span>
            <SmartEnvInput
              v-model="param.key"
              :placeholder="`${t('count.parameter', { count: index + 1 })}`"
              :auto-complete-env="true"
              :envs="envs"
              @change="
                updateUrlEncodedParam(index, {
                  id: param.id,
                  key: $event,
                  value: param.value,
                  active: param.active,
                })
              "
            />
            <SmartEnvInput
              v-model="param.value"
              :placeholder="`${t('count.value', { count: index + 1 })}`"
              :auto-complete-env="true"
              :envs="envs"
              @change="
                updateUrlEncodedParam(index, {
                  id: param.id,
                  key: param.key,
                  value: $event,
                  active: param.active,
                })
              "
            />
            <span>
              <HoppButtonSecondary
                v-tippy="{ theme: 'tooltip' }"
                :title="
                  param.hasOwnProperty('active')
                    ? param.active
                      ? t('action.turn_off')
                      : t('action.turn_on')
                    : t('action.turn_off')
                "
                :icon="
                  param.hasOwnProperty('active')
                    ? param.active
                      ? IconCheckCircle
                      : IconCircle
                    : IconCheckCircle
                "
                color="green"
                @click="
                  updateUrlEncodedParam(index, {
                    id: param.id,
                    key: param.key,
                    value: param.value,
                    active: !param.active,
                  })
                "
              />
            </span>
            <span>
              <HoppButtonSecondary
                v-tippy="{ theme: 'tooltip' }"
                :title="t('action.remove')"
                :icon="IconTrash"
                color="red"
                @click="deleteUrlEncodedParam(index)"
              />
            </span>
          </div>
        </template>
      </draggable>
      <HoppSmartPlaceholder
        v-if="workingUrlEncodedParams.length === 0 && !isBulkEditing"
        :src="`/images/states/${colorMode.value}/add_category.svg`"
        :alt="`${t('empty.body')}`"
        :text="t('empty.body')"
      >
        <template #body>
          <HoppButtonSecondary
            filled
            :label="`${t('add.new')}`"
            :icon="IconPlus"
            @click="addUrlEncodedParam"
          />
        </template>
      </HoppSmartPlaceholder>
    </div>
  </div>
</template>

<script setup lang="ts">
import IconHelpCircle from "~icons/lucide/help-circle"
import IconTrash2 from "~icons/lucide/trash-2"
import IconEdit from "~icons/lucide/edit"
import IconPlus from "~icons/lucide/plus"
import IconGripVertical from "~icons/lucide/grip-vertical"
import IconCheckCircle from "~icons/lucide/check-circle"
import IconCircle from "~icons/lucide/circle"
import IconTrash from "~icons/lucide/trash"
import IconWrapText from "~icons/lucide/wrap-text"
import { computed, reactive, ref, watch } from "vue"
import { isEqual, cloneDeep } from "lodash-es"
import {
  HoppRESTReqBody,
  parseRawKeyValueEntries,
  parseRawKeyValueEntriesE,
  rawKeyValueEntriesToString,
  RawKeyValueEntry,
} from "@hoppscotch/data"
import { flow, pipe } from "fp-ts/function"
import * as A from "fp-ts/Array"
import * as O from "fp-ts/Option"
import * as E from "fp-ts/Either"
import draggable from "vuedraggable-es"
import { useCodemirror } from "@composables/codemirror"
import linter from "~/helpers/editor/linting/rawKeyValue"
import { pluckRef } from "@composables/ref"
import { useI18n } from "@composables/i18n"
import { useToast } from "@composables/toast"
import { useColorMode } from "@composables/theming"
import { objRemoveKey } from "~/helpers/functional/object"
import { throwError } from "~/helpers/functional/error"
import { useVModel } from "@vueuse/core"
import { useNestedSetting } from "~/composables/settings"
import { toggleNestedSetting } from "~/newstore/settings"
import { AggregateEnvironment } from "~/newstore/environments"

type Body = HoppRESTReqBody & {
  contentType: "application/x-www-form-urlencoded"
}

const props = defineProps<{
  modelValue: Body
  envs: AggregateEnvironment[]
}>()

const emit = defineEmits<{
  (e: "update:modelValue", val: Body): void
}>()

const body = useVModel(props, "modelValue", emit)

const t = useI18n()
const toast = useToast()
const colorMode = useColorMode()

const idTicker = ref(0)

const deletionToast = ref<{ goAway: (delay: number) => void } | null>(null)

// The functional urlEncodedParams list (the urlEncodedParams actually in the system)
const urlEncodedParamsRaw = pluckRef(body, "body")

const urlEncodedParams = computed<RawKeyValueEntry[]>({
  get() {
    return typeof urlEncodedParamsRaw.value === "string"
      ? parseRawKeyValueEntries(urlEncodedParamsRaw.value)
      : []
  },
  set(newValue) {
    urlEncodedParamsRaw.value = rawKeyValueEntriesToString(newValue)
  },
})

// The UI representation of the urlEncodedParams list (has the empty end urlEncodedParam)
const workingUrlEncodedParams = ref<Array<RawKeyValueEntry & { id: number }>>([
  {
    id: idTicker.value++,
    key: "",
    value: "",
    active: true,
  },
])

// Rule: Working urlEncodedParams always have one empty urlEncodedParam or the last element is always an empty urlEncodedParams
watch(workingUrlEncodedParams, (urlEncodedParamList) => {
  if (
    urlEncodedParamList.length > 0 &&
    urlEncodedParamList[urlEncodedParamList.length - 1].key !== ""
  ) {
    workingUrlEncodedParams.value.push({
      id: idTicker.value++,
      key: "",
      value: "",
      active: true,
    })
  }
})

// Sync logic between urlEncodedParams and working urlEncodedParams
watch(
  urlEncodedParams,
  (newurlEncodedParamList) => {
    const filteredWorkingUrlEncodedParams = pipe(
      workingUrlEncodedParams.value,
      A.filterMap(
        flow(
          O.fromPredicate((x) => x.key !== ""),
          O.map(objRemoveKey("id"))
        )
      )
    )

    if (!isEqual(newurlEncodedParamList, filteredWorkingUrlEncodedParams)) {
      workingUrlEncodedParams.value = pipe(
        newurlEncodedParamList,
        A.map((x) => ({ id: idTicker.value++, ...x }))
      )
    }
  },
  { immediate: true }
)

watch(workingUrlEncodedParams, (newWorkingUrlEncodedParams) => {
  const fixedUrlEncodedParams = pipe(
    newWorkingUrlEncodedParams,
    A.filterMap(
      flow(
        O.fromPredicate((e) => e.key !== ""),
        O.map(objRemoveKey("id"))
      )
    )
  )

  if (!isEqual(urlEncodedParams.value, fixedUrlEncodedParams)) {
    urlEncodedParams.value = fixedUrlEncodedParams
  }
})

const addUrlEncodedParam = () => {
  workingUrlEncodedParams.value.push({
    id: idTicker.value++,
    key: "",
    value: "",
    active: true,
  })
}

const updateUrlEncodedParam = (
  index: number,
  param: RawKeyValueEntry & { id: number }
) => {
  workingUrlEncodedParams.value = workingUrlEncodedParams.value.map((p, i) =>
    i === index ? param : p
  )
}

const deleteUrlEncodedParam = (index: number) => {
  const urlEncodedParamsBeforeDeletion = cloneDeep(
    workingUrlEncodedParams.value
  )

  if (
    !(
      urlEncodedParamsBeforeDeletion.length > 0 &&
      index === urlEncodedParamsBeforeDeletion.length - 1
    )
  ) {
    if (deletionToast.value) {
      deletionToast.value.goAway(0)
      deletionToast.value = null
    }

    deletionToast.value = toast.success(`${t("state.deleted")}`, {
      action: [
        {
          text: `${t("action.undo")}`,
          onClick: (_, toastObject) => {
            workingUrlEncodedParams.value = urlEncodedParamsBeforeDeletion
            toastObject.goAway(0)
            deletionToast.value = null
          },
        },
      ],

      onComplete: () => {
        deletionToast.value = null
      },
    })
  }

  workingUrlEncodedParams.value = pipe(
    workingUrlEncodedParams.value,
    A.deleteAt(index),
    O.getOrElseW(() =>
      throwError("Working URL Encoded Params Deletion Out of Bounds")
    )
  )
}

const convertWorkingParamsToBulkEditContent = (params: RawKeyValueEntry[]) => {
  return params
    .filter((param) => param.key !== "")
    .map((param) => `${!param.active ? "# " : ""}${param.key}: ${param.value}`)
    .join("\n")
}

const bulkEditor = ref<HTMLElement | null>(null)
const bulkEditContent = ref<string | undefined>(
  convertWorkingParamsToBulkEditContent(urlEncodedParams.value)
)
const isBulkEditing = ref(body.value.isBulkEditing)
const wrapLines = useNestedSetting("WRAP_LINES", "httpUrlEncoded")

watch(isBulkEditing, () => {
  body.value.isBulkEditing = isBulkEditing.value
})

// update working params when bulk edit content changes
watch(bulkEditContent, () => {
  if (isBulkEditing.value && bulkEditContent.value !== undefined) {
    const res = parseRawKeyValueEntriesE(bulkEditContent.value)

    if (E.isLeft(res)) {
      return
    }

    workingUrlEncodedParams.value = [
      ...res.right.map((entry) => ({
        id: idTicker.value++,
        key: entry.key,
        value: entry.value,
        active: entry.active,
      })),
    ]
  }
})

const toggleBulkEdit = () => {
  isBulkEditing.value = !isBulkEditing.value

  if (isBulkEditing.value) {
    bulkEditContent.value = convertWorkingParamsToBulkEditContent(
      workingUrlEncodedParams.value
    )
  } else {
    bulkEditContent.value = undefined
  }
}

useCodemirror(
  bulkEditor,
  bulkEditContent,
  reactive({
    extendedEditorConfig: {
      mode: "text/x-yaml",
      placeholder: t("state.bulk_mode_placeholder").toString(),
      lineWrapping: wrapLines,
    },
    linter,
    completer: null,
    environmentHighlights: true,
    predefinedVariablesHighlights: true,
  })
)

const clearContent = () => {
  // set urlEncodedParams list to the initial state
  workingUrlEncodedParams.value = [
    {
      id: idTicker.value++,
      key: "",
      value: "",
      active: true,
    },
  ]

  bulkEditContent.value = ""
}
</script>

<style lang="scss" scoped>
:deep(.cm-panels) {
  @apply top-upperFourthStickyFold #{!important};
}
</style>
