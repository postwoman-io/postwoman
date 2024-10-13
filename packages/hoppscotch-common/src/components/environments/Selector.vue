<template>
  <div class="flex divide-x divide-dividerLight">
    <tippy
      interactive
      trigger="click"
      theme="popover"
      :on-shown="() => envSelectorActions!.focus()"
    >
      <HoppSmartSelectWrapper
        v-tippy="{ theme: 'tooltip' }"
        :title="`${t('environment.select')}`"
      >
        <HoppButtonSecondary
          :icon="IconLayers"
          :label="
            mdAndLarger
              ? selectedEnv.type !== 'NO_ENV_SELECTED'
                ? selectedEnv.name
                : `${t('environment.select')}`
              : ''
          "
          class="flex-1 !justify-start rounded-none pr-8"
        />
      </HoppSmartSelectWrapper>
      <template #content="{ hide }">
        <div
          ref="envSelectorActions"
          role="menu"
          class="flex flex-col focus:outline-none"
          tabindex="0"
          @keyup.escape="hide()"
        >
          <HoppSmartItem
            v-if="!isScopeSelector"
            :label="`${t('environment.no_environment')}`"
            :info-icon="
              selectedEnvironmentIndex.type === 'NO_ENV_SELECTED'
                ? IconCheck
                : undefined
            "
            :active-info-icon="
              selectedEnvironmentIndex.type === 'NO_ENV_SELECTED'
            "
            @click="
              () => {
                selectedEnvironmentIndex = { type: 'NO_ENV_SELECTED' }
                hide()
              }
            "
          />
          <HoppSmartItem
            v-else-if="isScopeSelector && modelValue"
            :label="t('environment.global')"
            :icon="IconGlobe"
            :info-icon="modelValue.type === 'global' ? IconCheck : undefined"
            :active-info-icon="modelValue.type === 'global'"
            @click="
              () => {
                $emit('update:modelValue', {
                  type: 'global',
                })
                hide()
              }
            "
          />
          <HoppSmartTabs
            v-model="selectedEnvTab"
            :styles="`sticky overflow-x-auto my-2 border border-divider rounded flex-shrink-0 z-10 top-0 bg-primary ${
              !isTeamSelected || workspace.type === 'personal'
                ? 'bg-primaryLight'
                : ''
            }`"
            render-inactive-tabs
          >
            <HoppSmartTab
              :id="'my-environments'"
              :label="`${t('environment.my_environments')}`"
            >
              <HoppSmartItem
                v-for="{
                  env,
                  index,
                } in alphabeticallySortedPersonalEnvironments"
                :key="`gen-${index}`"
                :icon="IconLayers"
                :label="env.name"
                :info-icon="isEnvActive(index) ? IconCheck : undefined"
                :active-info-icon="isEnvActive(index)"
                @click="
                  () => {
                    handleEnvironmentChange(index, {
                      type: 'my-environment',
                      environment: env,
                    })
                    hide()
                  }
                "
              />
              <HoppSmartPlaceholder
                v-if="alphabeticallySortedPersonalEnvironments.length === 0"
                :src="`/images/states/${colorMode.value}/blockchain.svg`"
                :alt="`${t('empty.environments')}`"
                :text="t('empty.environments')"
              />
            </HoppSmartTab>
            <HoppSmartTab
              :id="'team-environments'"
              :label="`${t('environment.team_environments')}`"
              :disabled="!isTeamSelected || workspace.type === 'personal'"
            >
              <div
                v-if="teamListLoading"
                class="flex flex-col items-center justify-center p-4"
              >
                <HoppSmartSpinner class="my-4" />
                <span class="text-secondaryLight">
                  {{ t("state.loading") }}
                </span>
              </div>
              <div v-if="isTeamSelected" class="flex flex-col">
                <HoppSmartItem
                  v-for="{ env, index } in alphabeticallySortedTeamEnvironments"
                  :key="`gen-team-${index}`"
                  :icon="IconLayers"
                  :label="env.environment.name"
                  :info-icon="isEnvActive(env.id) ? IconCheck : undefined"
                  :active-info-icon="isEnvActive(env.id)"
                  @click="
                    () => {
                      handleEnvironmentChange(index, {
                        type: 'team-environment',
                        environment: env,
                      })
                      hide()
                    }
                  "
                />
                <HoppSmartPlaceholder
                  v-if="alphabeticallySortedTeamEnvironments.length === 0"
                  :src="`/images/states/${colorMode.value}/blockchain.svg`"
                  :alt="`${t('empty.environments')}`"
                  :text="t('empty.environments')"
                />
              </div>
              <div
                v-if="!teamListLoading && teamAdapterError"
                class="flex flex-col items-center py-4"
              >
                <icon-lucide-help-circle class="svg-icons mb-4" />
                {{ t(getEnvActionErrorMessage(teamAdapterError)) }}
              </div>
            </HoppSmartTab>
          </HoppSmartTabs>
        </div>
      </template>
    </tippy>
    <span class="flex">
      <tippy
        interactive
        trigger="click"
        theme="popover"
        :on-shown="() => envQuickPeekActions!.focus()"
      >
        <HoppButtonSecondary
          v-tippy="{ theme: 'tooltip' }"
          :title="`${t('environment.quick_peek')}`"
          :icon="IconEye"
          class="!px-4"
        />
        <template #content="{ hide }">
          <div
            ref="envQuickPeekActions"
            role="menu"
            class="flex flex-col focus:outline-none"
            tabindex="0"
            @keyup.escape="hide()"
          >
            <div
              class="sticky top-0 flex items-center justify-between truncate rounded border border-divider bg-primary pl-4 font-semibold text-secondaryDark"
            >
              {{ t("environment.global_variables") }}
              <HoppButtonSecondary
                v-tippy="{ theme: 'tooltip' }"
                :title="t('action.edit')"
                :icon="IconEdit"
                @click="
                  () => {
                    editGlobalEnv()
                    hide()
                  }
                "
              />
            </div>
            <div class="my-2 flex flex-1 flex-col space-y-2 pl-4 pr-2">
              <div class="flex flex-1 space-x-4">
                <span
                  class="min-w-[9rem] w-1/4 truncate text-tiny font-semibold"
                >
                  {{ t("environment.name") }}
                </span>
                <span
                  class="min-w-[9rem] w-full truncate text-tiny font-semibold"
                >
                  {{ t("environment.value") }}
                </span>
              </div>
              <div
                v-for="(variable, index) in globalEnvs.variables"
                :key="index"
                class="flex flex-1 space-x-4"
              >
                <span class="min-w-[9rem] w-1/4 truncate text-secondaryLight">
                  {{ variable.key }}
                </span>
                <span class="min-w-[9rem] w-full truncate text-secondaryLight">
                  <template v-if="variable.secret"> ******** </template>
                  <template v-else>
                    {{ variable.value }}
                  </template>
                </span>
              </div>
              <div
                v-if="globalEnvs.variables.length === 0"
                class="text-secondaryLight"
              >
                {{ t("environment.empty_variables") }}
              </div>
            </div>
            <div
              class="sticky top-0 mt-2 flex items-center justify-between truncate rounded border border-divider bg-primary pl-4 font-semibold text-secondaryDark"
              :class="{
                'bg-primaryLight': !selectedEnv.variables,
              }"
            >
              {{ t("environment.list") }}
              <HoppButtonSecondary
                v-tippy="{ theme: 'tooltip' }"
                :disabled="!selectedEnv.variables"
                :title="t('action.edit')"
                :icon="IconEdit"
                @click="
                  () => {
                    editEnv()
                    hide()
                  }
                "
              />
            </div>
            <div
              v-if="selectedEnv.type === 'NO_ENV_SELECTED'"
              class="my-2 flex flex-1 flex-col pl-4 text-secondaryLight"
            >
              {{ t("environment.no_active_environment") }}
            </div>
            <div v-else class="my-2 flex flex-1 flex-col space-y-2 pl-4 pr-2">
              <div class="flex flex-1 space-x-4">
                <span
                  class="min-w-[9rem] w-1/4 truncate text-tiny font-semibold"
                >
                  {{ t("environment.name") }}
                </span>
                <span
                  class="min-w-[9rem] w-full truncate text-tiny font-semibold"
                >
                  {{ t("environment.value") }}
                </span>
              </div>
              <div
                v-for="(variable, index) in environmentVariables"
                :key="index"
                class="flex flex-1 space-x-4"
              >
                <span class="min-w-[9rem] w-1/4 truncate text-secondaryLight">
                  {{ variable.key }}
                </span>
                <span class="min-w-[9rem] w-full truncate text-secondaryLight">
                  <template v-if="variable.secret"> ******** </template>
                  <template v-else>
                    {{ variable.value }}
                  </template>
                </span>
              </div>
              <div
                v-if="environmentVariables.length === 0"
                class="text-secondaryLight"
              >
                {{ t("environment.empty_variables") }}
              </div>
            </div>
          </div>
        </template>
      </tippy>
    </span>
  </div>
</template>

<script lang="ts" setup>
import { useColorMode } from "@composables/theming"
import { Environment, GlobalEnvironment } from "@hoppscotch/data"
import { breakpointsTailwind, useBreakpoints } from "@vueuse/core"
import { useService } from "dioc/vue"
import { computed, onMounted, ref, watch } from "vue"
import { TippyComponent } from "vue-tippy"
import { useI18n } from "~/composables/i18n"
import { useReadonlyStream, useStream } from "~/composables/stream"
import { invokeAction } from "~/helpers/actions"
import { GetMyTeamsQuery } from "~/helpers/backend/graphql"
import { getEnvActionErrorMessage } from "~/helpers/error-messages"
import { TeamEnvironment } from "~/helpers/teams/TeamEnvironment"
import TeamEnvironmentAdapter from "~/helpers/teams/TeamEnvironmentAdapter"
import {
  sortPersonalEnvironmentsAlphabetically,
  sortTeamEnvironmentsAlphabetically,
} from "~/helpers/utils/sortEnvironmentsAlphabetically"
import {
  environments$,
  globalEnv$,
  selectedEnvironmentIndex$,
  setSelectedEnvironmentIndex,
} from "~/newstore/environments"
import { useLocalState } from "~/newstore/localstate"
import { WorkspaceService } from "~/services/workspace.service"
import IconCheck from "~icons/lucide/check"
import IconEdit from "~icons/lucide/edit"
import IconEye from "~icons/lucide/eye"
import IconGlobe from "~icons/lucide/globe"
import IconLayers from "~icons/lucide/layers"

type Scope =
  | {
      type: "global"
    }
  | {
      type: "my-environment"
      environment: Environment
      index: number
    }
  | {
      type: "team-environment"
      environment: TeamEnvironment
    }
const props = defineProps<{
  isScopeSelector?: boolean
  modelValue?: Scope
}>()
const emit = defineEmits<{
  (e: "update:modelValue", data: Scope): void
}>()

const breakpoints = useBreakpoints(breakpointsTailwind)
const mdAndLarger = breakpoints.greater("md")

const t = useI18n()

const colorMode = useColorMode()

type EnvironmentType = "my-environments" | "team-environments"

const myEnvironments = useReadonlyStream(environments$, [])

const workspaceService = useService(WorkspaceService)
const workspace = workspaceService.currentWorkspace

// TeamList-Adapter
const teamListAdapter = workspaceService.acquireTeamListAdapter(null)
const myTeams = useReadonlyStream(teamListAdapter.teamList$, null)
const teamListFetched = ref(false)
const REMEMBERED_TEAM_ID = useLocalState("REMEMBERED_TEAM_ID")

const switchToTeamWorkspace = (team: GetMyTeamsQuery["myTeams"][number]) => {
  REMEMBERED_TEAM_ID.value = team.id
  workspaceService.changeWorkspace({
    teamID: team.id,
    teamName: team.name,
    type: "team",
    role: team.myRole,
  })
}
watch(
  () => myTeams.value,
  (newTeams) => {
    if (newTeams && !teamListFetched.value) {
      teamListFetched.value = true
      if (REMEMBERED_TEAM_ID.value) {
        const team = newTeams.find((t) => t.id === REMEMBERED_TEAM_ID.value)
        if (team) switchToTeamWorkspace(team)
      }
    }
  }
)

// TeamEnv List Adapter
const teamEnvListAdapter = new TeamEnvironmentAdapter(undefined)
const teamListLoading = useReadonlyStream(teamEnvListAdapter.loading$, false)
const teamAdapterError = useReadonlyStream(teamEnvListAdapter.error$, null)
const teamEnvironmentList = useReadonlyStream(
  teamEnvListAdapter.teamEnvironmentList$,
  []
)

// Sort environments alphabetically by default
const alphabeticallySortedPersonalEnvironments = computed(() =>
  sortPersonalEnvironmentsAlphabetically(myEnvironments.value, "asc")
)

const alphabeticallySortedTeamEnvironments = computed(() =>
  sortTeamEnvironmentsAlphabetically(teamEnvironmentList.value, "asc")
)

const handleEnvironmentChange = (
  index: number,
  env?:
    | {
        type: "my-environment"
        environment: Environment
      }
    | {
        type: "team-environment"
        environment: TeamEnvironment
      }
) => {
  if (props.isScopeSelector && env) {
    if (env.type === "my-environment") {
      emit("update:modelValue", {
        type: "my-environment",
        environment: env.environment,
        index,
      })
    } else if (env.type === "team-environment") {
      emit("update:modelValue", {
        type: "team-environment",
        environment: env.environment,
      })
    }
  } else {
    if (env && env.type === "my-environment") {
      selectedEnvironmentIndex.value = {
        type: "MY_ENV",
        index,
      }
    } else if (env && env.type === "team-environment") {
      selectedEnvironmentIndex.value = {
        type: "TEAM_ENV",
        teamEnvID: env.environment.id,
        teamID: env.environment.teamID,
        environment: env.environment.environment,
      }
    }
  }
}
const isEnvActive = (id: string | number) => {
  if (props.isScopeSelector) {
    if (props.modelValue?.type === "my-environment") {
      return props.modelValue.index === id
    } else if (props.modelValue?.type === "team-environment") {
      return (
        props.modelValue?.type === "team-environment" &&
        props.modelValue.environment &&
        props.modelValue.environment.id === id
      )
    }
  } else {
    if (selectedEnvironmentIndex.value.type === "MY_ENV") {
      return selectedEnv.value.index === id
    }
    return (
      selectedEnvironmentIndex.value.type === "TEAM_ENV" &&
      selectedEnv.value.teamEnvID === id
    )
  }
}

const selectedEnvironmentIndex = useStream(
  selectedEnvironmentIndex$,
  { type: "NO_ENV_SELECTED" },
  setSelectedEnvironmentIndex
)

const isTeamSelected = computed(
  () => workspace.value.type === "team" && workspace.value.teamID !== undefined
)

const selectedEnvTab = ref<EnvironmentType>("my-environments")

watch(
  () => workspace.value,
  (newVal) => {
    if (newVal.type === "personal") {
      selectedEnvTab.value = "my-environments"
    } else {
      selectedEnvTab.value = "team-environments"
      if (newVal.teamID) {
        teamEnvListAdapter.changeTeamID(newVal.teamID)
      }
    }
  },
  { immediate: true }
)

const selectedEnv = computed(() => {
  if (props.isScopeSelector) {
    if (props.modelValue?.type === "my-environment") {
      return {
        type: "MY_ENV",
        index: props.modelValue.index,
        name: props.modelValue.environment?.name,
        variables: props.modelValue.environment?.variables,
      }
    } else if (props.modelValue?.type === "team-environment") {
      return {
        type: "TEAM_ENV",
        name: props.modelValue.environment.environment.name,
        teamEnvID: props.modelValue.environment.id,
        variables: props.modelValue.environment.environment.variables,
      }
    }
    return {
      type: "global",
      name: "Global",
    }
  }
  if (selectedEnvironmentIndex.value.type === "MY_ENV") {
    const environment =
      myEnvironments.value[selectedEnvironmentIndex.value.index]
    return {
      type: "MY_ENV",
      index: selectedEnvironmentIndex.value.index,
      name: environment.name,
      variables: environment.variables,
    }
  } else if (selectedEnvironmentIndex.value.type === "TEAM_ENV") {
    const teamEnv = teamEnvironmentList.value.find(
      (env) =>
        env.id ===
        (selectedEnvironmentIndex.value.type === "TEAM_ENV" &&
          selectedEnvironmentIndex.value.teamEnvID)
    )
    if (teamEnv) {
      return {
        type: "TEAM_ENV",
        name: teamEnv.environment.name,
        teamEnvID: selectedEnvironmentIndex.value.teamEnvID,
        variables: teamEnv.environment.variables,
      }
    }
    return { type: "NO_ENV_SELECTED" }
  }
  return { type: "NO_ENV_SELECTED" }
})

// Set the selected environment as initial scope value
onMounted(() => {
  if (props.isScopeSelector) {
    if (
      selectedEnvironmentIndex.value.type === "MY_ENV" &&
      selectedEnvironmentIndex.value.index !== undefined
    ) {
      emit("update:modelValue", {
        type: "my-environment",
        environment: myEnvironments.value[selectedEnvironmentIndex.value.index],
        index: selectedEnvironmentIndex.value.index,
      })
    } else if (
      selectedEnvironmentIndex.value.type === "TEAM_ENV" &&
      selectedEnvironmentIndex.value.teamEnvID &&
      teamEnvironmentList.value &&
      teamEnvironmentList.value.length > 0
    ) {
      const teamEnv = teamEnvironmentList.value.find(
        (env) =>
          env.id ===
          (selectedEnvironmentIndex.value.type === "TEAM_ENV" &&
            selectedEnvironmentIndex.value.teamEnvID)
      )
      if (teamEnv) {
        emit("update:modelValue", {
          type: "team-environment",
          environment: teamEnv,
        })
      }
    } else {
      emit("update:modelValue", {
        type: "global",
      })
    }
  }
})

// Template refs
const envSelectorActions = ref<TippyComponent | null>(null)
const envQuickPeekActions = ref<TippyComponent | null>(null)

const globalEnvs = useReadonlyStream(globalEnv$, {} as GlobalEnvironment)

const environmentVariables = computed(() => {
  if (selectedEnv.value.variables) {
    return selectedEnv.value.variables
  }
  return []
})

const editGlobalEnv = () => {
  invokeAction("modals.global.environment.update", {})
}

const editEnv = () => {
  if (selectedEnv.value.type === "MY_ENV" && selectedEnv.value.name) {
    invokeAction("modals.my.environment.edit", {
      envName: selectedEnv.value.name,
    })
  } else if (selectedEnv.value.type === "TEAM_ENV" && selectedEnv.value.name) {
    invokeAction("modals.team.environment.edit", {
      envName: selectedEnv.value.name,
    })
  }
}
</script>
