<template>
    <div class="flex" @click="openLoginModal()">
      <HoppSmartItem
        ref="switchItem"
        :icon="IconLogOut"
        :label="`${t('auth.change_accounts')}`"
        :outline="outline"
        :shortcut="shortcut"
      />
      <HoppSmartModal
        v-if="chooseLogin"
        dialog
        :title="`${t('auth.change_accounts')}`"
        styles="sm:max-w-md"
        @close="hideModal"
      >
        <template #body>
          <template v-if="platform.auth.customLoginSelectorUI">
            <component :is="platform.auth.customLoginSelectorUI" />
          </template>

          <template v-else-if="isLoadingAllowedAuthProviders">
            <div class="flex justify-center">
              <HoppSmartSpinner />
            </div>
          </template>

          <template v-else>
            <div v-if="mode === 'sign-in'" class="flex flex-col space-y-2">
              <HoppSmartItem
                v-for="provider in allowedAuthProviders"
                :key="provider.id"
                :loading="provider.isLoading.value"
                :icon="provider.icon"
                :label="provider.label"
                @click="provider.action"
              />

              <hr v-if="additionalLoginItems.length > 0" />

              <HoppSmartItem
                v-for="loginItem in additionalLoginItems"
                :key="loginItem.id"
                :icon="loginItem.icon"
                :label="loginItem.text(t)"
                @click="doAdditionalLoginItemClickAction(loginItem)"
              />
            </div>
            <form
              v-if="mode === 'email'"
              class="flex flex-col space-y-2"
              @submit.prevent="signInWithEmail"
            >
              <HoppSmartInput
                v-model="form.email"
                type="email"
                placeholder=" "
                :label="t('auth.email')"
                input-styles="floating-input"
              />

              <HoppButtonPrimary
                :loading="signingInWithEmail"
                type="submit"
                :label="`${t('auth.send_magic_link')}`"
              />
            </form>
            <div v-if="mode === 'email-sent'" class="flex flex-col px-4">
              <div class="flex max-w-md flex-col items-center justify-center">
                <icon-lucide-inbox class="h-6 w-6 text-accent" />
                <h3 class="my-2 text-center text-lg">
                  {{ t("auth.we_sent_magic_link") }}
                </h3>
                <p class="text-center">
                  {{
                    t("auth.we_sent_magic_link_description", { email: form.email })
                  }}
                </p>
              </div>
            </div>
          </template>
        </template>
        <template #footer>
          <div
            v-if="mode === 'sign-in' && tosLink && privacyPolicyLink"
            class="text-tiny text-secondaryLight"
          >
            By signing in, you are agreeing to our
            <HoppSmartAnchor
              class="link"
              :to="tosLink"
              blank
              label="Terms of Service"
            />
            and
            <HoppSmartAnchor
              class="link"
              :to="privacyPolicyLink"
              blank
              label="Privacy Policy"
            />
          </div>
          <div v-if="mode === 'email'">
            <HoppButtonSecondary
              :label="t('auth.all_sign_in_options')"
              :icon="IconArrowLeft"
              class="!p-0"
              @click="mode = 'sign-in'"
            />
          </div>
          <div
            v-if="mode === 'email-sent'"
            class="flex flex-1 justify-between text-secondaryLight"
          >
            <HoppSmartAnchor
              class="link"
              :label="t('auth.re_enter_email')"
              :icon="IconArrowLeft"
              @click="mode = 'email'"
            />
            <HoppSmartAnchor
              class="link"
              :label="`${t('action.dismiss')}`"
              @click="hideModal"
            />
          </div>
        </template>
      </HoppSmartModal>
    </div>
</template>
  
<script setup lang="ts">
import { Ref, onMounted, ref } from "vue"
import IconLogOut from "~icons/lucide/log-out"
import { useToast } from "@composables/toast"
import { useI18n } from "@composables/i18n"
import { platform } from "~/platform"
import { defineActionHandler } from "~/helpers/actions"

import { useStreamSubscriber } from "@composables/stream"

import IconEmail from "~icons/auth/email"
import IconGithub from "~icons/auth/github"
import IconGoogle from "~icons/auth/google"
import IconMicrosoft from "~icons/auth/microsoft"
import IconArrowLeft from "~icons/lucide/arrow-left"

import { useService } from "dioc/vue"
import { LoginItemDef } from "~/platform/auth"
import { PersistenceService } from "~/services/persistence"

import * as E from "fp-ts/Either"
  
  defineProps({
    outline: {
      type: Boolean,
      default: false,
    },
    shortcut: {
      type: Array,
      default: () => [],
    },
  })
  
  const emit = defineEmits<{
    (e: "confirm-switch"): void
  }>()
  
  const chooseLogin = ref(false)
  const switchItem = ref<HTMLButtonElement>()
  
  const { subscribeToStream } = useStreamSubscriber()
  const toast = useToast()
  const t = useI18n()
  
  // Opens the login modal
  const openLoginModal = () => {
    emit("confirm-switch") // Closes the profile dropdown
    chooseLogin.value = !chooseLogin.value
  }
  
  // Defines the action for opening the login modal
  defineActionHandler("user.switch", () => {
    openLoginModal()
  })

  // Closes the login modal
  const hideModal = () => {
    toast.clear()
    chooseLogin.value = false
  }


  const persistenceService = useService(PersistenceService)

const form = {
  email: "",
}

const isLoadingAllowedAuthProviders = ref(true)

const signingInWithGoogle = ref(false)
const signingInWithGitHub = ref(false)
const signingInWithMicrosoft = ref(false)
const signingInWithEmail = ref(false)
const mode = ref("sign-in")

const tosLink = import.meta.env.VITE_APP_TOS_LINK
const privacyPolicyLink = import.meta.env.VITE_APP_PRIVACY_POLICY_LINK

type AuthProviderItem = {
  id: string
  icon: typeof IconGithub
  label: string
  action: (...args: any[]) => any
  isLoading: Ref<boolean>
}

let allowedAuthProviders: AuthProviderItem[] = []
const additionalLoginItems: LoginItemDef[] = []

const doAdditionalLoginItemClickAction = async (item: LoginItemDef) => {
  await item.onClick()
  emit("hide-modal")
}

onMounted(async () => {
  const currentUser$ = platform.auth.getCurrentUserStream()

  subscribeToStream(currentUser$, (user) => {
    if (user) hideModal()
  })

  const res = await platform.auth.getAllowedAuthProviders()

  if (E.isLeft(res)) {
    toast.error(`${t("error.authproviders_load_error")}`)
    isLoadingAllowedAuthProviders.value = false
    return
  }

  // setup the normal auth providers
  const enabledAuthProviders = authProvidersAvailable.filter((provider) =>
    res.right.includes(provider.id)
  )
  allowedAuthProviders = enabledAuthProviders

  // setup the additional login items
  platform.auth.additionalLoginItems?.forEach((item) => {
    if (res.right.includes(item.id)) {
      additionalLoginItems.push(item)
    }

    // since the BE send the OIDC auth providers as OIDC:providerName,
    // we need to split the string and use the providerName as the text
    if (item.id === "OIDC") {
      res.right
        .filter((provider) => provider.startsWith("OIDC"))
        .forEach((provider) => {
          const OIDCName = provider.split(":")[1]
          const loginItemText = OIDCName
            ? () =>
                t("auth.continue_with_auth_provider", {
                  provider: OIDCName,
                })
            : item.text

          const OIDCLoginItem = {
            ...item,
            text: loginItemText,
          }
          additionalLoginItems.push(OIDCLoginItem)
        })
    }
  })

  isLoadingAllowedAuthProviders.value = false
})

const showLoginSuccess = () => {
  toast.success(`${t("auth.login_success")}`)
}

const signInWithGoogle = async () => {
  signingInWithGoogle.value = true

  try {
    await platform.auth.signInUserWithGoogle()
  } catch (e) {
    console.error(e)
    /*
        A auth/account-exists-with-different-credential Firebase error wont happen between Google and any other providers
        Seems Google account overwrites accounts of other providers https://github.com/firebase/firebase-android-sdk/issues/25
        */
    toast.error(`${t("error.something_went_wrong")}`)
  }

  signingInWithGoogle.value = false
}

const signInWithGithub = async () => {
  signingInWithGitHub.value = true

  const result = await platform.auth.signInUserWithGithub()

  if (!result) {
    signingInWithGitHub.value = false
    return
  }

  if (result.type === "success") {
    // this.showLoginSuccess()
  } else if (result.type === "account-exists-with-different-cred") {
    toast.info(`${t("auth.account_exists")}`, {
      duration: 0,
      closeOnSwipe: false,
      action: {
        text: `${t("action.yes")}`,
        onClick: async (_, toastObject) => {
          await result.link()
          showLoginSuccess()

          toastObject.goAway(0)
        },
      },
    })
  } else {
    console.log("error logging into github", result.err)
    toast.error(`${t("error.something_went_wrong")}`)
  }

  signingInWithGitHub.value = false
}

const signInWithMicrosoft = async () => {
  signingInWithMicrosoft.value = true

  try {
    await platform.auth.signInUserWithMicrosoft()
    // this.showLoginSuccess()
  } catch (e) {
    console.error(e)
    /*
        A auth/account-exists-with-different-credential Firebase error wont happen between MS with Google or Github
        If a Github account exists and user then logs in with MS email we get a "Something went wrong toast" and console errors and MS replaces GH as only provider.
        The error messages are as follows:
            FirebaseError: Firebase: Error (auth/popup-closed-by-user).
            @firebase/auth: Auth (9.6.11): INTERNAL ASSERTION FAILED: Pending promise was never set
        They may be related to https://github.com/firebase/firebaseui-web/issues/947
        */
    toast.error(`${t("error.something_went_wrong")}`)
  }

  signingInWithMicrosoft.value = false
}

const signInWithEmail = async () => {
  signingInWithEmail.value = true

  await platform.auth
    .signInWithEmail(form.email)
    .then(() => {
      mode.value = "email-sent"
      persistenceService.setLocalConfig("emailForSignIn", form.email)
    })
    .catch((e) => {
      console.error(e)
      toast.error(e.message)
      signingInWithEmail.value = false
    })
    .finally(() => {
      signingInWithEmail.value = false
    })
}

const authProvidersAvailable: AuthProviderItem[] = [
  {
    id: "GITHUB",
    icon: IconGithub,
    label: t("auth.continue_with_github"),
    action: signInWithGithub,
    isLoading: signingInWithGitHub,
  },
  // the authprovider either send github or github:enterprise and both are handled by the same route
  {
    id: "GITHUB:ENTERPRISE",
    icon: IconGithub,
    label: t("auth.continue_with_github_enterprise"),
    action: signInWithGithub,
    isLoading: signingInWithGitHub,
  },
  {
    id: "GOOGLE",
    icon: IconGoogle,
    label: t("auth.continue_with_google"),
    action: signInWithGoogle,
    isLoading: signingInWithGoogle,
  },
  {
    id: "MICROSOFT",
    icon: IconMicrosoft,
    label: t("auth.continue_with_microsoft"),
    action: signInWithMicrosoft,
    isLoading: signingInWithMicrosoft,
  },
  {
    id: "EMAIL",
    icon: IconEmail,
    label: t("auth.continue_with_email"),
    action: () => {
      mode.value = "email"
    },
    isLoading: signingInWithEmail,
  },
]



</script>
  