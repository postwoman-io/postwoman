<template>
  <div class="space-y-4">
    <div>
      <p class="flex items-center">
        <span
          class="inline-flex items-center justify-center flex-shrink-0 mr-4 border-4 rounded-full border-primary text-dividerDark"
          :class="{
            '!text-green-500': hasURL,
          }"
        >
          <icon-lucide-check-circle class="svg-icons" />
        </span>
        <span>
          {{ t(caption) }}
        </span>
      </p>

      <p v-if="description" class="ml-10 mt-2 text-secondaryLight">
        {{ t(description) }}
      </p>
    </div>

    <p class="flex flex-col">
      <input
        v-model="inputChooseGistToImportFrom"
        type="url"
        class="input"
        :placeholder="`${t('import.from_url')}`"
      />
    </p>

    <div>
      <HoppButtonPrimary
        class="w-full"
        :label="t('import.title')"
        :disabled="disableImportCTA"
        :loading="isFetchingUrl || loading"
        @click="fetchUrlData"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue"
import { useI18n } from "@composables/i18n"
import { useToast } from "~/composables/toast"
import axios, { AxiosResponse } from "axios"

const t = useI18n()

const toast = useToast()

const props = withDefaults(
  defineProps<{
    caption: string
    fetchLogic?: (url: string) => Promise<AxiosResponse<any>>
    loading?: boolean
    description?: string
  }>(),
  { fetchLogic: undefined, loading: false, description: undefined }
)

const emit = defineEmits<{
  (e: "importFromURL", content: unknown): void
}>()

const inputChooseGistToImportFrom = ref<string>("")
const hasURL = ref(false)

const isFetchingUrl = ref(false)

watch(inputChooseGistToImportFrom, (url) => {
  hasURL.value = !!url
})

const disableImportCTA = computed(() => !hasURL.value || props.loading)

const urlFetchLogic =
  props.fetchLogic ??
  async function (url: string) {
    const res = await axios.get(url, {
      transitional: {
        forcedJSONParsing: false,
        silentJSONParsing: false,
        clarifyTimeoutError: true,
      },
    })

    return res
  }

async function fetchUrlData() {
  isFetchingUrl.value = true

  try {
    const res = await urlFetchLogic(inputChooseGistToImportFrom.value)

    if (res.status === 200) {
      emit("importFromURL", res.data)
    }
  } catch (e) {
    toast.error(t("import.failed"))
    console.log(e)
  } finally {
    isFetchingUrl.value = false
  }
}
</script>
