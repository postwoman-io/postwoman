<template>
  <span v-if="show">
    {{ envName ?? t("filter.none") }}
  </span>
</template>

<script lang="ts" setup>
import { useService } from "dioc/vue"
import { computed, watch } from "vue"
import { useI18n } from "~/composables/i18n"
import { useReadonlyStream, useStream } from "~/composables/stream"
import TeamEnvironmentAdapter from "~/helpers/teams/TeamEnvironmentAdapter"
import {
  environments$,
  selectedEnvironmentIndex$,
  setSelectedEnvironmentIndex,
} from "~/newstore/environments"
import { WorkspaceService } from "~/services/workspace.service"

const t = useI18n()

withDefaults(
  defineProps<{
    show?: boolean
  }>(),
  {
    show: true,
  }
)

const emit = defineEmits<{
  (e: "select-env", data: any): void
}>()

const workspaceService = useService(WorkspaceService)
const workspace = workspaceService.currentWorkspace

const envName = computed(() => selectedEnv.value?.name ?? null)

const currentEnv = useStream(
  selectedEnvironmentIndex$,
  { type: "NO_ENV_SELECTED" },
  setSelectedEnvironmentIndex
)

const teamEnvironmentAdapter = new TeamEnvironmentAdapter(
  workspace.value.type === "team" ? workspace.value.teamID : undefined
)
const teamEnvironmentList = useReadonlyStream(
  teamEnvironmentAdapter.teamEnvironmentList$,
  []
)
const myEnvironments = useReadonlyStream(environments$, [])
const activeWorkspace = workspace.value

export type CurrentEnv =
  | {
      type: "MY_ENV"
      index: number
      name: string
    }
  | { type: "TEAM_ENV"; name: string; teamEnvID: string }
  | null

const selectedEnv = computed<CurrentEnv>(() => {
  if (
    activeWorkspace.type === "personal" &&
    currentEnv.value.type === "MY_ENV"
  ) {
    const environment = myEnvironments.value[currentEnv.value.index]
    return {
      type: "MY_ENV",
      index: currentEnv.value.index,
      name: environment.name,
    }
  }

  if (activeWorkspace.type === "team" && currentEnv.value.type === "TEAM_ENV") {
    const teamEnv = teamEnvironmentList.value.find((env) => {
      return (
        env.id ===
        (currentEnv.value.type === "TEAM_ENV" && currentEnv.value.teamEnvID)
      )
    })

    if (teamEnv) {
      return {
        type: "TEAM_ENV",
        name: teamEnv.environment.name,
        teamEnvID: currentEnv.value.teamEnvID,
      }
    }
  }
  return null // Return null or a default value if no environment is selected
})

watch(
  () => selectedEnv.value,
  (newVal) => {
    if (newVal) emit("select-env", newVal)
  },
  { immediate: true }
)
</script>
