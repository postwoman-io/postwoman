<template>
  <div class="h-screen p-5 flex flex-col gap-y-2">
    <h1 class="font-bold text-lg text-white">{{ pipe(state(), getTitle) }}</h1>

    <template v-if="isOtpView(state())">
      <div v-if="state().otp" class="flex-grow">
        <p class="tracking-wide">
          An app is trying to register against the Hoppscotch Agent. If this was intentional, copy the given code into
          the app to complete the registration process. Please hide the window if you did not initiate this request.
          Do not hide this window until the verification code is entered. The window will hide automatically once done.
        </p>
        <p
          class="font-bold text-5xl tracking-wider text-center pt-10 text-white"
        >{{ pipe(state().otp, O.getOrElse(() => "")) }}</p>
      </div>
      <div v-else class="text-center pt-10 flex-grow">
        <p class="tracking-wide">Waiting for registration requests...</p>
        <p
          class="text-sm text-gray-400 mt-2"
        >You can hide this window and access it again from the tray icon.</p>
      </div>
    </template>

    <template v-else>
      <div class="flex-grow overflow-auto">
        <HoppSmartTable :headings="TABLE_HEADINGS" :list="state().registrations">
          <template #registered_at="{ item }">{{ formatDate(item.registered_at) }}</template>
        </HoppSmartTable>
      </div>
    </template>

    <div class="border-t border-divider p-5 flex justify-between">
      <HoppButtonSecondary
        v-if="shouldShowCopy(state())"
        label="Copy Code"
        outline
        filled
        :icon="copyIcon"
        @click="copyOtp"
      />
      <HoppButtonPrimary label="Hide Window" outline @click="hideWindow" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, markRaw, onMounted } from "vue"
import {
  HoppButtonPrimary,
  HoppButtonSecondary,
  HoppSmartTable,
} from "@hoppscotch/ui"
import IconCopy from "~icons/lucide/copy"
import IconCheck from "~icons/lucide/check"
import { useClipboard, refAutoReset } from "@vueuse/core"
import { getCurrentWindow } from "@tauri-apps/api/window"
import { invoke } from "@tauri-apps/api/core"
import { listen } from "@tauri-apps/api/event"
import { pipe } from "fp-ts/function"
import * as O from "fp-ts/Option"
import * as TE from "fp-ts/TaskEither"
import { orderBy } from "lodash-es"

interface Registration {
  auth_key_hash: string
  registered_at: string
}

interface AppState {
  view: "otp" | "registrations"
  otp: O.Option<string>
  registrations: Registration[]
}

const TABLE_HEADINGS = [
  { key: "auth_key_hash", label: "ID" },
  { key: "registered_at", label: "Registered At" },
] as const

const { copy } = useClipboard()
const copyIcon = refAutoReset(markRaw(IconCopy), 3000)
const appState = ref<AppState>({
  view: "otp",
  otp: O.none,
  registrations: [],
})

const state = () => appState.value

const isOtpView = (s: AppState): boolean => s.view === "otp"
const getTitle = (s: AppState): string =>
  s.view === "otp" ? "Agent Registration Request" : "Agent Registrations"
const shouldShowCopy = (s: AppState): boolean => isOtpView(s) && O.isSome(s.otp)
const formatDate = (date: string): string => new Date(date).toLocaleString()

const getOtp = TE.tryCatch(
  () => invoke<string>("get_otp", {}),
  (error: unknown) => new Error(String(error))
)

const listRegistrations = TE.tryCatch(
  async () => {
    const result = await invoke<{ registrations: Registration[] }>(
      "list_registrations",
      {}
    )
    return orderBy(result.registrations, "registered_at", "desc")
  },
  (error: unknown) => new Error(String(error))
)

const hideWindow = () => {
  getCurrentWindow().hide()
  appState.value = { ...state(), otp: O.none }
}

const copyOtp = () => {
  pipe(
    state().otp,
    O.map((otp: string) => {
      copyIcon.value = markRaw(IconCheck)
      copy(otp)
    })
  )
}

const updateRegistrations = async () => {
  await pipe(
    listRegistrations,
    TE.map((registrations: Registration) => {
      appState.value = { ...state(), registrations }
    })
  )()
}

const handleRegistrationReceived = (payload: string) => {
  appState.value = {
    ...state(),
    view: "otp",
    otp: O.some(payload),
  }
  getCurrentWindow().setFocus()
}

const handleAuthenticated = async () => {
  appState.value = { ...state(), otp: O.none }
  await updateRegistrations()
  hideWindow()
}

const handleShowRegistrations = async () => {
  appState.value = { ...state(), view: "registrations" }
  await updateRegistrations()
}

onMounted(async () => {
  getCurrentWindow().setAlwaysOnTop(true)

  await pipe(
    getOtp,
    TE.map((otp: string) => {
      if (otp) appState.value = { ...state(), otp: O.some(otp) }
    })
  )()

  await Promise.all([
    listen<string>(
      "registration-received",
      ({ payload }: { payload: string }) => handleRegistrationReceived(payload)
    ),
    listen(
      "window-hidden",
      () => (appState.value = { ...state(), otp: O.none })
    ),
    listen("authenticated", handleAuthenticated),
    listen("show-registrations", handleShowRegistrations),
  ])
})
</script>
