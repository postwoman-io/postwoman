<template>
  <div class="flex flex-1 flex-col">
    <div
      class="sticky top-upperMobileSecondaryStickyFold z-10 flex flex-shrink-0 items-center justify-between overflow-x-auto border-b border-dividerLight bg-primary pl-4 sm:top-upperSecondaryStickyFold"
    >
      <label class="truncate font-semibold text-secondaryLight">
        {{ t("request.request_variables") }}
      </label>
      <div class="flex">
        <HoppButtonSecondary
          v-tippy="{ theme: 'tooltip' }"
          to="https://docs.hoppscotch.io/documentation/features/rest-api-testing"
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
          v-if="bulkMode"
          v-tippy="{ theme: 'tooltip' }"
          :title="t('state.linewrap')"
          :class="{ '!text-accent': WRAP_LINES }"
          :icon="IconWrapText"
          @click.prevent="
            toggleNestedSetting('WRAP_LINES', 'httpRequestVariables')
          "
        />
        <HoppButtonSecondary
          v-tippy="{ theme: 'tooltip' }"
          :title="t('state.bulk_mode')"
          :icon="IconEdit"
          :class="{ '!text-accent': bulkMode }"
          @click="bulkMode = !bulkMode"
        />
        <HoppButtonSecondary
          v-tippy="{ theme: 'tooltip' }"
          :title="t('add.new')"
          :icon="IconPlus"
          :disabled="bulkMode"
          @click="addVariable"
        />
      </div>
    </div>
    <div v-if="bulkMode" class="h-full relative flex flex-col flex-1">
      <div ref="bulkEditor" class="absolute inset-0"></div>
    </div>
    <div v-else>
      <draggable
        v-model="workingRequestVariables"
        item-key="id"
        animation="250"
        handle=".draggable-handle"
        draggable=".draggable-content"
        ghost-class="cursor-move"
        chosen-class="bg-primaryLight"
        drag-class="cursor-grabbing"
      >
        <template #item="{ element: variable, index }">
          <div
            class="draggable-content group flex divide-x divide-dividerLight border-b border-dividerLight"
          >
            <HoppButtonSecondary
              v-tippy="{
                theme: 'tooltip',
                delay: [500, 20],
                content:
                  index !== workingRequestVariables?.length - 1
                    ? t('action.drag_to_reorder')
                    : null,
              }"
              :icon="IconGripVertical"
              class="opacity-0"
              :class="{
                'draggable-handle cursor-grab group-hover:opacity-100':
                  index !== workingRequestVariables?.length - 1,
              }"
              tabindex="-1"
            />
            <SmartEnvInput
              v-model="variable.key"
              :placeholder="`${t('count.variable', { count: index + 1 })}`"
              @change="
                updateVariable(index, {
                  id: variable.id,
                  key: $event,
                  value: variable.value,
                  active: variable.active,
                })
              "
            />
            <SmartEnvInput
              v-model="variable.value"
              :placeholder="`${t('count.value', { count: index + 1 })}`"
              @change="
                updateVariable(index, {
                  id: variable.id,
                  key: variable.key,
                  value: $event,
                  active: variable.active,
                })
              "
            />
            <HoppButtonSecondary
              v-tippy="{ theme: 'tooltip' }"
              :title="
                variable.hasOwnProperty('active')
                  ? variable.active
                    ? t('action.turn_off')
                    : t('action.turn_on')
                  : t('action.turn_off')
              "
              :icon="
                variable.hasOwnProperty('active')
                  ? variable.active
                    ? IconCheckCircle
                    : IconCircle
                  : IconCheckCircle
              "
              color="green"
              @click="
                updateVariable(index, {
                  id: variable.id,
                  key: variable.key,
                  value: variable.value,
                  active: variable.hasOwnProperty('active')
                    ? !variable.active
                    : false,
                })
              "
            />
            <HoppButtonSecondary
              v-tippy="{ theme: 'tooltip' }"
              :title="t('action.remove')"
              :icon="IconTrash"
              color="red"
              @click="deleteVariable(index)"
            />
          </div>
        </template>
      </draggable>
      <HoppSmartPlaceholder
        v-if="workingRequestVariables.length === 0"
        :src="`/images/states/${colorMode.value}/add_files.svg`"
        :alt="`${t('empty.request_variables')}`"
        :text="t('empty.request_variables')"
      >
        <template #body>
          <HoppButtonSecondary
            :label="`${t('add.new')}`"
            :icon="IconPlus"
            filled
            @click="addVariable"
          />
        </template>
      </HoppSmartPlaceholder>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { throwError } from "@functional/error"
import {
  HoppRESTRequestVariable,
  RawKeyValueEntry,
  parseRawKeyValueEntriesE,
  rawKeyValueEntriesToString,
} from "@hoppscotch/data"
import { useVModel } from "@vueuse/core"
import * as A from "fp-ts/Array"
import * as E from "fp-ts/Either"
import * as O from "fp-ts/Option"
import * as RA from "fp-ts/ReadonlyArray"
import { flow, pipe } from "fp-ts/function"
import { cloneDeep, isEqual } from "lodash-es"
import { reactive, ref, watch } from "vue"
import draggable from "vuedraggable-es"

import { useCodemirror } from "~/composables/codemirror"
import { useI18n } from "~/composables/i18n"
import { useNestedSetting } from "~/composables/settings"
import { useColorMode } from "~/composables/theming"
import { useToast } from "~/composables/toast"
import linter from "~/helpers/editor/linting/rawKeyValue"
import { objRemoveKey } from "~/helpers/functional/object"
import { toggleNestedSetting } from "~/newstore/settings"
import IconCheckCircle from "~icons/lucide/check-circle"
import IconCircle from "~icons/lucide/circle"
import IconEdit from "~icons/lucide/edit"
import IconGripVertical from "~icons/lucide/grip-vertical"
import IconHelpCircle from "~icons/lucide/help-circle"
import IconPlus from "~icons/lucide/plus"
import IconTrash from "~icons/lucide/trash"
import IconTrash2 from "~icons/lucide/trash-2"
import IconWrapText from "~icons/lucide/wrap-text"

const colorMode = useColorMode()

const t = useI18n()
const toast = useToast()

const bulkMode = ref(false)
const bulkEditor = ref<any | null>(null)
const bulkVariables = ref("")

const WRAP_LINES = useNestedSetting("WRAP_LINES", "httpRequestVariables")

const deletionToast = ref<{ goAway: (delay: number) => void } | null>(null)

const props = defineProps<{
  modelValue: HoppRESTRequestVariable[]
}>()

const emit = defineEmits<{
  (e: "update:modelValue", value: Array<HoppRESTRequestVariable>): void
}>()

// The functional requestVariable list (the requestVariable actually applied to the session)
const requestVariables = useVModel(props, "modelValue", emit)

useCodemirror(
  bulkEditor,
  bulkVariables,
  reactive({
    extendedEditorConfig: {
      mode: "text/x-yaml",
      placeholder: `${t("state.bulk_mode_placeholder")}`,
      lineWrapping: WRAP_LINES,
    },
    linter,
    completer: null,
    environmentHighlights: true,
    predefinedVariablesHighlights: true,
  })
)

const idTicker = ref(0)

const workingRequestVariables = ref<
  Array<HoppRESTRequestVariable & { id: number }>
>([
  {
    id: idTicker.value++,
    key: "",
    value: "",
    active: true,
  },
])

// Rule: Working Request variable always have last element is always an empty param
watch(workingRequestVariables, (variableList) => {
  if (
    variableList.length > 0 &&
    variableList[variableList.length - 1].key !== ""
  ) {
    workingRequestVariables.value.push({
      id: idTicker.value++,
      key: "",
      value: "",
      active: true,
    })
  }
})

// Sync logic between params and working/bulk params
watch(
  requestVariables,
  (newRequestVariableList) => {
    // Sync should overwrite working params
    const filteredWorkingRequestVariables: HoppRESTRequestVariable[] = pipe(
      workingRequestVariables.value,
      A.filterMap(
        flow(
          O.fromPredicate((e) => e.key !== ""),
          O.map(objRemoveKey("id"))
        )
      )
    )

    const filteredBulkRequestVariables = pipe(
      parseRawKeyValueEntriesE(bulkVariables.value),
      E.map(
        flow(
          RA.filter((e) => e.key !== ""),
          RA.toArray
        )
      ),
      E.getOrElse(() => [] as RawKeyValueEntry[])
    )

    if (!isEqual(newRequestVariableList, filteredWorkingRequestVariables)) {
      workingRequestVariables.value = pipe(
        newRequestVariableList,
        A.map((x) => ({ id: idTicker.value++, ...x }))
      )
    }

    if (!isEqual(newRequestVariableList, filteredBulkRequestVariables)) {
      bulkVariables.value = rawKeyValueEntriesToString(newRequestVariableList)
    }
  },
  { immediate: true }
)

watch(workingRequestVariables, (newWorkingRequestVariables) => {
  const fixedRequestVariables = pipe(
    newWorkingRequestVariables,
    A.filterMap(
      flow(
        O.fromPredicate((e) => e.key !== ""),
        O.map(objRemoveKey("id"))
      )
    )
  )

  if (!isEqual(requestVariables.value, fixedRequestVariables)) {
    requestVariables.value = cloneDeep(fixedRequestVariables)
  }
})

watch(bulkVariables, (newBulkParams) => {
  const filteredBulkRequestVariables = pipe(
    parseRawKeyValueEntriesE(newBulkParams),
    E.map(
      flow(
        RA.filter((e) => e.key !== ""),
        RA.toArray
      )
    ),
    E.getOrElse(() => [] as RawKeyValueEntry[])
  )

  if (!isEqual(requestVariables.value, filteredBulkRequestVariables)) {
    requestVariables.value = filteredBulkRequestVariables
  }
})

const addVariable = () => {
  workingRequestVariables.value.push({
    id: idTicker.value++,
    key: "",
    value: "",
    active: true,
  })
}

const updateVariable = (index: number, variable: any & { id: number }) => {
  workingRequestVariables.value = workingRequestVariables.value.map((h, i) =>
    i === index ? variable : h
  )
}

const deleteVariable = (index: number) => {
  const requestVariablesBeforeDeletion = cloneDeep(
    workingRequestVariables.value
  )

  if (
    !(
      requestVariablesBeforeDeletion.length > 0 &&
      index === requestVariablesBeforeDeletion.length - 1
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
            workingRequestVariables.value = requestVariablesBeforeDeletion
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

  workingRequestVariables.value = pipe(
    workingRequestVariables.value,
    A.deleteAt(index),
    O.getOrElseW(() =>
      throwError("Working Request Variable Deletion Out of Bounds")
    )
  )
}

const clearContent = () => {
  // set params list to the initial state
  workingRequestVariables.value = [
    {
      id: idTicker.value++,
      key: "",
      value: "",
      active: true,
    },
  ]

  bulkVariables.value = ""
}
</script>
