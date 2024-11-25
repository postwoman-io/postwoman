<template>
  <HoppSmartModal
    v-if="show"
    dialog
    :title="t('agent.registrations')"
    @close="emit('hide-modal')"
  >
    <template #body>
      <div class="flex flex-col space-y-4">
        <div v-if="isLoading" class="text-center text-secondaryLight py-4">
          Loading...
        </div>
        <ul
          v-else-if="registrations.length > 0"
          class="mx-4 border border-dividerDark rounded"
        >
          <li
            v-for="(registration, index) in registrations"
            :key="registration.authKey"
            class="flex border-dividerDark px-2 py-2 items-center justify-between"
            :class="{ 'border-t border-dividerDark': index !== 0 }"
          >
            <div class="flex text-xs items-center space-x-2 truncate">
              <span class="text-secondaryLight">
                {{ formatDate(registration.registeredAt) }}
              </span>
              <span class="truncate font-mono">{{
                registration.displayHash
              }}</span>
            </div>
            <div
              v-tippy="{
                theme: 'tooltip',
                content: isOwnRegistration(registration.authKey)
                  ? t('agent.current_registration')
                  : t('action.remove'),
              }"
              class="flex items-center"
            >
              <HoppButtonSecondary
                :icon="IconTrash"
                :disabled="isOwnRegistration(registration.authKey)"
                :class="{
                  'opacity-50 cursor-not-allowed': isOwnRegistration(
                    registration.authKey
                  ),
                }"
                @click="deleteEntry(registration.authKey)"
              />
            </div>
          </li>
        </ul>
        <p v-else class="text-center text-secondaryLight">
          No registrations found
        </p>
      </div>
    </template>
    <template #footer>
      <div class="flex justify-end">
        <HoppButtonSecondary
          :label="t('action.close')"
          filled
          outline
          @click="emit('hide-modal')"
        />
      </div>
    </template>
  </HoppSmartModal>
</template>

<script setup lang="ts">
import IconTrash from "~icons/lucide/trash"
import { useService } from "dioc/vue"
import { ref, watch } from "vue"
import { cloneDeep } from "lodash-es"
import { useI18n } from "@composables/i18n"
import { AgentInterceptorService } from "~/platform/std/interceptors/agent"

interface RegistrationEntry {
  authKey: string
  registeredAt: Date
  displayHash?: string
}

const t = useI18n()
const props = defineProps<{
  show: boolean
}>()
const emit = defineEmits<{
  (e: "hide-modal"): void
}>()

const nativeInterceptorService = useService(AgentInterceptorService)
const registrations = ref<RegistrationEntry[]>([])
const isLoading = ref(false)

function isOwnRegistration(authKey: string): boolean {
  return authKey === nativeInterceptorService.authKey.value
}

function formatDate(date: Date) {
  return new Date(date).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  })
}

async function hashAuthKey(key: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(key)
  const hashBuffer = await crypto.subtle.digest("SHA-256", msgBuffer)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .substring(0, 8)
}

async function processRegistrations(
  regs: RegistrationEntry[]
): Promise<RegistrationEntry[]> {
  const processedRegistrations = cloneDeep(regs)
  for (const reg of processedRegistrations) {
    reg.displayHash = await hashAuthKey(reg.authKey)
  }
  return processedRegistrations
}

watch(
  () => props.show,
  async (show) => {
    if (show) {
      isLoading.value = true
      try {
        await nativeInterceptorService.fetchRegistrations()
        registrations.value = await processRegistrations(
          nativeInterceptorService.registrations?.value ?? []
        )
      } catch (error) {
        console.error("Failed to load registrations:", error)
      } finally {
        isLoading.value = false
      }
    }
  }
)

async function deleteEntry(authKeyToDelete: string) {
  try {
    isLoading.value = true
    await nativeInterceptorService.deleteRegistration(authKeyToDelete)
    await nativeInterceptorService.fetchRegistrations()
    registrations.value = await processRegistrations(
      nativeInterceptorService.registrations?.value ?? []
    )
  } catch (error) {
    console.error("Failed to delete registration:", error)
  } finally {
    isLoading.value = false
  }
}
</script>
