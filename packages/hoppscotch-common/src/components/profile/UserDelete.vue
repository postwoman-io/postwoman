<template>
  <section class="p-4">
    <h4 class="font-semibold text-secondaryDark">
      {{ t("settings.delete_account") }}
    </h4>
    <div class="my-1 mb-4 text-secondaryLight">
      {{ t("settings.delete_account_description") }}
    </div>
    <HoppButtonSecondary
      filled
      outline
      :label="t('settings.delete_account_short')"
      type="submit"
      @click="showDeleteAccountModal = true"
    />
    <HoppSmartModal
      v-if="showDeleteAccountModal"
      dialog
      :title="t('settings.delete_account')"
      @close="showDeleteAccountModal = false"
    >
      <template #body>
        <div v-if="loading" class="flex flex-col items-center justify-center">
          <HoppSmartSpinner class="mb-4" />
          <span class="text-secondaryLight">{{ t("state.loading") }}</span>
        </div>
        <div
          v-else-if="myTeams.length"
          class="bg-bannerInfo flex flex-col space-y-2 rounded-lg border border-red-500 p-4 text-secondaryDark"
        >
          <h2 class="font-bold text-red-500">
            {{ t("error.danger_zone") }}
          </h2>
          <div>
            {{ t("error.delete_account") }}
            <ul class="my-4 ml-8 list-disc space-y-2">
              <li v-for="team in myTeams" :key="team.id">
                {{ team.name }}
              </li>
            </ul>
            <span class="font-semibold">
              {{ t("error.delete_account_description") }}
            </span>
          </div>
        </div>
        <div v-else>
          <div
            class="bg-bannerInfo mb-4 flex flex-col space-y-2 rounded-lg border border-red-500 p-4 text-secondaryDark"
          >
            <h2 class="font-bold text-red-500">
              {{ t("error.danger_zone") }}
            </h2>
            <div class="font-medium text-secondaryDark">
              {{ t("settings.delete_account_description") }}
            </div>
          </div>
          <div class="flex flex-col">
            <input
              id="deleteUserAccount"
              v-model="userVerificationInput"
              class="input floating-input"
              placeholder=" "
              type="text"
              autocomplete="off"
            />
            <label for="deleteUserAccount">
              Type
              <span class="font-bold"> delete my account </span>
              to confirm
            </label>
          </div>
        </div>
      </template>
      <template #footer>
        <span class="flex space-x-2">
          <HoppButtonPrimary
            :label="t('settings.delete_account_short')"
            :loading="deletingUser"
            filled
            outline
            :disabled="
              loading ||
              myTeams.length > 0 ||
              userVerificationInput !== 'delete my account'
            "
            class="!hover:bg-red-600 !hover:border-red-600 !border-red-500 !bg-red-500"
            @click="deleteUserAccount"
          />
          <HoppButtonSecondary
            :label="t('action.cancel')"
            outline
            filled
            @click="showDeleteAccountModal = false"
          />
        </span>
      </template>
    </HoppSmartModal>
  </section>
</template>

<script setup lang="ts">
import { pipe } from "fp-ts/function"
import * as TE from "fp-ts/TaskEither"
import { GQLError } from "~/helpers/backend/GQLClient"
import * as E from "fp-ts/Either"
import { ref, watch } from "vue"
import { useRouter } from "vue-router"
import { useI18n } from "~/composables/i18n"
import { GetMyTeamsQuery } from "~/helpers/backend/graphql"
import { useToast } from "~/composables/toast"
import { deleteUser } from "~/helpers/backend/mutations/Profile"
import { platform } from "~/platform"

const t = useI18n()
const toast = useToast()
const router = useRouter()

const showDeleteAccountModal = ref(false)
const userVerificationInput = ref("")

const loading = ref(true)
const myTeams = ref<GetMyTeamsQuery["myTeams"]>([])

watch(showDeleteAccountModal, (isModalOpen) => {
  if (isModalOpen) {
    fetchMyTeams()
  }
})

const fetchMyTeams = async () => {
  loading.value = true

  const result = await platform.backend.getUserTeams()

  loading.value = false

  if (E.isLeft(result)) {
    throw new Error(
      `Failed fetching teams list: ${JSON.stringify(result.left)}`
    )
  }

  myTeams.value = result.right.myTeams.filter((team) => {
    return team.ownersCount === 1 && team.myRole === "OWNER"
  })
}

const deletingUser = ref(false)

const deleteUserAccount = async () => {
  if (deletingUser.value) return
  deletingUser.value = true

  pipe(
    deleteUser(),
    TE.match(
      (err: GQLError<string>) => {
        deletingUser.value = false
        toast.error(getErrorMessage(err))
      },
      () => {
        deletingUser.value = false
        showDeleteAccountModal.value = false
        toast.success(t("settings.account_deleted"))
        platform.auth.signOutUser()
        router.push(`/`)
      }
    )
  )()
}

const getErrorMessage = (err: GQLError<string>) => {
  if (err.type === "network_error") {
    return t("error.network_error")
  }

  return t("error.something_went_wrong")
}
</script>
