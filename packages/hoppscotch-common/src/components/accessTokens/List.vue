<template>
  <div v-if="isInitialPageLoad" class="flex flex-col items-center py-3">
    <HoppSmartSpinner />
  </div>

  <div
    v-else-if="initialPageLoadHasError"
    class="flex flex-col items-center py-4"
  >
    <icon-lucide-help-circle class="mb-4 svg-icons" />
    {{ t("error.something_went_wrong") }}
  </div>

  <HoppSmartPlaceholder
    v-else-if="accessTokens.length === 0"
    :src="`/images/states/${colorMode.value}/pack.svg`"
    :alt="`${t('empty.access_tokens')}`"
    :text="t('empty.access_tokens')"
    @drop.stop
  />

  <div
    v-else
    class="grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
  >
    <div
      v-for="{ id, label, lastUsedOn, expiresOn } in accessTokens"
      :key="id"
      class="flex flex-col items-center gap-4 p-4 border rounded border-divider"
    >
      <div class="w-full text-sm font-semibold truncate text-secondaryDark">
        {{ label }}
      </div>

      <div class="flex items-center justify-between w-full gap-x-4">
        <div class="space-y-1 text-secondaryLight">
          <div class="space-x-1">
            <span class="font-semibold"
              >{{ t("access_tokens.last_used_on") }}:</span
            >
            <span>
              {{ shortDateTime(lastUsedOn, false) }}
            </span>
          </div>

          <div class="space-x-1">
            <span class="font-semibold"
              >{{ t("access_tokens.expires_on") }}:</span
            >
            <span>
              {{ getTokenExpiryText(expiresOn) }}
            </span>
          </div>
        </div>

        <HoppButtonSecondary
          :label="t('action.delete')"
          filled
          outline
          @click="
            emit('delete-access-token', {
              tokenId: id,
              tokenLabel: label,
            })
          "
        />
      </div>
    </div>
  </div>

  <HoppSmartIntersection
    v-if="hasMoreTokens"
    @intersecting="emit('fetch-more-tokens')"
  >
    <div v-if="loading" class="flex flex-col items-center py-3">
      <HoppSmartSpinner />
    </div>

    <div v-else-if="hasError" class="flex flex-col items-center py-4">
      <icon-lucide-help-circle class="mb-4 svg-icons" />
      {{ t("error.something_went_wrong") }}
    </div>
  </HoppSmartIntersection>
</template>

<script setup lang="ts">
import { useI18n } from "@composables/i18n"
import { useColorMode } from "@composables/theming"
import { computed } from "vue"

import { shortDateTime } from "~/helpers/utils/date"
import { AccessToken } from "./index.vue"

const colorMode = useColorMode()
const t = useI18n()

const props = defineProps<{
  accessTokens: AccessToken[]
  hasMoreTokens: boolean
  loading: boolean
  hasError: boolean
}>()

const emit = defineEmits<{
  (e: "fetch-more-tokens"): void
  (
    e: "delete-access-token",
    { tokenId, tokenLabel }: { tokenId: string; tokenLabel: string }
  ): void
}>()

const isInitialPageLoad = computed(() => props.loading && !props.hasMoreTokens)
const initialPageLoadHasError = computed(
  () => props.hasError && !props.hasMoreTokens
)

const getTokenExpiryText = (tokenExpiresOn: string | null) => {
  if (!tokenExpiresOn) {
    return t("access_tokens.no_expiration")
  }

  const isTokenExpired = new Date(tokenExpiresOn).toISOString() > tokenExpiresOn

  return isTokenExpired
    ? t("access_tokens.expired")
    : shortDateTime(tokenExpiresOn, false)
}
</script>
