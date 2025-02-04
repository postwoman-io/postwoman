<template>
  <WorkspaceCurrent :section="section">
    <template #item>
      <component
        :is="platform.ui?.additionalSidebarHeaderItem"
        v-if="
          props.selectedTab === 'history' &&
          historyUIProviderService.isEnabled.value
        "
      />
    </template>
  </WorkspaceCurrent>
  <HistoryPersonal
    v-if="workspace === 'personal' || !historyUIProviderService.isEnabled.value"
    :page="page"
  />
  <component :is="platform.ui?.additionalHistoryComponent" v-else />
</template>

<script setup lang="ts">
import { useService } from "dioc/vue"
import { computed } from "vue"
import { useI18n } from "~/composables/i18n"
import { platform } from "~/platform"
import { HistoryUIProviderService } from "~/services/history-ui-provider.service"
import { WorkspaceService } from "~/services/workspace.service"

const t = useI18n()

const props = defineProps<{
  page: "rest" | "graphql"
  selectedTab: string
}>()

const workspaceService = useService(WorkspaceService)
const historyUIProviderService = useService(HistoryUIProviderService)

const workspace = computed(() => workspaceService.currentWorkspace.value.type)
const section = computed(() =>
  workspace.value === "personal" || !historyUIProviderService.isEnabled.value
    ? t("tab.history")
    : historyUIProviderService.historyUIProviderTitle.value(t)
)
</script>
