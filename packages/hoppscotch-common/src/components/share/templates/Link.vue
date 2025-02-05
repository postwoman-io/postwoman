<template>
  <div class="flex flex-col items-center p-4 border rounded border-dividerDark">
    <span
      :class="{
        'border-b border-secondary': label,
      }"
    >
      {{ text }}
    </span>
  </div>
</template>

<script lang="ts" setup>
import { computed, onMounted, ref } from "vue"
import { useI18n } from "~/composables/i18n"
import { platform } from "~/platform"

const t = useI18n()

const props = defineProps<{
  link?: string | undefined
  label?: string | undefined
}>()

const organizationDomain = ref<string>("")

onMounted(async () => {
  const { organization } = platform

  if (!organization || organization.isDefaultCloudInstance) {
    return
  }

  const orgInfo = await organization.getOrgInfo()

  if (orgInfo) {
    const { orgDomain } = orgInfo

    organizationDomain.value = orgDomain
  }
})

const shortcodeBaseURL = computed(() => {
  const { organization } = platform

  if (!organization || organization.isDefaultCloudInstance) {
    return import.meta.env.VITE_SHORTCODE_BASE_URL ?? "https://hopp.sh"
  }

  const rootDomain = organization.getRootDomain()
  return `https://${organizationDomain.value}.${rootDomain}`
})

const text = computed(() => {
  return props.label
    ? t(props.label)
    : `${shortcodeBaseURL.value}/r/${props.link ?? "xxxx"}`
})
</script>
