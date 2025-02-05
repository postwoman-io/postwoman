<template>
  <div>
    <AppPaneLayout layout-id="graphql">
      <template #primary>
        <GraphqlRequest />

        <HoppSmartWindows
          v-if="currentTabID"
          :id="'gql_windows'"
          :model-value="currentTabID"
          @update:model-value="changeTab"
          @remove-tab="removeTab"
          @add-tab="addNewTab"
          @sort="sortTabs"
        >
          <HoppSmartWindow
            v-for="tab in activeTabs"
            :id="tab.id"
            :key="'removable_tab_' + tab.id"
            :label="tab.document.request.name"
            :is-removable="activeTabs.length > 1"
            :close-visibility="'hover'"
          >
            <template #tabhead>
              <GraphqlTabHead
                :tab="tab"
                :is-removable="activeTabs.length > 1"
                @open-rename-modal="openReqRenameModal(tab)"
                @close-tab="removeTab(tab.id)"
                @close-other-tabs="closeOtherTabsAction(tab.id)"
                @duplicate-tab="duplicateTab(tab.id)"
              />
            </template>

            <template #suffix>
              <span
                v-if="tab.document.isDirty"
                class="flex w-4 items-center justify-center text-secondary group-hover:hidden"
              >
                <svg
                  viewBox="0 0 24 24"
                  width="1.2em"
                  height="1.2em"
                  class="h-1.5 w-1.5"
                >
                  <circle cx="12" cy="12" r="12" fill="currentColor"></circle>
                </svg>
              </span>
            </template>

            <GraphqlRequestTab
              :model-value="tab"
              @update:model-value="onTabUpdate"
            />
          </HoppSmartWindow>
        </HoppSmartWindows>
      </template>
      <template #sidebar>
        <GraphqlSidebar />
      </template>
    </AppPaneLayout>
    <CollectionsEditRequest
      v-model="editReqModalReqName"
      :show="showRenamingReqNameModalForTabID !== undefined"
      :request-context="requestToRename"
      @submit="renameReqName"
      @hide-modal="showRenamingReqNameModalForTabID = undefined"
    />
    <HoppSmartConfirmModal
      :show="confirmingCloseForTabID !== null"
      :confirm="t('modal.close_unsaved_tab')"
      :title="t('confirm.close_unsaved_tab')"
      @hide-modal="onCloseConfirm"
      @resolve="onResolveConfirm"
    />
    <HoppSmartConfirmModal
      :show="confirmingCloseAllTabs"
      :confirm="t('modal.close_unsaved_tab')"
      :title="t('confirm.close_unsaved_tabs', { count: unsavedTabsCount })"
      @hide-modal="confirmingCloseAllTabs = false"
      @resolve="onResolveConfirmCloseAllTabs"
    />
  </div>
</template>

<script setup lang="ts">
import { usePageHead } from "@composables/head"
import { useI18n } from "@composables/i18n"
import { useService } from "dioc/vue"
import { computed, onBeforeUnmount, ref } from "vue"
import { defineActionHandler } from "~/helpers/actions"
import { connection, disconnect } from "~/helpers/graphql/connection"
import { getDefaultGQLRequest } from "~/helpers/graphql/default"
import { HoppGQLDocument } from "~/helpers/graphql/document"
import { useExplorer } from "~/helpers/graphql/explorer"
import { InspectionService } from "~/services/inspection"
import { HoppTab } from "~/services/tab"
import { GQLTabService } from "~/services/tab/graphql"

const t = useI18n()
const tabs = useService(GQLTabService)
const { reset } = useExplorer()

const currentTabID = computed(() => tabs.currentTabID.value)

const inspectionService = useService(InspectionService)

const confirmingCloseForTabID = ref<string | null>(null)

usePageHead({
  title: computed(() => t("navigation.graphql")),
})

const activeTabs = tabs.getActiveTabs()

const addNewTab = () => {
  const tab = tabs.createNewTab({
    request: getDefaultGQLRequest(),
    isDirty: false,
    cursorPosition: 0,
  })

  tabs.setActiveTab(tab.id)
}
const sortTabs = (e: { oldIndex: number; newIndex: number }) => {
  tabs.updateTabOrdering(e.oldIndex, e.newIndex)
}
const changeTab = (tabID: string) => {
  reset()
  tabs.setActiveTab(tabID)
}

const removeTab = (tabID: string) => {
  const tabState = tabs.getTabRef(tabID).value

  if (tabState.document.isDirty) {
    confirmingCloseForTabID.value = tabID
  } else {
    tabs.closeTab(tabState.id)
    inspectionService.deleteTabInspectorResult(tabState.id)
  }
}

/**
 * This function is closed when the confirm tab is closed by some means (even saving triggers close)
 */
const onCloseConfirm = () => {
  confirmingCloseForTabID.value = null
}

/**
 * Called when the user confirms they want to save the tab
 */
const onResolveConfirm = () => {
  if (confirmingCloseForTabID.value) {
    tabs.closeTab(confirmingCloseForTabID.value)
    confirmingCloseForTabID.value = null
  }
}

const confirmingCloseAllTabs = ref(false)
const unsavedTabsCount = ref(0)
const exceptedTabID = ref<string | null>(null)

const closeOtherTabsAction = (tabID: string) => {
  const dirtyTabCount = tabs.getDirtyTabsCount()
  // If there are dirty tabs, show the confirm modal
  if (dirtyTabCount > 0) {
    confirmingCloseAllTabs.value = true
    unsavedTabsCount.value = dirtyTabCount
    exceptedTabID.value = tabID
  } else {
    tabs.closeOtherTabs(tabID)
  }
}

const onResolveConfirmCloseAllTabs = () => {
  if (exceptedTabID.value) tabs.closeOtherTabs(exceptedTabID.value)
  confirmingCloseAllTabs.value = false
}

const onTabUpdate = (tab: HoppTab<HoppGQLDocument>) => {
  tabs.updateTab(tab)
}

onBeforeUnmount(() => {
  if (connection.state === "CONNECTED") {
    disconnect()
  }
})

const editReqModalReqName = ref("")
const showRenamingReqNameModalForTabID = ref<string>()

const requestToRename = computed(() => {
  if (!showRenamingReqNameModalForTabID.value) return null
  const tab = tabs.getTabRef(showRenamingReqNameModalForTabID.value)
  return tab.value.document.request
})

const openReqRenameModal = (tab: HoppTab<HoppGQLDocument>) => {
  editReqModalReqName.value = tab.document.request.name
  showRenamingReqNameModalForTabID.value = tab.id
}

const renameReqName = () => {
  const tab = tabs.getTabRef(showRenamingReqNameModalForTabID.value!)
  if (tab.value) {
    tab.value.document.request.name = editReqModalReqName.value
    tabs.updateTab(tab.value)
  }
  showRenamingReqNameModalForTabID.value = undefined
}

const duplicateTab = (tabID: string) => {
  const tab = tabs.getTabRef(tabID)
  if (tab.value) {
    const newTab = tabs.createNewTab({
      request: tab.value.document.request,
      isDirty: true,
      cursorPosition: 0,
    })
    tabs.setActiveTab(newTab.id)
  }
}

defineActionHandler("gql.request.open", ({ request, saveContext }) => {
  tabs.createNewTab({
    saveContext,
    request: request,
    isDirty: false,
    cursorPosition: 0,
  })
})

defineActionHandler("request.rename", () => {
  openReqRenameModal(tabs.getTabRef(currentTabID.value).value!)
})

defineActionHandler("tab.duplicate-tab", ({ tabID }) => {
  duplicateTab(tabID ?? currentTabID.value)
})
defineActionHandler("tab.close-current", () => {
  removeTab(currentTabID.value)
})
defineActionHandler("tab.close-other", () => {
  tabs.closeOtherTabs(currentTabID.value)
})
defineActionHandler("tab.open-new", addNewTab)
</script>
