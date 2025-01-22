<template>
  <HoppSmartModal v-if="show" dialog :title="t('team.new')" @close="hideModal">
    <template #body>
      <HoppSmartInput
        v-model="editingName"
        :label="t('action.label')"
        placeholder=" "
        input-styles="floating-input"
        @submit="addNewTeam"
      />
    </template>
    <template #footer>
      <span class="flex space-x-2">
        <HoppButtonPrimary
          :label="t('action.save')"
          :loading="isLoading"
          outline
          @click="addNewTeam"
        />
        <HoppButtonSecondary
          :label="t('action.cancel')"
          outline
          filled
          @click="hideModal"
        />
      </span>
    </template>
  </HoppSmartModal>
</template>

<script setup lang="ts">
import { ref } from "vue"
import { pipe } from "fp-ts/function"
import * as TE from "fp-ts/TaskEither"
import { createTeam } from "~/helpers/backend/mutations/Team"
import { TeamNameCodec } from "~/helpers/backend/types/TeamName"
import { useI18n } from "@composables/i18n"
import { useToast } from "@composables/toast"
import { platform } from "~/platform"
import { useService } from "dioc/vue"
import { WorkspaceService } from "~/services/workspace.service"
import { useLocalState } from "~/newstore/localstate"

const t = useI18n()

const toast = useToast()

const props = defineProps<{
  show: boolean
  switchWorkspaceAfterCreation?: boolean
}>()

const emit = defineEmits<{
  (e: "hide-modal"): void
}>()

const editingName = ref<string | null>(null)

const REMEMBERED_TEAM_ID = useLocalState("REMEMBERED_TEAM_ID")

const isLoading = ref(false)

const workspaceService = useService(WorkspaceService)

const addNewTeam = async () => {
  if (isLoading.value) {
    return
  }

  isLoading.value = true
  await pipe(
    TeamNameCodec.decode(editingName.value),
    TE.fromEither,
    TE.mapLeft(() => "invalid_name" as const),
    TE.chainW(createTeam),
    TE.chainFirstIOK(
      () => () =>
        platform.analytics?.logEvent({
          type: "HOPP_CREATE_TEAM",
        })
    ),
    TE.match(
      (err) => {
        // err is of type "invalid_name" | GQLError<Err>
        if (err === "invalid_name") {
          toast.error(`${t("team.name_length_insufficient")}`)
        } else {
          // Handle GQL errors (use err obj)
        }
      },
      (team) => {
        toast.success(`${t("team.new_created")}`)

        if (props.switchWorkspaceAfterCreation) {
          REMEMBERED_TEAM_ID.value = team.id
          workspaceService.changeWorkspace({
            teamID: team.id,
            teamName: team.name,
            type: "team",
            role: team.myRole,
          })
        }

        hideModal()
      }
    )
  )()
  isLoading.value = false
}

const hideModal = () => {
  editingName.value = null
  emit("hide-modal")
}
</script>
