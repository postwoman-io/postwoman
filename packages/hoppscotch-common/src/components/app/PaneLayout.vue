<template>
  <Splitpanes
    :rtl="SIDEBAR_ON_LEFT && mdAndLarger"
    :class="{
      '!flex-row-reverse': SIDEBAR_ON_LEFT && mdAndLarger,
      'smart-splitter': SIDEBAR && hasSidebar,
      'no-splitter': !(SIDEBAR && hasSidebar),
    }"
    :horizontal="!mdAndLarger"
    @resize="setPaneEvent($event, 'vertical')"
  >
    <Pane
      :size="SIDEBAR && hasSidebar ? PANE_MAIN_SIZE : 100"
      min-size="65"
      class="flex flex-col !overflow-auto"
    >
      <Splitpanes
        class="smart-splitter"
        :horizontal="COLUMN_LAYOUT || forceColumnLayout"
        @resize="setPaneEvent($event, 'horizontal')"
      >
        <Pane
          :size="PANE_MAIN_TOP_SIZE"
          class="flex flex-col !overflow-auto"
          :min-size="isEmbed ? 12 : 25"
        >
          <slot name="primary" />
        </Pane>
        <Pane
          v-if="hasSecondary"
          :size="PANE_MAIN_BOTTOM_SIZE"
          class="flex flex-col !overflow-auto"
          min-size="25"
        >
          <slot name="secondary" />
        </Pane>
      </Splitpanes>
    </Pane>
    <Pane
      :size="SIDEBAR && hasSidebar ? PANE_SIDEBAR_SIZE : 0"
      :min-size="25"
      class="flex flex-col !overflow-auto bg-primaryContrast"
    >
      <slot name="sidebar" />
    </Pane>
  </Splitpanes>
</template>

<script setup lang="ts">
import { Pane, Splitpanes } from "splitpanes"

import "splitpanes/dist/splitpanes.css"

import { useSetting } from "@composables/settings"
import { breakpointsTailwind, useBreakpoints } from "@vueuse/core"
import { useService } from "dioc/vue"
import { computed, onMounted, ref, useSlots } from "vue"
import { PersistenceService } from "~/services/persistence"

const SIDEBAR_ON_LEFT = useSetting("SIDEBAR_ON_LEFT")

const breakpoints = useBreakpoints(breakpointsTailwind)
const mdAndLarger = breakpoints.greater("md")

const COLUMN_LAYOUT = useSetting("COLUMN_LAYOUT")

const SIDEBAR = useSetting("SIDEBAR")

const slots = useSlots()

const persistenceService = useService(PersistenceService)

const hasSidebar = computed(() => !!slots.sidebar)
const hasSecondary = computed(() => !!slots.secondary)

const props = defineProps({
  layoutId: {
    type: String,
    default: null,
  },
  isEmbed: {
    type: Boolean,
    defaul: false,
  },
  forceColumnLayout: {
    type: Boolean,
    default: false,
  },
})

type PaneEvent = {
  max: number
  min: number
  size: number
}

const PANE_MAIN_SIZE = ref(70)
const PANE_SIDEBAR_SIZE = ref(30)
const PANE_MAIN_TOP_SIZE = ref(35)
const PANE_MAIN_BOTTOM_SIZE = ref(65)

if (!COLUMN_LAYOUT.value) {
  PANE_MAIN_TOP_SIZE.value = 50
  PANE_MAIN_BOTTOM_SIZE.value = 50
}

async function setPaneEvent(
  event: PaneEvent[],
  type: "vertical" | "horizontal"
) {
  if (!props.layoutId) return
  const storageKey = `${props.layoutId}-pane-config-${type}`
  await persistenceService.setLocalConfig(storageKey, JSON.stringify(event))
}

async function populatePaneEvent() {
  if (!props.layoutId) return

  const verticalPaneData = await getPaneData("vertical")
  if (verticalPaneData) {
    const [mainPane, sidebarPane] = verticalPaneData
    PANE_MAIN_SIZE.value = mainPane?.size
    PANE_SIDEBAR_SIZE.value = sidebarPane?.size
  }

  const horizontalPaneData = await getPaneData("horizontal")
  if (horizontalPaneData) {
    const [mainTopPane, mainBottomPane] = horizontalPaneData
    PANE_MAIN_TOP_SIZE.value = mainTopPane?.size
    PANE_MAIN_BOTTOM_SIZE.value = mainBottomPane?.size
  }
}

async function getPaneData(
  type: "vertical" | "horizontal"
): Promise<PaneEvent[] | null> {
  const storageKey = `${props.layoutId}-pane-config-${type}`
  const paneEvent = await persistenceService.getLocalConfig(storageKey)
  if (!paneEvent) return null
  return JSON.parse(paneEvent)
}

onMounted(async () => {
  await populatePaneEvent()
})
</script>
