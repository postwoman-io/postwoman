<template>
  <HoppSmartTabs
    v-model="selectedNavigationTab"
    styles="sticky overflow-x-auto flex-shrink-0 bg-primary z-10 top-0"
    vertical
    render-inactive-tabs
  >
    <HoppSmartTab
      :id="'docs'"
      :icon="IconBookOpen"
      :label="`${t('tab.documentation')}`"
    >
      <GraphqlDocExplorer />
    </HoppSmartTab>
    <HoppSmartTab :id="'schema'" :icon="IconBox" :label="`${t('tab.schema')}`">
      <div
        v-if="schemaString"
        class="sticky top-0 z-10 flex flex-shrink-0 items-center justify-between overflow-x-auto border-b border-dividerLight bg-primary pl-4"
      >
        <label class="truncate font-semibold text-secondaryLight">
          {{ t("graphql.schema") }}
        </label>
        <div class="flex">
          <HoppButtonSecondary
            v-tippy="{ theme: 'tooltip' }"
            to="https://docs.hoppscotch.io/documentation/protocols/graphql"
            blank
            :title="t('app.wiki')"
            :icon="IconHelpCircle"
          />
          <HoppButtonSecondary
            v-tippy="{ theme: 'tooltip' }"
            :title="t('state.linewrap')"
            :class="{ '!text-accent': WRAP_LINES }"
            :icon="IconWrapText"
            @click.prevent="toggleNestedSetting('WRAP_LINES', 'graphqlSchema')"
          />
          <HoppButtonSecondary
            v-tippy="{ theme: 'tooltip' }"
            :title="t('action.download_file')"
            :icon="downloadSchemaIcon"
            @click="downloadSchema"
          />
          <HoppButtonSecondary
            v-tippy="{ theme: 'tooltip' }"
            :title="t('action.copy')"
            :icon="copySchemaIcon"
            @click="copySchema"
          />
        </div>
      </div>
      <div v-if="schemaString" class="h-full relative w-full">
        <div ref="schemaEditor" class="absolute inset-0"></div>
      </div>
      <HoppSmartPlaceholder
        v-else
        :src="`/images/states/${colorMode.value}/blockchain.svg`"
        :alt="`${t('empty.schema')}`"
        :text="t('empty.schema')"
      >
      </HoppSmartPlaceholder>
    </HoppSmartTab>

    <HoppSmartTab
      :id="'collections'"
      :icon="IconFolder"
      :label="`${t('tab.collections')}`"
    >
      <CollectionsGraphql />
    </HoppSmartTab>
    <HoppSmartTab
      :id="'history'"
      :icon="IconClock"
      :label="`${t('tab.history')}`"
    >
      <History :page="'graphql'" />
    </HoppSmartTab>
  </HoppSmartTabs>
</template>

<script setup lang="ts">
import { useCodemirror } from "@composables/codemirror"
import { useI18n } from "@composables/i18n"
import { useColorMode } from "@composables/theming"
import { useToast } from "@composables/toast"
import { copyToClipboard } from "@helpers/utils/clipboard"
import { refAutoReset } from "@vueuse/core"
import { reactive, ref } from "vue"
import { useNestedSetting } from "~/composables/settings"
import { schemaString } from "~/helpers/graphql/connection"
import { toggleNestedSetting } from "~/newstore/settings"
import { platform } from "~/platform"
import IconBookOpen from "~icons/lucide/book-open"
import IconBox from "~icons/lucide/box"
import IconCheck from "~icons/lucide/check"
import IconClock from "~icons/lucide/clock"
import IconCopy from "~icons/lucide/copy"
import IconDownload from "~icons/lucide/download"
import IconFolder from "~icons/lucide/folder"
import IconHelpCircle from "~icons/lucide/help-circle"
import IconWrapText from "~icons/lucide/wrap-text"

type NavigationTabs = "history" | "collection" | "docs" | "schema"

const selectedNavigationTab = ref<NavigationTabs>("docs")

const t = useI18n()
const colorMode = useColorMode()

const toast = useToast()

const downloadSchemaIcon = refAutoReset<typeof IconDownload | typeof IconCheck>(
  IconDownload,
  1000
)
const copySchemaIcon = refAutoReset<typeof IconCopy | typeof IconCheck>(
  IconCopy,
  1000
)

const schemaEditor = ref<any | null>(null)
const WRAP_LINES = useNestedSetting("WRAP_LINES", "graphqlSchema")

useCodemirror(
  schemaEditor,
  schemaString,
  reactive({
    extendedEditorConfig: {
      mode: "graphql",
      readOnly: true,
      lineWrapping: WRAP_LINES,
    },
    linter: null,
    completer: null,
    environmentHighlights: false,
  })
)

const downloadSchema = async () => {
  const dataToWrite = schemaString.value
  const file = new Blob([dataToWrite], { type: "application/graphql" })
  const url = URL.createObjectURL(file)

  const filename = `${
    url.split("/").pop()!.split("#")[0].split("?")[0]
  }.graphql`

  URL.revokeObjectURL(url)

  const result = await platform.kernelIO.saveFileWithDialog({
    data: dataToWrite,
    contentType: "application/graphql",
    suggestedFilename: filename,
    filters: [
      {
        name: "GraphQL Schema File",
        extensions: ["graphql"],
      },
    ],
  })

  if (result.type === "unknown" || result.type === "saved") {
    downloadSchemaIcon.value = IconCheck
    toast.success(`${t("state.download_started")}`)
  }
}

const copySchema = () => {
  if (!schemaString.value) return

  copyToClipboard(schemaString.value)
  copySchemaIcon.value = IconCheck
}
</script>

<style lang="scss" scoped>
:deep(.cm-panels) {
  @apply top-sidebarPrimaryStickyFold #{!important};
}
</style>
