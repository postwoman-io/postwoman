<template>
  <HoppSmartModal
    v-if="show"
    dialog
    :title="t('team.invite')"
    @close="hideModal"
  >
    <template #body>
      <div v-if="sendInvitesResult.length" class="flex flex-col px-4">
        <div class="mb-8 flex max-w-md flex-col items-center justify-center">
          <icon-lucide-users class="h-6 w-6 text-accent" />
          <h3 class="my-2 text-center text-lg">
            {{
              inviteMethod === "email"
                ? t("team.we_sent_invite_link")
                : t("team.invite_sent_smtp_disabled")
            }}
          </h3>
          <p class="text-center">
            {{
              inviteMethod === "email"
                ? t("team.we_sent_invite_link_description")
                : t("team.invite_sent_smtp_disabled_description")
            }}
          </p>
        </div>
        <div v-if="successInvites.length">
          <label class="mb-4 block">
            {{ t("team.success_invites") }}
          </label>
          <div
            class="flex flex-col space-y-6 rounded border border-dividerLight p-4"
          >
            <div
              v-for="(invitee, index) in successInvites"
              :key="`invitee-${index}`"
              class="flex items-center"
            >
              <p class="flex items-center flex-1">
                <component
                  :is="IconMailCheck"
                  class="svg-icons mr-4 text-green-500"
                />
                <span class="truncate">{{ invitee.email }}</span>
                <span class="flex items-center gap-1 ml-auto">
                  <HoppButtonSecondary
                    outline
                    filled
                    :icon="getCopyIcon(invitee.invitationID).value"
                    class="rounded-md"
                    :label="t('team.copy_invite_link')"
                    @click="
                      () => {
                        copyInviteLink(invitee.invitationID)
                      }
                    "
                  />
                </span>
              </p>
            </div>
          </div>
        </div>
        <div v-if="failedInvites.length" class="mt-6">
          <label class="mb-4 block">
            {{ t("team.failed_invites") }}
          </label>
          <div
            class="flex flex-col space-y-6 rounded border border-dividerLight p-4"
          >
            <div
              v-for="(invitee, index) in failedInvites"
              :key="`invitee-${index}`"
              class="flex flex-col"
            >
              <p class="flex items-center">
                <component
                  :is="IconAlertTriangle"
                  class="svg-icons mr-4 text-red-500"
                />
                <span class="truncate">{{ invitee.email }}</span>
              </p>
              <p class="ml-8 mt-1 text-secondaryLight text-tiny">
                {{ getErrorMessage(invitee.error) }}
              </p>
            </div>
          </div>
        </div>
      </div>
      <div
        v-else-if="sendingInvites"
        class="flex items-center justify-center p-4"
      >
        <HoppSmartSpinner />
      </div>
      <div v-else class="flex flex-col">
        <div class="flex flex-1 items-center justify-between">
          <label for="memberList" class="px-4 pb-4">
            {{ t("team.pending_invites") }}
          </label>
        </div>
        <div class="divide-y divide-dividerLight rounded border border-divider">
          <div
            v-if="pendingInvites.loading"
            class="flex items-center justify-center p-4"
          >
            <HoppSmartSpinner />
          </div>
          <div v-else>
            <div
              v-if="!pendingInvites.loading && E.isRight(pendingInvites.data)"
              class="divide-y divide-dividerLight"
            >
              <div
                v-for="(invitee, index) in pendingInvites.data.right.team
                  ?.teamInvitations"
                :key="`invitee-${index}`"
                class="flex divide-x divide-dividerLight"
              >
                <input
                  v-if="invitee"
                  class="flex flex-1 bg-transparent px-4 py-2 text-secondaryLight"
                  :placeholder="`${t('team.email')}`"
                  :name="'param' + index"
                  :value="invitee.inviteeEmail"
                  readonly
                />
                <input
                  class="flex flex-1 bg-transparent px-4 py-2 text-secondaryLight"
                  :placeholder="`${t('team.permissions')}`"
                  :name="'value' + index"
                  :value="invitee.inviteeRole"
                  readonly
                />
                <div class="flex">
                  <HoppButtonSecondary
                    v-tippy="{ theme: 'tooltip' }"
                    outline
                    :icon="getCopyIcon(invitee.id).value"
                    class="rounded-md"
                    :title="t('team.copy_invite_link')"
                    @click="
                      () => {
                        copyInviteLink(invitee.id)
                      }
                    "
                  />
                </div>
                <div class="flex">
                  <HoppButtonSecondary
                    v-tippy="{ theme: 'tooltip' }"
                    :title="t('action.remove')"
                    :icon="IconTrash"
                    color="red"
                    :loading="isLoadingIndex === index"
                    @click="removeInvitee(invitee.id, index)"
                  />
                </div>
              </div>
            </div>
            <HoppSmartPlaceholder
              v-if="
                E.isRight(pendingInvites.data) &&
                pendingInvites.data.right.team?.teamInvitations.length === 0
              "
              :src="`/images/states/${colorMode.value}/add_group.svg`"
              :alt="t('empty.pending_invites')"
              :text="t('empty.pending_invites')"
            />
            <div
              v-if="!pendingInvites.loading && E.isLeft(pendingInvites.data)"
              class="flex flex-col items-center p-4"
            >
              <icon-lucide-help-circle class="svg-icons mb-4" />
              {{ t("error.something_went_wrong") }}
            </div>
          </div>
        </div>
        <div class="flex flex-1 items-center justify-between pt-4">
          <label for="memberList" class="p-4">
            {{ t("team.invite_tooltip") }}
          </label>
          <div class="flex">
            <HoppButtonSecondary
              :icon="IconPlus"
              :label="t('add.new')"
              filled
              @click="addNewInvitee"
            />
          </div>
        </div>
        <div class="divide-y divide-dividerLight rounded border border-divider">
          <div
            v-for="(invitee, index) in newInvites"
            :key="`new-invitee-${index}`"
            class="flex divide-x divide-dividerLight"
          >
            <input
              v-model="invitee.key"
              class="flex flex-1 bg-transparent px-4 py-2"
              :placeholder="`${t('team.email')}`"
              :name="'invitee' + index"
              autofocus
            />
            <span>
              <tippy
                interactive
                trigger="click"
                theme="popover"
                :on-shown="() => tippyActions![index].focus()"
              >
                <HoppSmartSelectWrapper>
                  <input
                    class="flex flex-1 cursor-pointer bg-transparent px-4 py-2"
                    :placeholder="`${t('team.permissions')}`"
                    :name="'value' + index"
                    :value="invitee.value"
                    readonly
                  />
                </HoppSmartSelectWrapper>
                <template #content="{ hide }">
                  <div
                    ref="tippyActions"
                    class="flex flex-col focus:outline-none"
                    tabindex="0"
                    @keyup.escape="hide()"
                  >
                    <HoppSmartItem
                      label="OWNER"
                      :icon="
                        invitee.value === 'OWNER' ? IconCircleDot : IconCircle
                      "
                      :active="invitee.value === 'OWNER'"
                      @click="
                        () => {
                          updateNewInviteeRole(index, TeamMemberRole.Owner)
                          hide()
                        }
                      "
                    />
                    <HoppSmartItem
                      label="EDITOR"
                      :icon="
                        invitee.value === 'EDITOR' ? IconCircleDot : IconCircle
                      "
                      :active="invitee.value === 'EDITOR'"
                      @click="
                        () => {
                          updateNewInviteeRole(index, TeamMemberRole.Editor)
                          hide()
                        }
                      "
                    />
                    <HoppSmartItem
                      label="VIEWER"
                      :icon="
                        invitee.value === 'VIEWER' ? IconCircleDot : IconCircle
                      "
                      :active="invitee.value === 'VIEWER'"
                      @click="
                        () => {
                          updateNewInviteeRole(index, TeamMemberRole.Viewer)
                          hide()
                        }
                      "
                    />
                  </div>
                </template>
              </tippy>
            </span>
            <div class="flex">
              <HoppButtonSecondary
                id="member"
                v-tippy="{ theme: 'tooltip' }"
                :title="t('action.remove')"
                :icon="IconTrash"
                color="red"
                @click="removeNewInvitee(index)"
              />
            </div>
          </div>
          <HoppSmartPlaceholder
            v-if="newInvites.length === 0"
            :src="`/images/states/${colorMode.value}/add_group.svg`"
            :alt="`${t('empty.invites')}`"
            :text="`${t('empty.invites')}`"
          >
            <template #body>
              <HoppButtonSecondary
                :label="t('add.new')"
                filled
                @click="addNewInvitee"
              />
            </template>
          </HoppSmartPlaceholder>
        </div>
        <div
          v-if="newInvites.length"
          class="mt-4 flex flex-col items-start rounded border border-dividerLight px-4 py-4"
        >
          <span
            class="mb-4 flex items-center justify-center rounded-full border border-divider bg-primaryDark px-2 py-1 font-semibold"
          >
            <icon-lucide-help-circle
              class="svg-icons mr-2 text-secondaryLight"
            />
            {{ t("profile.roles") }}
          </span>
          <p>
            <span class="text-secondaryLight">
              {{ t("profile.roles_description") }}
            </span>
          </p>
          <ul class="mt-4 space-y-4">
            <li class="flex">
              <span
                class="max-w-[4rem] w-1/4 truncate font-semibold uppercase text-secondaryDark"
              >
                {{ t("profile.owner") }}
              </span>
              <span class="flex flex-1">
                {{ t("profile.owner_description") }}
              </span>
            </li>
            <li class="flex">
              <span
                class="max-w-[4rem] w-1/4 truncate font-semibold uppercase text-secondaryDark"
              >
                {{ t("profile.editor") }}
              </span>
              <span class="flex flex-1">
                {{ t("profile.editor_description") }}
              </span>
            </li>
            <li class="flex">
              <span
                class="max-w-[4rem] w-1/4 truncate font-semibold uppercase text-secondaryDark"
              >
                {{ t("profile.viewer") }}
              </span>
              <span class="flex flex-1">
                {{ t("profile.viewer_description") }}
              </span>
            </li>
          </ul>
        </div>
      </div>
    </template>
    <template #footer>
      <p
        v-if="sendInvitesResult.length"
        class="flex flex-1 justify-between text-secondaryLight"
      >
        <HoppButtonSecondary
          class="link !p-0"
          :label="t('team.invite_more')"
          :icon="IconArrowLeft"
          @click="
            () => {
              sendInvitesResult = []
              newInvites = [
                {
                  key: '',
                  value: TeamMemberRole.Viewer,
                },
              ]
            }
          "
        />
        <HoppButtonSecondary
          class="link !p-0"
          :label="`${t('action.dismiss')}`"
          @click="hideModal"
        />
      </p>
      <span v-else class="flex space-x-2">
        <HoppButtonPrimary
          :label="t('team.invite')"
          outline
          @click="sendInvites"
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
import { watch, ref, reactive, computed, Ref, onMounted } from "vue"
import * as T from "fp-ts/Task"
import * as E from "fp-ts/Either"
import * as A from "fp-ts/Array"
import * as O from "fp-ts/Option"
import { flow, pipe } from "fp-ts/function"
import { Email, EmailCodec } from "../../helpers/backend/types/Email"
import {
  TeamInvitationAddedDocument,
  TeamInvitationRemovedDocument,
  TeamMemberRole,
  GetPendingInvitesDocument,
  GetPendingInvitesQuery,
  GetPendingInvitesQueryVariables,
} from "../../helpers/backend/graphql"
import {
  createTeamInvitation,
  CreateTeamInvitationErrors,
  revokeTeamInvitation,
} from "../../helpers/backend/mutations/TeamInvitation"
import { GQLError } from "~/helpers/backend/GQLClient"
import { useGQLQuery } from "@composables/graphql"

import { useI18n } from "@composables/i18n"
import { useToast } from "@composables/toast"
import { useColorMode } from "~/composables/theming"

import IconTrash from "~icons/lucide/trash"
import IconPlus from "~icons/lucide/plus"
import IconAlertTriangle from "~icons/lucide/alert-triangle"
import IconMailCheck from "~icons/lucide/mail-check"
import IconCircleDot from "~icons/lucide/circle-dot"
import IconCircle from "~icons/lucide/circle"
import IconArrowLeft from "~icons/lucide/arrow-left"
import IconCopy from "~icons/lucide/copy"
import IconCheck from "~icons/lucide/check"
import { TippyComponent } from "vue-tippy"
import { refAutoReset } from "@vueuse/core"
import { copyToClipboard } from "~/helpers/utils/clipboard"
import { platform } from "~/platform"

const copyIcons: Record<string, Ref<typeof IconCopy | typeof IconCheck>> = {}
const getCopyIcon = (id: string) => {
  if (!copyIcons[id]) {
    copyIcons[id] = refAutoReset<typeof IconCopy | typeof IconCheck>(
      IconCopy,
      1000
    )
  }

  return copyIcons[id]
}

const t = useI18n()

const toast = useToast()

const colorMode = useColorMode()

// Template refs
const tippyActions = ref<TippyComponent[] | null>(null)

const props = defineProps({
  show: Boolean,
  editingTeamID: { type: String, default: null },
})

const emit = defineEmits<{
  (e: "hide-modal"): void
}>()

const inviteMethod = ref<"email" | "link">("email")

onMounted(async () => {
  const getIsSMTPEnabled = platform.infra?.getIsSMTPEnabled

  if (getIsSMTPEnabled) {
    const res = await getIsSMTPEnabled()

    if (E.isRight(res)) {
      inviteMethod.value = res.right ? "email" : "link"
    }
  }
})

const pendingInvites = useGQLQuery<
  GetPendingInvitesQuery,
  GetPendingInvitesQueryVariables,
  ""
>({
  query: GetPendingInvitesDocument,
  variables: reactive({
    teamID: props.editingTeamID,
  }),
  pollDuration: 10000,
  updateSubs: computed(() =>
    !props.editingTeamID
      ? []
      : [
          {
            key: 4,
            query: TeamInvitationAddedDocument,
            variables: {
              teamID: props.editingTeamID,
            },
          },
          {
            key: 5,
            query: TeamInvitationRemovedDocument,
            variables: {
              teamID: props.editingTeamID,
            },
          },
        ]
  ),
  defer: true,
})

watch(
  () => props.show,
  (show) => {
    if (!show) {
      pendingInvites.pause()
    } else {
      pendingInvites.unpause()
    }
  }
)

watch(
  () => props.editingTeamID,
  () => {
    if (props.editingTeamID) {
      pendingInvites.execute({
        teamID: props.editingTeamID,
      })
    }
  }
)

const isLoadingIndex = ref<null | number>(null)

const removeInvitee = async (id: string, index: number) => {
  isLoadingIndex.value = index
  const result = await revokeTeamInvitation(id)()
  if (E.isLeft(result)) {
    toast.error(`${t("error.something_went_wrong")}`)
  } else {
    toast.success(`${t("team.member_removed")}`)
  }
  isLoadingIndex.value = null
}

const newInvites = ref<Array<{ key: string; value: TeamMemberRole }>>([
  {
    key: "",
    value: TeamMemberRole.Viewer,
  },
])

const addNewInvitee = () => {
  newInvites.value.push({
    key: "",
    value: TeamMemberRole.Viewer,
  })
}

const updateNewInviteeRole = (index: number, role: TeamMemberRole) => {
  newInvites.value[index].value = role
}

const removeNewInvitee = (id: number) => {
  newInvites.value.splice(id, 1)
}

const copyInviteLink = (invitationID: string) => {
  copyToClipboard(
    `${import.meta.env.VITE_BASE_URL}/join-team?id=${invitationID}`
  )

  getCopyIcon(invitationID).value = IconCheck
}

type SendInvitesErrorType =
  | {
      email: Email
      status: "error"
      error: GQLError<CreateTeamInvitationErrors>
    }
  | {
      email: Email
      status: "success"
      invitationID: string
    }

const sendInvitesResult = ref<Array<SendInvitesErrorType>>([])
const successInvites = computed(() =>
  sendInvitesResult.value.filter((invitee) => invitee.status === "success")
)
const failedInvites = computed(() =>
  sendInvitesResult.value.filter((invitee) => invitee.status === "error")
)

const sendingInvites = ref<boolean>(false)

const sendInvites = async () => {
  const validationResult = pipe(
    newInvites.value,
    O.fromPredicate(
      (invites): invites is Array<{ key: Email; value: TeamMemberRole }> =>
        pipe(
          invites,
          A.every((invitee) => EmailCodec.is(invitee.key))
        )
    ),
    O.map(
      A.map((invitee) =>
        createTeamInvitation(invitee.key, invitee.value, props.editingTeamID)
      )
    )
  )

  if (O.isNone(validationResult)) {
    // Error handling for no validation
    toast.error(`${t("error.incorrect_email")}`)
    return
  }

  sendingInvites.value = true

  sendInvitesResult.value = await pipe(
    A.sequence(T.task)(validationResult.value),
    T.chain(
      flow(
        A.mapWithIndex((i, el) =>
          pipe(
            el,
            E.foldW(
              (err) => ({
                status: "error" as const,
                email: newInvites.value[i].key as Email,
                error: err,
              }),
              (invitation) => ({
                status: "success" as const,
                email: newInvites.value[i].key as Email,
                invitationID: invitation.id,
              })
            )
          )
        ),
        T.of
      )
    )
  )()

  sendingInvites.value = false
}

const getErrorMessage = (error: SendInvitesErrorType) => {
  if (error.type === "network_error") {
    return t("error.network_error")
  }
  switch (error.error) {
    case "team/invalid_id":
      return t("team.invalid_id")
    case "team/member_not_found":
      return t("team.member_not_found")
    case "team_invite/already_member":
      return t("team.already_member")
    case "team_invite/member_has_invite":
      return t("team.member_has_invite")
    case "user/not_found":
      return t("team.user_not_found")
  }
}

const hideModal = () => {
  sendingInvites.value = false
  sendInvitesResult.value = []
  newInvites.value = [
    {
      key: "",
      value: TeamMemberRole.Viewer,
    },
  ]
  emit("hide-modal")
}
</script>
