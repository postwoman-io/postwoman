<template>
  <div class="font-sans min-h-screen flex flex-col">
    <div class="p-5 flex flex-col flex-grow gap-y-2">
      <h1 class="font-bold text-lg text-white">Agent Registration Request</h1>
      <p class="tracking-wide">
        An app is trying to register against the Hoppscotch Agent. If this was intentional, copy the given code into
        the app to complete the registration process. Please close the window if you did not initiate this request.
        Do not close this window until the verification code is entered. Once done, this window will close by itself.
      </p>
      <p class="font-bold text-5xl tracking-wider text-center pt-10 text-white">
        {{ otpCode }}
      </p>
    </div>
    <div class="border-t border-divider p-5 flex justify-between">
      <HoppButtonSecondary
        label="Copy Code"
        outline
        filled
        :icon="copyIcon"
        @click="copyCode"
      />
      <HoppButtonPrimary
        label="Close"
        outline
        @click="closeWindow"
      />
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
import { listen } from '@tauri-apps/api/event'

const { copy } = useClipboard()
const otpCode = ref("")
const copyIcon = refAutoReset(markRaw(IconCopy), 3000)

function copyCode() {
  copyIcon.value = markRaw(IconCheck)
  copy(otpCode.value)
}

function closeWindow() {
  const currentWindow = getCurrentWindow()
  currentWindow.close()
}

onMounted(async () => {
  const currentWindow = getCurrentWindow()

  currentWindow.setFocus(true);
  currentWindow.setAlwaysOnTop(true);

  otpCode.value = await invoke("get_otp", {})

  await listen('registration_received', (event) => {
    otpCode.value = event.payload
  })

  await listen('authenticated', () => {
    closeWindow()
  })
})
</script>
