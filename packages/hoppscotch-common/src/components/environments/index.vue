<template>
  <div>
    <div
      class="sticky top-0 z-10 flex flex-shrink-0 flex-col overflow-x-auto bg-primary"
    >
      <WorkspaceCurrent :section="t('tab.environments')" />
      <EnvironmentsMyEnvironment
        environment-index="Global"
        :environment="globalEnvironment"
        :duplicate-global-environment-loading="
          duplicateGlobalEnvironmentLoading
        "
        :show-context-menu-loading-state="workspace.type === 'team'"
        class="border-b border-dividerLight"
        @duplicate-global-environment="duplicateGlobalEnvironment"
        @edit-environment="editEnvironment('Global')"
      />
    </div>
    <EnvironmentsMy v-show="isPersonalEnvironmentType" />
    <EnvironmentsTeams
      v-show="environmentType.type === 'team-environments'"
      :team="environmentType.selectedTeam"
      :team-environments="teamEnvironmentList"
      :loading="loading"
      :adapter-error="adapterError"
    />
    <EnvironmentsMyDetails
      :show="showModalDetails"
      :action="action"
      :editing-environment-index="editingEnvironmentIndex"
      :editing-variable-name="editingVariableName"
      :env-vars="envVars"
      :is-secret-option-selected="secretOptionSelected"
      @hide-modal="displayModalEdit(false)"
    />
    <EnvironmentsAdd
      :show="showModalNew"
      :name="editingVariableName"
      :value="editingVariableValue"
      :position="position"
      @hide-modal="displayModalNew(false)"
    />
  </div>

  <HoppSmartConfirmModal
    :show="showConfirmRemoveEnvModal"
    :title="`${t('confirm.remove_environment')}`"
    @hide-modal="showConfirmRemoveEnvModal = false"
    @resolve="removeSelectedEnvironment()"
  />
</template>

<script setup lang="ts">
import { useReadonlyStream, useStream } from "@composables/stream"
import { Environment, GlobalEnvironment } from "@hoppscotch/data"
import { useService } from "dioc/vue"
import * as TE from "fp-ts/TaskEither"
import { pipe } from "fp-ts/function"
import { cloneDeep, isEqual } from "lodash-es"
import { computed, ref, watch } from "vue"
import { useI18n } from "~/composables/i18n"
import { useToast } from "~/composables/toast"
import { defineActionHandler } from "~/helpers/actions"
import { GQLError } from "~/helpers/backend/GQLClient"
import {
  createTeamEnvironment,
  deleteTeamEnvironment,
} from "~/helpers/backend/mutations/TeamEnvironment"
import { getEnvActionErrorMessage } from "~/helpers/error-messages"
import TeamEnvironmentAdapter from "~/helpers/teams/TeamEnvironmentAdapter"
import {
  createEnvironment,
  deleteEnvironment,
  getGlobalVariables,
  getSelectedEnvironmentIndex,
  globalEnv$,
  selectedEnvironmentIndex$,
  setSelectedEnvironmentIndex,
} from "~/newstore/environments"
import { useLocalState } from "~/newstore/localstate"
import { platform } from "~/platform"
import { TeamWorkspace, WorkspaceService } from "~/services/workspace.service"

const t = useI18n()
const toast = useToast()

type EnvironmentType = "my-environments" | "team-environments"

type EnvironmentsChooseType = {
  type: EnvironmentType
  selectedTeam: TeamWorkspace | undefined
}

const environmentType = ref<EnvironmentsChooseType>({
  type: "my-environments",
  selectedTeam: undefined,
})

const globalEnv = useReadonlyStream(globalEnv$, {} as GlobalEnvironment)

const globalEnvironment = computed<Environment>(() => ({
  v: 1 as const,
  id: "Global",
  name: "Global",
  variables: globalEnv.value.variables,
}))

const isPersonalEnvironmentType = computed(
  () => environmentType.value.type === "my-environments"
)

const currentUser = useReadonlyStream(
  platform.auth.getCurrentUserStream(),
  platform.auth.getCurrentUser()
)

const workspaceService = useService(WorkspaceService)
const REMEMBERED_TEAM_ID = useLocalState("REMEMBERED_TEAM_ID")

const adapter = new TeamEnvironmentAdapter(undefined)
const adapterLoading = useReadonlyStream(adapter.loading$, false)
const adapterError = useReadonlyStream(adapter.error$, null)
const teamEnvironmentList = useReadonlyStream(adapter.teamEnvironmentList$, [])

const selectedEnvironmentIndex = useStream(
  selectedEnvironmentIndex$,
  { type: "NO_ENV_SELECTED" },
  setSelectedEnvironmentIndex
)

const loading = computed(
  () => adapterLoading.value && teamEnvironmentList.value.length === 0
)

const switchToMyEnvironments = () => {
  environmentType.value.selectedTeam = undefined
  updateEnvironmentType("my-environments")
  adapter.changeTeamID(undefined)
}

const updateSelectedTeam = (newSelectedTeam: TeamWorkspace | undefined) => {
  if (newSelectedTeam) {
    adapter.changeTeamID(newSelectedTeam.teamID)
    environmentType.value.selectedTeam = newSelectedTeam
    REMEMBERED_TEAM_ID.value = newSelectedTeam.teamID
    updateEnvironmentType("team-environments")
  }
}
const updateEnvironmentType = (newEnvironmentType: EnvironmentType) => {
  environmentType.value.type = newEnvironmentType
}

const workspace = workspaceService.currentWorkspace

// Switch to my environments if workspace is personal and to team environments if workspace is team
// also resets selected environment if workspace is personal and the previous selected environment was a team environment
watch(
  workspace,
  (newWorkspace) => {
    const { type: newWorkspaceType } = newWorkspace

    if (newWorkspaceType === "personal") {
      switchToMyEnvironments()
    } else {
      updateSelectedTeam(newWorkspace)
    }

    const newTeamID =
      newWorkspaceType === "team" ? newWorkspace.teamID : undefined

    // Set active environment to the `No environment` state
    // if navigating away from a team workspace
    if (
      selectedEnvironmentIndex.value.type === "TEAM_ENV" &&
      selectedEnvironmentIndex.value.teamID !== newTeamID
    ) {
      setSelectedEnvironmentIndex({
        type: "NO_ENV_SELECTED",
      })
    }
  },
  { immediate: true }
)

watch(
  () => currentUser.value,
  (newValue) => {
    if (!newValue) {
      switchToMyEnvironments()
    }
  }
)

const showConfirmRemoveEnvModal = ref(false)
const showModalNew = ref(false)
const showModalDetails = ref(false)
const action = ref<"new" | "edit">("edit")
const editingEnvironmentIndex = ref<"Global" | null>(null)
const editingVariableName = ref("")
const editingVariableValue = ref("")
const secretOptionSelected = ref(false)
const duplicateGlobalEnvironmentLoading = ref(false)

const position = ref({ top: 0, left: 0 })

const displayModalNew = (shouldDisplay: boolean) => {
  showModalNew.value = shouldDisplay
}

const displayModalEdit = (shouldDisplay: boolean) => {
  action.value = "edit"
  showModalDetails.value = shouldDisplay

  if (!shouldDisplay) resetSelectedData()
}

const editEnvironment = (environmentIndex: "Global") => {
  editingEnvironmentIndex.value = environmentIndex
  action.value = "edit"
  editingVariableName.value = ""
  displayModalEdit(true)
}

const duplicateGlobalEnvironment = async () => {
  if (workspace.value.type === "team") {
    duplicateGlobalEnvironmentLoading.value = true

    await pipe(
      createTeamEnvironment(
        JSON.stringify(globalEnvironment.value.variables),
        workspace.value.teamID,
        `Global - ${t("action.duplicate")}`
      ),
      TE.match(
        (err: GQLError<string>) => {
          console.error(err)

          toast.error(t(getEnvActionErrorMessage(err)))
        },
        () => {
          toast.success(t("environment.duplicated"))
        }
      )
    )()

    duplicateGlobalEnvironmentLoading.value = false

    return
  }

  createEnvironment(
    `Global - ${t("action.duplicate")}`,
    cloneDeep(getGlobalVariables())
  )

  toast.success(`${t("environment.duplicated")}`)
}

const removeSelectedEnvironment = () => {
  const selectedEnvIndex = getSelectedEnvironmentIndex()
  if (selectedEnvIndex?.type === "NO_ENV_SELECTED") return

  if (selectedEnvIndex?.type === "MY_ENV") {
    deleteEnvironment(selectedEnvIndex.index)
    toast.success(`${t("state.deleted")}`)
  }

  if (selectedEnvIndex?.type === "TEAM_ENV") {
    pipe(
      deleteTeamEnvironment(selectedEnvIndex.teamEnvID),
      TE.match(
        (err: GQLError<string>) => {
          console.error(err)
        },
        () => {
          toast.success(`${t("team_environment.deleted")}`)
        }
      )
    )()
  }
}

const resetSelectedData = () => {
  editingEnvironmentIndex.value = null
  editingVariableName.value = ""
  editingVariableValue.value = ""
  secretOptionSelected.value = false
}

defineActionHandler("modals.environment.new", () => {
  action.value = "new"
  showModalDetails.value = true
})

defineActionHandler("modals.environment.delete-selected", () => {
  showConfirmRemoveEnvModal.value = true
})

const additionalVars = ref<Environment["variables"]>([])

const envVars = () => [...globalEnv.value.variables, ...additionalVars.value]

defineActionHandler(
  "modals.global.environment.update",
  ({ variables, isSecret }) => {
    if (variables) {
      additionalVars.value = variables
    }
    secretOptionSelected.value = isSecret ?? false
    editEnvironment("Global")
    editingVariableName.value = "Global"
  }
)

/* Checking if there are any changes in the selected team environment when there are any updates
in the selected team environment list */
watch(
  () => teamEnvironmentList.value,
  (newTeamEnvironmentList) => {
    if (
      newTeamEnvironmentList.length > 0 &&
      selectedEnvironmentIndex.value.type === "TEAM_ENV"
    ) {
      const selectedEnv = newTeamEnvironmentList.find(
        (env) =>
          env.id ===
          (selectedEnvironmentIndex.value.type === "TEAM_ENV" &&
            selectedEnvironmentIndex.value.teamEnvID)
      )

      if (selectedEnv) {
        // Checking if the currently selected environment is still the same after the new list is loaded
        const isChange = !isEqual(
          selectedEnvironmentIndex.value.environment,
          selectedEnv.environment
        )

        if (isChange) {
          selectedEnvironmentIndex.value = {
            type: "TEAM_ENV",
            teamEnvID: selectedEnv.id,
            teamID: selectedEnv.teamID,
            environment: selectedEnv.environment,
          }
        }
      }
    }
  },
  { deep: true }
)

defineActionHandler("modals.environment.add", ({ envName, variableName }) => {
  editingVariableName.value = envName
  editingVariableValue.value = variableName ?? ""
  displayModalNew(true)
})
</script>
