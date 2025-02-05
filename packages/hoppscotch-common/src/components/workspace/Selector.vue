<template>
  <div ref="rootEl">
    <div class="flex flex-col">
      <div class="flex flex-col">
        <HoppSmartItem
          :label="t('workspace.personal')"
          :icon="IconUser"
          :info-icon="workspace.type === 'personal' ? IconDone : undefined"
          :active-info-icon="workspace.type === 'personal'"
          @click="switchToPersonalWorkspace"
        />
        <hr />
      </div>
      <div v-if="loading" class="flex flex-col items-center justify-center p-4">
        <HoppSmartSpinner class="mb-4" />
        <span class="text-secondaryLight">{{ t("state.loading") }}</span>
      </div>
      <HoppSmartPlaceholder
        v-if="!loading && myTeams.length === 0"
        :src="`/images/states/${colorMode.value}/add_group.svg`"
        :alt="`${t('empty.teams')}`"
        :text="`${t('empty.teams')}`"
      >
        <template #body>
          <HoppButtonSecondary
            :label="t('team.create_new')"
            filled
            outline
            :icon="IconPlus"
            @click="displayModalAdd(true)"
          />
        </template>
      </HoppSmartPlaceholder>
      <div v-else-if="!loading" class="flex flex-col">
        <div
          class="sticky top-0 z-10 mb-2 flex items-center justify-between bg-popover py-2 pl-2"
        >
          <div class="flex items-center px-2 font-semibold text-secondaryLight">
            {{ t("workspace.other_workspaces") }}
          </div>
          <HoppButtonSecondary
            v-tippy="{ theme: 'tooltip' }"
            :icon="IconPlus"
            :title="`${t('team.create_new')}`"
            outline
            filled
            class="ml-8 rounded !p-0.75"
            @click="displayModalAdd(true)"
          />
        </div>
        <HoppSmartItem
          v-for="(team, index) in myTeams"
          :key="`team-${String(index)}`"
          :icon="IconUsers"
          :label="team.name"
          :info-icon="isActiveWorkspace(team.id) ? IconDone : undefined"
          :active-info-icon="isActiveWorkspace(team.id)"
          @click="switchToTeamWorkspace(team)"
        />
      </div>
      <div
        v-else-if="teamListAdapterError"
        class="flex flex-col items-center py-4"
      >
        <icon-lucide-help-circle class="svg-icons mb-4" />
        {{ t("error.something_went_wrong") }}
      </div>

      <div v-if="showCreateOrganizationCTA" class="flex flex-col">
        <hr />
        <HoppButtonPrimary
          :label="t('organization.create_an_organization')"
          to="/orgs"
        />
      </div>
    </div>
    <TeamsAdd
      :show="showModalAdd"
      :switch-workspace-after-creation="true"
      @hide-modal="displayModalAdd(false)"
    />
  </div>
</template>
<script setup lang="ts">
import { computed, ref, watch } from "vue"
import { useReadonlyStream } from "~/composables/stream"
import { platform } from "~/platform"
import { useI18n } from "@composables/i18n"
import IconUser from "~icons/lucide/user"
import IconUsers from "~icons/lucide/users"
import IconPlus from "~icons/lucide/plus"
import { useColorMode } from "@composables/theming"
import { GetMyTeamsQuery } from "~/helpers/backend/graphql"
import IconDone from "~icons/lucide/check"
import { useLocalState } from "~/newstore/localstate"
import { defineActionHandler, invokeAction } from "~/helpers/actions"
import { WorkspaceService } from "~/services/workspace.service"
import { useService } from "dioc/vue"
import { useElementVisibility, useIntervalFn } from "@vueuse/core"

const t = useI18n()
const colorMode = useColorMode()

const showModalAdd = ref(false)

const currentUser = useReadonlyStream(
  platform.auth.getProbableUserStream(),
  platform.auth.getProbableUser()
)

const workspaceService = useService(WorkspaceService)
const teamListadapter = workspaceService.acquireTeamListAdapter(null)
const myTeams = useReadonlyStream(teamListadapter.teamList$, [])
const isTeamListLoading = useReadonlyStream(teamListadapter.loading$, false)
const teamListAdapterError = useReadonlyStream(teamListadapter.error$, null)
const REMEMBERED_TEAM_ID = useLocalState("REMEMBERED_TEAM_ID")
const teamListFetched = ref(false)

const rootEl = ref<HTMLElement>()
const elVisible = useElementVisibility(rootEl)

const { pause: pauseListPoll, resume: resumeListPoll } = useIntervalFn(() => {
  if (teamListadapter.isInitialized) {
    teamListadapter.fetchList()
  }
}, 10000)

watch(
  elVisible,
  () => {
    if (elVisible.value) {
      teamListadapter.fetchList()

      resumeListPoll()
    } else {
      pauseListPoll()
    }
  },
  { immediate: true }
)

watch(myTeams, (teams) => {
  if (teams && !teamListFetched.value) {
    teamListFetched.value = true
    if (REMEMBERED_TEAM_ID.value && currentUser.value) {
      const team = teams.find((t) => t.id === REMEMBERED_TEAM_ID.value)
      if (team) switchToTeamWorkspace(team)
    }
  }
})

const loading = computed(
  () => isTeamListLoading.value && myTeams.value.length === 0
)

const workspace = workspaceService.currentWorkspace

const isActiveWorkspace = computed(() => (id: string) => {
  if (workspace.value.type === "personal") return false
  return workspace.value.teamID === id
})

const showCreateOrganizationCTA = computed(() => {
  const { organization } = platform

  return organization?.isDefaultCloudInstance ?? false
})

const switchToTeamWorkspace = (team: GetMyTeamsQuery["myTeams"][number]) => {
  REMEMBERED_TEAM_ID.value = team.id
  workspaceService.changeWorkspace({
    teamID: team.id,
    teamName: team.name,
    type: "team",
    role: team.myRole,
  })
}

const switchToPersonalWorkspace = () => {
  REMEMBERED_TEAM_ID.value = undefined
  workspaceService.changeWorkspace({
    type: "personal",
  })
}

watch(
  () => currentUser.value,
  (user) => {
    if (!user) {
      switchToPersonalWorkspace()
      teamListadapter.dispose()
    }
  }
)

const displayModalAdd = (shouldDisplay: boolean) => {
  if (!currentUser.value) return invokeAction("modals.login.toggle")

  showModalAdd.value = shouldDisplay
  teamListadapter.fetchList()
}

defineActionHandler("modals.team.new", () => {
  displayModalAdd(true)
})

defineActionHandler("workspace.switch.personal", switchToPersonalWorkspace)
defineActionHandler("workspace.switch", ({ teamId }) => {
  const team = myTeams.value.find((t) => t.id === teamId)
  if (team) switchToTeamWorkspace(team)
})
</script>
