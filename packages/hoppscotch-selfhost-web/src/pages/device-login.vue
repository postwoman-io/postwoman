<template>
  <div class="flex min-h-screen flex-col items-center justify-between">
    <div
      v-if="loginConfirmState === 'done'"
      class="flex flex-1 flex-col items-center justify-center"
    >
      <h1 class="heading">Login Complete</h1>
      <p class="mt-2 text-center">
        You have logged in to the desktop app. <br />
        You can close this browser window.
      </p>
    </div>
    <div
      v-else-if="loginConfirmState === 'error'"
      class="flex flex-1 flex-col items-center justify-center"
    >
      <h1 class="heading">Login Error</h1>
      <p class="mt-2 text-center">
        There was an error while logging you in to the desktop app. <br />
        Make sure you are using the desktop app on the same device and it is
        open and try again.
      </p>
    </div>
    <div
      v-else-if="!currentUser"
      class="flex flex-1 flex-col items-center justify-center"
    >
      <h1 class="heading">Login to Hoppscotch Desktop</h1>
      <p class="mt-2 text-center">Please login to continue.</p>
      <HoppButtonPrimary
        :label="t('auth.login_to_hoppscotch')"
        class="mt-8"
        @click="showLoginModal = true"
      />
    </div>
    <div v-else class="flex flex-1 flex-col items-center justify-center">
      <h1 class="heading">Confirm Desktop Login</h1>
      <p class="mt-2 text-center">
        Are you sure you want to confirm login to your account in Hoppscotch
        Desktop ?
      </p>

      <div class="flex flex-col justify-center pt-4 space-y-4">
        <HoppButtonPrimary
          :label="'Proceed'"
          :loading="loginConfirmState === 'loading'"
          @click="proceedLogin"
        />
        <FirebaseLogout />
      </div>
    </div>

    <footer class="p-4">
      <HoppButtonSecondary
        class="!font-bold tracking-wide !text-secondaryDark"
        label="HOPPSCOTCH"
        to="/"
      />
    </footer>

    <FirebaseLogin
      v-if="!currentUser && showLoginModal"
      @hide-modal="showLoginModal = false"
    />
  </div>
</template>

<script setup lang="ts">
import { useReadonlyStream } from "@hoppscotch/common/composables/stream"
import { platform } from "@hoppscotch/common/platform"
import { useI18n } from "@hoppscotch/common/composables/i18n"
import { onBeforeMount, ref } from "vue"
import { initializeApp } from "@hoppscotch/common/helpers/app"
import axios from "axios"
import { z } from "zod"

const t = useI18n()

const showLoginModal = ref(false)

const currentUser = useReadonlyStream(
  platform.auth.getCurrentUserStream(),
  platform.auth.getCurrentUser()
)

onBeforeMount(() => {
  initializeApp()
})

type LoginConfirmState = "initial" | "loading" | "error" | "done"

const loginConfirmState = ref<LoginConfirmState>("initial")

const DeviceTokenResponse = z.object({
  access_token: z.string(),
  refresh_token: z.string(),
})

async function proceedLogin() {
  loginConfirmState.value = "loading"

  try {
    const url = new URL(window.location.href)
    const redirect_uri = url.searchParams.get("redirect_uri")

    if (!redirect_uri) {
      throw new Error("Redirect URI not found")
    }

    const res = await axios.get(
      `${import.meta.env.VITE_BACKEND_API_URL}/auth/desktop?redirect_uri=${redirect_uri}`,
      {
        withCredentials: true,
      }
    )

    const parseResult = DeviceTokenResponse.safeParse(res.data)

    if (!parseResult.success) {
      throw new Error("Token data returned from backend was invalid")
    }

    const tokens = parseResult.data

    console.info("tokens", tokens)

    await axios.get(
      `${redirect_uri}?access_token=${tokens.access_token}&refresh_token=${tokens.refresh_token}`
    )

    loginConfirmState.value = "done"
  } catch (e) {
    console.error(e)
    loginConfirmState.value = "error"
  }
}
</script>

<route lang="yaml">
meta:
  layout: empty
</route>
