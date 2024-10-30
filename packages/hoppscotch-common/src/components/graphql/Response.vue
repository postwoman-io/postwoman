<template>
  <div class="flex flex-1 flex-col overflow-auto whitespace-nowrap">
    <HttpResponseMeta
      :response="props.response?.[0]?.document"
      :is-embed="isEmbed"
    />
    <div
      v-if="
        response && response.length === 1 && response[0].type === 'response'
      "
      class="flex flex-1 flex-col"
    >
      <div
        class="sticky top-0 z-10 flex flex-shrink-0 items-center justify-between overflow-x-auto border-b border-dividerLight bg-primary pl-4"
      >
        <label class="truncate font-semibold text-secondaryLight">
          {{ t("response.title") }}
        </label>
        <div class="flex items-center">
          <HoppButtonSecondary
            v-tippy="{ theme: 'tooltip' }"
            :title="t('state.linewrap')"
            :class="{ '!text-accent': WRAP_LINES }"
            :icon="IconWrapText"
            @click.prevent="
              toggleNestedSetting('WRAP_LINES', 'graphqlResponseBody')
            "
          />
          <HoppButtonSecondary
            v-tippy="{ theme: 'tooltip', allowHTML: true }"
            :title="`${t(
              'action.download_file'
            )} <kbd>${getSpecialKey()}</kbd><kbd>J</kbd>`"
            :icon="downloadIcon"
            @click="downloadResponse"
          />
          <HoppButtonSecondary
            v-tippy="{ theme: 'tooltip', allowHTML: true }"
            :title="`${t(
              'action.copy'
            )} <kbd>${getSpecialKey()}</kbd><kbd>.</kbd>`"
            :icon="copyIcon"
            @click="copyResponse"
          />
          <tippy
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
      <div class="h-full relative overflow-auto flex flex-col flex-1">
        <div ref="schemaEditor" class="absolute inset-0 h-full"></div>
      </div>
    </div>
    <component
      :is="response[0].error.component"
      v-else-if="
        response && response[0].type === 'error' && response[0].error.component
      "
      class="flex-1"
    />
    <div
      v-else-if="response && response?.length > 1"
      class="flex flex-1 flex-col"
    >
      <GraphqlSubscriptionLog :log="response" />
    </div>
    <!-- <AppShortcutsPrompt v-else class="p-4" /> -->
  </div>
</template>

<script setup lang="ts">
import IconWrapText from "~icons/lucide/wrap-text"
import IconNetwork from "~icons/lucide/network"
import IconMore from "~icons/lucide/more-horizontal"
import { computed, reactive, ref } from "vue"
import { useCodemirror } from "@composables/codemirror"
import { useI18n } from "@composables/i18n"
import { defineActionHandler, invokeAction } from "~/helpers/actions"
import { getPlatformSpecialKey as getSpecialKey } from "~/helpers/platformutils"
import { GQLResponseEvent } from "~/helpers/graphql/connection"
import { useNestedSetting } from "~/composables/settings"
import { toggleNestedSetting } from "~/newstore/settings"
import {
  useCopyResponse,
  useDownloadResponse,
} from "~/composables/lens-actions"

const t = useI18n()

const props = withDefaults(
  defineProps<{
    response: GQLResponseEvent[] | null
  }>(),
  {
    response: null,
  }
)

const responseString = computed(() => {
  const response = props.response
  if (response && response[0].type === "error") {
    return ""
  } else if (
    response &&
    response.length === 1 &&
    response[0].type === "response" &&
    response[0].data
  ) {
    return JSON.stringify(JSON.parse(response[0].data), null, 2)
  }
  return ""
})

const schemaEditor = ref<any | null>(null)
const WRAP_LINES = useNestedSetting("WRAP_LINES", "graphqlResponseBody")
const copyInterfaceTippyActions = ref<any | null>(null)

useCodemirror(
  schemaEditor,
  responseString,
  reactive({
    extendedEditorConfig: {
      mode: "application/ld+json",
      readOnly: true,
      lineWrapping: WRAP_LINES,
    },
    linter: null,
    completer: null,
    environmentHighlights: false,
  })
)

const { copyIcon, copyResponse } = useCopyResponse(responseString)
const { downloadIcon, downloadResponse } = useDownloadResponse(
  "application/json",
  responseString,
  t("filename.graphql_response")
)

defineActionHandler(
  "response.file.download",
  () => downloadResponse(),
  computed(() => !!props.response && props.response.length > 0)
)
defineActionHandler(
  "response.copy",
  () => copyResponse(),
  computed(() => !!props.response && props.response.length > 0)
)
</script>
