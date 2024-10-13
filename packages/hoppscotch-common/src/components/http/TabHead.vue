<template>
  <div
    v-tippy="{ theme: 'tooltip', delay: [500, 20] }"
    :title="tabState.name"
    class="flex items-center truncate px-2"
    @dblclick="emit('open-rename-modal')"
    @contextmenu.prevent="options?.tippy?.show()"
    @click.middle="emit('close-tab')"
  >
    <span
      class="text-tiny font-semibold mr-2 p-1 rounded-sm relative"
      :class="{
        'border border-dashed border-primaryDark grayscale': isResponseExample,
      }"
      :style="{ color: getMethodLabelColorClassOf(tabState.method) }"
    >
      {{ tabState.method }}
    </span>
    <tippy
      ref="options"
      trigger="manual"
      interactive
      theme="popover"
      :on-shown="() => tippyActions!.focus()"
    >
      <span class="truncate">
        {{ tabState.name }}
      </span>
      <template #content="{ hide }">
        <div
          ref="tippyActions"
          class="flex flex-col focus:outline-none"
          tabindex="0"
          @keyup.r="renameAction?.$el.click()"
          @keyup.s="shareRequestAction?.$el.click()"
          @keyup.d="duplicateAction?.$el.click()"
          @keyup.w="closeAction?.$el.click()"
          @keyup.x="closeOthersAction?.$el.click()"
          @keyup.escape="hide()"
        >
          <HoppSmartItem
            v-if="!isResponseExample"
            ref="renameAction"
            :icon="IconFileEdit"
            :label="t('request.rename')"
            :shortcut="['R']"
            @click="
              () => {
                emit('open-rename-modal')
                hide()
              }
            "
          />
          <HoppSmartItem
            v-if="!isResponseExample"
            ref="duplicateAction"
            :icon="IconCopy"
            :label="t('tab.duplicate')"
            :shortcut="['D']"
            @click="
              () => {
                emit('duplicate-tab')
                hide()
              }
            "
          />
          <HoppSmartItem
            v-if="!isResponseExample"
            ref="shareRequestAction"
            :icon="IconShare2"
            :label="t('tab.share_tab_request')"
            :shortcut="['S']"
            @click="
              () => {
                emit('share-tab-request')
                hide()
              }
            "
          />
          <HoppSmartItem
            v-if="isRemovable"
            ref="closeAction"
            :icon="IconXCircle"
            :label="t('tab.close')"
            :shortcut="['W']"
            @click="
              () => {
                emit('close-tab')
                hide()
              }
            "
          />
          <HoppSmartItem
            v-if="isRemovable"
            ref="closeOthersAction"
            :icon="IconXSquare"
            :label="t('tab.close_others')"
            :shortcut="['X']"
            @click="
              () => {
                emit('close-other-tabs')
                hide()
              }
            "
          />
        </div>
      </template>
    </tippy>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from "vue"
import { TippyComponent } from "vue-tippy"
import { getMethodLabelColorClassOf } from "~/helpers/rest/labelColoring"
import { useI18n } from "~/composables/i18n"
import IconXCircle from "~icons/lucide/x-circle"
import IconXSquare from "~icons/lucide/x-square"
import IconFileEdit from "~icons/lucide/file-edit"
import IconCopy from "~icons/lucide/copy"
import IconShare2 from "~icons/lucide/share-2"
import { HoppTab } from "~/services/tab"
import {
  HoppRequestDocument,
  HoppSavedExampleDocument,
} from "~/helpers/rest/document"

const t = useI18n()

const props = defineProps<{
  tab: HoppTab<HoppRequestDocument | HoppSavedExampleDocument>
  isRemovable: boolean
}>()

const tabState = computed(() => {
  if (props.tab.document.type === "request") {
    return {
      name: props.tab.document.request.name,
      method: props.tab.document.request.method,
      request: props.tab.document.request,
    }
  }
  return {
    name: props.tab.document.response.name,
    method: props.tab.document.response.originalRequest.method,
    request: props.tab.document.response.originalRequest,
  }
})

const isResponseExample = computed(() => {
  return props.tab.document.type === "example-response"
})

const emit = defineEmits<{
  (event: "open-rename-modal"): void
  (event: "close-tab"): void
  (event: "close-other-tabs"): void
  (event: "duplicate-tab"): void
  (event: "share-tab-request"): void
}>()

const tippyActions = ref<TippyComponent | null>(null)
const options = ref<TippyComponent | null>(null)

const renameAction = ref<HTMLButtonElement | null>(null)
const closeAction = ref<HTMLButtonElement | null>(null)
const closeOthersAction = ref<HTMLButtonElement | null>(null)
const duplicateAction = ref<HTMLButtonElement | null>(null)
const shareRequestAction = ref<HTMLButtonElement | null>(null)
</script>
