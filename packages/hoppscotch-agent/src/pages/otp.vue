<template>
  <div class="p-5 h-full flex flex-col flex-grow gap-y-2 justify-between">
    <h1 class="font-bold text-lg text-white">Agent Registration Request</h1>
    <div v-if="otpCode">
      <p class="tracking-wide">
        An app is trying to register against the Hoppscotch Agent. If this was intentional, copy the given code into
        the app to complete the registration process. Please hide the window if you did not initiate this request.
        Do not hide this window until the verification code is entered. The window will hide automatically once done.
      </p>
      <p class="font-bold text-5xl tracking-wider text-center pt-10 text-white">{{ otpCode }}</p>
    </div>
    <div v-else class="text-center pt-10">
      <p class="tracking-wide">Waiting for registration requests...</p>
      <p
        class="text-sm text-gray-400 mt-2"
      >You can hide this window and access it again from the tray icon.</p>
    </div>
    <div class="border-t border-divider p-5 flex justify-between">
      <HoppButtonSecondary
        v-if="otpCode"
        label="Copy Code"
        outline
        filled
        :icon="copyIcon"
        @click="copyCode"
      />
      <HoppButtonPrimary label="Hide Window" outline @click="hideWindow" />
    </div>
  </div>
</template>

<script setup>
import { ref, markRaw, onMounted } from "vue"
import { HoppButtonPrimary, HoppButtonSecondary } from "@hoppscotch/ui"
import IconCopy from "~icons/lucide/copy"
import IconCheck from "~icons/lucide/check"
import { useClipboard, refAutoReset } from "@vueuse/core"
import { getCurrentWindow } from "@tauri-apps/api/window"
import { invoke } from "@tauri-apps/api/core"
import { listen } from "@tauri-apps/api/event"

const { copy } = useClipboard()
const otpCode = ref("")
const copyIcon = refAutoReset(markRaw(IconCopy), 3000)

function copyCode() {
  copyIcon.value = markRaw(IconCheck)
  copy(otpCode.value)
}

function hideWindow() {
  const currentWindow = getCurrentWindow()
  currentWindow.hide()
  otpCode.value = ""
}

onMounted(async () => {
  const currentWindow = getCurrentWindow()
  currentWindow.setAlwaysOnTop(true)

  const initialOtp = await invoke("get_otp", {})
  if (initialOtp) {
    otpCode.value = initialOtp
  }

  await listen("registration-received", (event) => {
    otpCode.value = event.payload
    currentWindow.setFocus()
  })

  await listen("window-hidden", () => {
    otpCode.value = ""
  })

  await listen("authenticated", () => {
    otpCode.value = ""
    hideWindow()
  })
})
</script>
