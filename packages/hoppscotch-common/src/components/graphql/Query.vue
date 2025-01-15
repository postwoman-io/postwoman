<template>
  <div
    class="sticky top-sidebarPrimaryStickyFold z-10 flex items-center justify-between border-y border-dividerLight bg-primary pl-4"
  >
    <label class="font-semibold text-secondaryLight">
      {{ t("request.query") }}
    </label>
    <div class="flex">
      <HoppButtonSecondary
        v-if="subscriptionState === 'SUBSCRIBED'"
        v-tippy="{
          theme: 'tooltip',
          delay: [500, 20],
          allowHTML: true,
        }"
        :title="`${t('request.stop')}`"
        :label="`${t('request.stop')}`"
        :icon="IconStop"
        class="!hover:text-accentDark rounded-none !text-accent"
        @click="unsubscribe()"
      />

      <HoppButtonSecondary
        v-if="selectedOperation && subscriptionState !== 'SUBSCRIBED'"
        v-tippy="{
          theme: 'tooltip',
          delay: [500, 20],
          allowHTML: true,
        }"
        :title="`${t('request.run')} <kbd>${getSpecialKey()}</kbd><kbd>G</kbd>`"
        :label="`${selectedOperation.name?.value ?? t('request.run')}`"
        :icon="IconPlay"
        :disabled="!selectedOperation"
        class="!hover:text-accentDark rounded-none !text-accent"
        @click="runQuery(selectedOperation)"
      />

      <HoppButtonSecondary
        v-tippy="{ theme: 'tooltip', delay: [500, 20], allowHTML: true }"
        :title="`${t(
          'request.save'
        )} <kbd>${getSpecialKey()}</kbd><kbd>S</kbd>`"
        :label="`${t('request.save')}`"
        :icon="IconSave"
        class="rounded-none"
        @click="saveRequest"
      />
      <HoppButtonSecondary
        v-tippy="{ theme: 'tooltip' }"
        to="https://docs.hoppscotch.io/documentation/features/graphql-api-testing"
        blank
        :title="t('app.wiki')"
        :icon="IconHelpCircle"
      />
      <HoppButtonSecondary
        v-tippy="{ theme: 'tooltip' }"
        :title="t('action.clear_all')"
        :icon="IconTrash2"
        @click="clearGQLQuery()"
      />
      <HoppButtonSecondary
        v-tippy="{ theme: 'tooltip' }"
        :title="t('state.linewrap')"
        :class="{ '!text-accent': WRAP_LINES }"
        :icon="IconWrapText"
        @click.prevent="toggleNestedSetting('WRAP_LINES', 'graphqlQuery')"
      />
      <HoppButtonSecondary
        v-tippy="{ theme: 'tooltip' }"
        :title="t('action.prettify')"
        :icon="prettifyQueryIcon"
        @click="prettifyQuery"
      />
      <HoppButtonSecondary
        v-tippy="{ theme: 'tooltip' }"
        :title="t('action.copy')"
        :icon="copyQueryIcon"
        @click="copyQuery"
      />
    </div>
  </div>
  <div ref="queryEditor" class="flex flex-1 flex-col"></div>
</template>

<script setup lang="ts">
import IconPlay from "~icons/lucide/play"
import IconStop from "~icons/lucide/stop-circle"
import IconSave from "~icons/lucide/save"
import IconHelpCircle from "~icons/lucide/help-circle"
import IconTrash2 from "~icons/lucide/trash-2"
import IconCopy from "~icons/lucide/copy"
import IconCheck from "~icons/lucide/check"
import IconInfo from "~icons/lucide/info"
import IconWand from "~icons/lucide/wand"
import IconWrapText from "~icons/lucide/wrap-text"
import { onMounted, reactive, ref, markRaw, watch, nextTick } from "vue"
import { copyToClipboard } from "@helpers/utils/clipboard"
import { useCodemirror } from "@composables/codemirror"
import { useI18n } from "@composables/i18n"
import { refAutoReset, useVModel } from "@vueuse/core"
import { useToast } from "~/composables/toast"
import { getPlatformSpecialKey as getSpecialKey } from "~/helpers/platformutils"
import * as gql from "graphql"
import { createGQLQueryLinter } from "~/helpers/editor/linting/gqlQuery"
import queryCompleter from "~/helpers/editor/completion/gqlQuery"
import { selectedGQLOpHighlight } from "~/helpers/editor/gql/operation"
import { debounce } from "lodash-es"
import { ViewUpdate } from "@codemirror/view"
import { defineActionHandler } from "~/helpers/actions"
import {
  schema,
  socketDisconnect,
  subscriptionState,
} from "~/helpers/graphql/connection"
import { useNestedSetting } from "~/composables/settings"
import { toggleNestedSetting } from "~/newstore/settings"
import { useQuery } from "~/helpers/graphql/query"

// Template refs
const queryEditor = ref<any | null>(null)

const t = useI18n()
const toast = useToast()

const props = defineProps<{
  modelValue: string
}>()

const emit = defineEmits<{
  (e: "save-request"): void
  (e: "update:modelValue", val: string): void
  (e: "cursor-position", val: number): void
  (e: "run-query", definition: gql.OperationDefinitionNode | null): void
}>()

const copyQueryIcon = refAutoReset<typeof IconCopy | typeof IconCheck>(
  IconCopy,
  1000
)
const prettifyQueryIcon = refAutoReset<
  typeof IconWand | typeof IconCheck | typeof IconInfo
>(IconWand, 1000)

const WRAP_LINES = useNestedSetting("WRAP_LINES", "graphqlQuery")

const selectedOperation = ref<gql.OperationDefinitionNode | null>(null)

const gqlQueryString = useVModel(props, "modelValue", emit)

const debouncedOnUpdateQueryState = debounce((update: ViewUpdate) => {
  const selectedPos = update.state.selection.main.head
  emit("cursor-position", selectedPos)
  const queryString = update.state.doc.toJSON().join(update.state.lineBreak)

  try {
    const operations = gql.parse(queryString)
    if (operations.definitions.length === 1) {
      selectedOperation.value = operations
        .definitions[0] as gql.OperationDefinitionNode
      return
    }

    selectedOperation.value =
      (operations.definitions.find((def) => {
        if (def.kind !== "OperationDefinition") return false
        const { start, end } = def.loc!
        return selectedPos >= start && selectedPos <= end
      }) as gql.OperationDefinitionNode) ?? null
  } catch (error) {
    // console.error(error)
  }
}, 300)

onMounted(() => {
  try {
    const operations = gql.parse(gqlQueryString.value)
    if (operations.definitions.length) {
      selectedOperation.value = operations
        .definitions[0] as gql.OperationDefinitionNode
      return
    }
  } catch (error) {}
})

const cmQueryEditor = useCodemirror(
  queryEditor,
  gqlQueryString,
  reactive({
    extendedEditorConfig: {
      mode: "graphql",
      placeholder: `${t("request.query")}`,
      lineWrapping: WRAP_LINES,
    },
    linter: createGQLQueryLinter(schema),
    completer: queryCompleter(schema),
    environmentHighlights: false,
    additionalExts: [markRaw(selectedGQLOpHighlight)],
    onUpdate: debouncedOnUpdateQueryState,
  })
)

// Add useQuery
const { updatedQuery, cursorPosition } = useQuery()

// Add watcher for query updates
watch(updatedQuery, async (newQuery) => {
  if (newQuery) {
    gqlQueryString.value = newQuery

    await nextTick()

    // Update cursor position
    if (cursorPosition.value) {
      cmQueryEditor.cursor.value = cursorPosition.value
    }
  }
})

// operations on graphql query string
// const operations = useReadonlyStream(props.request.operations$, [])

const prettifyQuery = () => {
  try {
    gqlQueryString.value = gql.print(
      gql.parse(gqlQueryString.value, {
        allowLegacyFragmentVariables: true,
      })
    )
    prettifyQueryIcon.value = IconCheck
  } catch (e) {
    toast.error(`${t("error.gql_prettify_invalid_query")}`)
    prettifyQueryIcon.value = IconInfo
  }
}

const copyQuery = () => {
  copyToClipboard(gqlQueryString.value)
  copyQueryIcon.value = IconCheck
  toast.success(`${t("state.copied_to_clipboard")}`)
}

const clearGQLQuery = () => {
  gqlQueryString.value = ""
}

const runQuery = (definition: gql.OperationDefinitionNode | null = null) => {
  emit("run-query", definition)
}
const unsubscribe = () => {
  socketDisconnect()
}
const saveRequest = () => {
  emit("save-request")
}

defineActionHandler("editor.format", prettifyQuery)
</script>
