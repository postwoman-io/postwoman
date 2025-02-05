<template>
  <div class="flex min-h-screen flex-col items-center justify-between">
    <div
      v-if="invalidLink"
      class="flex flex-1 flex-col items-center justify-center"
    >
      <icon-lucide-alert-triangle class="svg-icons mb-2 opacity-75" />
      <h1 class="heading text-center">
        {{ t("team.invalid_invite_link") }}
      </h1>
      <p class="mt-2 text-center">
        {{ t("team.invalid_invite_link_description") }}
      </p>
    </div>
    <div
      v-else-if="loadingCurrentUser"
      class="flex flex-1 flex-col items-center justify-center p-4"
    >
      <HoppSmartSpinner />
    </div>
    <div
      v-else-if="currentUser === null"
      class="flex flex-1 flex-col items-center justify-center p-4"
    >
      <h1 class="heading">{{ t("team.login_to_continue") }}</h1>
      <p class="mt-2">{{ t("team.login_to_continue_description") }}</p>
      <HoppButtonPrimary
        :label="t('auth.login_to_hoppscotch')"
        class="mt-8"
        @click="invokeAction('modals.login.toggle')"
      />
    </div>
    <div v-else class="flex flex-1 flex-col items-center justify-center p-4">
      <div
        v-if="inviteDetails.loading"
        class="flex flex-1 flex-col items-center justify-center p-4"
      >
        <HoppSmartSpinner />
      </div>
      <div v-else>
        <div
          v-if="!inviteDetails.loading && E.isLeft(inviteDetails.data)"
          class="flex flex-col items-center p-4"
        >
          <icon-lucide-alert-triangle class="svg-icons mb-4" />
          <p>
            {{ getErrorMessage(inviteDetails.data.left) }}
          </p>
          <p
            class="mt-8 flex flex-col items-center rounded border border-dividerLight p-4"
          >
            <span class="mb-4">
              {{ t("team.logout_and_try_again") }}
            </span>
            <span class="flex">
              <FirebaseLogout
                v-if="inviteDetails.data.left.type === 'gql_error'"
                outline
              />
            </span>
          </p>
        </div>
        <div
          v-if="
            !inviteDetails.loading &&
            E.isRight(inviteDetails.data) &&
            !joinTeamSuccess
          "
          class="flex flex-1 flex-col items-center justify-center p-4"
        >
          <h1 class="heading">
            {{
              t("team.join_team", {
                workspace: inviteDetails.data.right.teamInvitation.team.name,
              })
            }}
          </h1>
          <p class="mt-2 text-secondaryLight">
            {{
              t("team.invited_to_team", {
                owner:
                  inviteDetails.data.right.teamInvitation.creator.displayName ??
                  inviteDetails.data.right.teamInvitation.creator.email,
                workspace: inviteDetails.data.right.teamInvitation.team.name,
              })
            }}
          </p>
          <div class="mt-8">
            <HoppButtonPrimary
              :label="
                t('team.join_team', {
                  workspace: inviteDetails.data.right.teamInvitation.team.name,
                })
              "
              :loading="loading"
              :disabled="revokedLink"
              @click="joinTeam"
            />
          </div>
        </div>
        <div
          v-if="
            !inviteDetails.loading &&
            E.isRight(inviteDetails.data) &&
            joinTeamSuccess
          "
          class="flex flex-1 flex-col items-center justify-center p-4"
        >
          <h1 class="heading">
            {{
              t("team.joined_team", {
                workspace: inviteDetails.data.right.teamInvitation.team.name,
              })
            }}
          </h1>
          <p class="mt-2 text-secondaryLight">
            {{
              t("team.joined_team_description", {
                workspace: inviteDetails.data.right.teamInvitation.team.name,
              })
            }}
          </p>
          <div class="mt-8">
            <HoppButtonSecondary
              to="/"
              :icon="IconHome"
              filled
              :label="t('app.home')"
            />
          </div>
        </div>
      </div>
    </div>
    <div class="p-4">
      <HoppButtonSecondary
        class="!font-bold tracking-wide !text-secondaryDark"
        label="HOPPSCOTCH"
        to="/"
      />
    </div>
  </div>
</template>

<script lang="ts" setup>
import * as E from "fp-ts/Either"
import * as TE from "fp-ts/TaskEither"
import { pipe } from "fp-ts/function"
import { computed, onBeforeMount, onMounted, ref } from "vue"
import { useRoute } from "vue-router"

import { onLoggedIn } from "@composables/auth"
import { useReadonlyStream } from "@composables/stream"
import { useToast } from "@composables/toast"
import { invokeAction } from "@helpers/actions"
import { useI18n } from "~/composables/i18n"
import { initializeApp } from "~/helpers/app"
import { GQLError } from "~/helpers/backend/GQLClient"
import { acceptTeamInvitation } from "~/helpers/backend/mutations/TeamInvitation"
import { platform } from "~/platform"
import IconHome from "~icons/lucide/home"

type GetInviteDetailsError =
  | "team_invite/not_valid_viewer"
  | "team_invite/not_found"
  | "team_invite/no_invite_found"
  | "team_invite/email_do_not_match"
  | "team_invite/already_member"

// Data properties
const invalidLink = ref(false)
const loading = ref(false)
const revokedLink = ref(false)
const inviteID = ref("")
const joinTeamSuccess = ref(false)

const route = useRoute()

const inviteDetails = platform.backend.getInviteDetails<GetInviteDetailsError>(
  route.query.id as string
)

// Lifecycle hooks
onBeforeMount(() => {
  initializeApp()
})

onMounted(async () => {
  if (typeof route.query.id === "string") {
    inviteID.value = route.query.id
  }
  invalidLink.value = !inviteID.value
  // TODO: check revokeTeamInvitation
  // TODO: check if the logged-in user is already a member
})

onLoggedIn(async () => {
  if (typeof route.query.id === "string") {
    inviteDetails.execute({
      inviteID: route.query.id,
    })
  }
})

const probableUser = useReadonlyStream(
  platform.auth.getProbableUserStream(),
  platform.auth.getProbableUser()
)

const currentUser = useReadonlyStream(
  platform.auth.getCurrentUserStream(),
  platform.auth.getCurrentUser()
)

const loadingCurrentUser = computed(() => {
  if (!probableUser.value) return false
  if (!currentUser.value) return true
  return false
})

const toast = useToast()
const t = useI18n()

const joinTeam = () => {
  loading.value = true
  pipe(
    acceptTeamInvitation(inviteID.value),
    TE.matchW(
      () => {
        loading.value = false
        toast.error(`${t("error.something_went_wrong")}`)
      },
      () => {
        joinTeamSuccess.value = true
        loading.value = false
      }
    )
  )()
}

const getErrorMessage = (error: GQLError<GetInviteDetailsError>) => {
  if (error.type === "network_error") {
    return t("error.network_error")
  }
  switch (error.error) {
    case "team_invite/not_valid_viewer":
      return t("team.not_valid_viewer")
    case "team_invite/not_found":
      return t("team.not_found")
    case "team_invite/no_invite_found":
      return t("team.no_invite_found")
    case "team_invite/already_member":
      return t("team.already_member")
    case "team_invite/email_do_not_match":
      return t("team.email_do_not_match")
    default:
      return t("error.something_went_wrong")
  }
}
</script>
