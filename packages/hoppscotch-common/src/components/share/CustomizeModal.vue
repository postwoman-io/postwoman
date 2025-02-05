<template>
  <div
    v-if="selectedWidget"
    class="border divide-y rounded divide-divider border-divider"
  >
    <div v-if="loading" class="px-4 py-2">
      {{ t("shared_requests.creating_widget") }}
    </div>
    <div v-else class="px-4 py-2">
      {{ t("shared_requests.customize") }}
    </div>
    <div v-if="loading" class="flex flex-col items-center justify-center p-4">
      <HoppSmartSpinner class="my-4" />
      <span class="text-secondaryLight">{{ t("state.loading") }}</span>
    </div>
    <div v-else class="flex flex-col divide-y divide-divider">
      <div class="flex flex-col p-2 space-y-2">
        <HoppSmartRadioGroup
          v-model="selectedWidget.value"
          :radios="widgets"
          class="flex !flex-row"
        />
      </div>
      <div class="flex flex-col divide-y divide-divider">
        <div class="flex items-center justify-center px-6 py-4">
          <div v-if="selectedWidget.value === 'embed'" class="w-full">
            <div class="flex flex-col pb-4">
              <div
                v-for="option in embedOptions.tabs"
                :key="option.value"
                class="flex justify-between py-2"
              >
                <span class="capitalize">
                  {{ option.label }}
                </span>
                <HoppSmartCheckbox
                  :on="option.enabled"
                  @change="removeEmbedOption(option.value)"
                >
                </HoppSmartCheckbox>
              </div>
              <div class="flex items-center justify-between">
                <span>
                  {{ t("shared_requests.theme.title") }}
                </span>
                <div>
                  <tippy
                    interactive
                    trigger="click"
                    theme="popover"
                    :on-shown="() => tippyActions!.focus()"
                  >
                    <HoppButtonSecondary
                      class="!py-2 !px-0 capitalize"
                      :label="embedOptions.theme"
                      :icon="embedThemeIcon"
                    />
                    <template #content="{ hide }">
                      <div
                        ref="tippyActions"
                        class="flex flex-col focus:outline-none"
                        tabindex="0"
                        @keyup.escape="hide()"
                      >
                        <HoppSmartItem
                          :label="t('shared_requests.theme.system')"
                          :icon="IconMonitor"
                          :active="embedOptions.theme === 'system'"
                          @click="
                            () => {
                              embedOptions.theme = 'system'
                              hide()
                            }
                          "
                        />
                        <HoppSmartItem
                          :label="t('shared_requests.theme.light')"
                          :icon="IconSun"
                          :active="embedOptions.theme === 'light'"
                          @click="
                            () => {
                              embedOptions.theme = 'light'
                              hide()
                            }
                          "
                        />
                        <HoppSmartItem
                          :label="t('shared_requests.theme.dark')"
                          :icon="IconMoon"
                          :active="embedOptions.theme === 'dark'"
                          @click="
                            () => {
                              embedOptions.theme = 'dark'
                              hide()
                            }
                          "
                        />
                      </div>
                    </template>
                  </tippy>
                </div>
              </div>
            </div>
            <span
              class="flex justify-center mb-2 text-secondaryLight text-tiny"
            >
              {{ t("shared_requests.preview") }}
            </span>
            <ShareTemplatesEmbeds
              :endpoint="request?.endpoint"
              :method="request?.method"
              :model-value="embedOptions"
            />
            <div class="flex items-center justify-center">
              <HoppButtonSecondary
                :label="t('shared_requests.copy_html')"
                class="underline text-secondaryDark"
                @click="
                  copyContent({
                    widget: 'embed',
                    type: 'html',
                  })
                "
              />
            </div>
          </div>
          <div
            v-else-if="selectedWidget.value === 'button'"
            class="flex flex-col space-y-8"
          >
            <div
              v-for="variant in buttonVariants"
              :key="variant.id"
              class="flex flex-col"
            >
              <span
                class="flex justify-center mb-2 text-secondaryLight text-tiny"
              >
                {{ t("shared_requests.preview") }}
              </span>
              <ShareTemplatesButton :img="variant.img" />
              <div class="flex items-center justify-between">
                <HoppButtonSecondary
                  :label="t('shared_requests.copy_html')"
                  class="underline text-secondaryDark"
                  @click="
                    copyContent({
                      widget: 'button',
                      type: 'html',
                      id: variant.id,
                    })
                  "
                />
                <HoppButtonSecondary
                  :label="t('shared_requests.copy_markdown')"
                  class="underline text-secondaryDark"
                  @click="
                    copyContent({
                      widget: 'button',
                      type: 'markdown',
                      id: variant.id,
                    })
                  "
                />
              </div>
            </div>
          </div>
          <div v-else class="flex flex-col space-y-8">
            <div
              v-for="variant in linkVariants"
              :key="variant.type"
              class="flex flex-col items-center justify-center"
            >
              <span
                class="flex justify-center mb-2 text-secondaryLight text-tiny"
              >
                {{ t("shared_requests.preview") }}
              </span>
              <ShareTemplatesLink :link="variant.link" :label="variant.label" />
              <HoppButtonSecondary
                :label="t(`shared_requests.copy_${variant.type}`)"
                class="underline text-secondaryDark"
                @click="
                  copyContent({
                    widget: 'link',
                    type: variant.type,
                    id: variant.id,
                  })
                "
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { useVModel } from "@vueuse/core"
import { computed, onMounted, ref } from "vue"
import { PropType } from "vue"
import { useI18n } from "~/composables/i18n"
import IconMonitor from "~icons/lucide/monitor"
import IconSun from "~icons/lucide/sun"
import IconMoon from "~icons/lucide/moon"
import { TippyComponent } from "vue-tippy"
import { HoppRESTRequest } from "@hoppscotch/data"
import { platform } from "~/platform"

const t = useI18n()

const props = defineProps({
  request: {
    type: Object as PropType<HoppRESTRequest | null>,
    required: true,
  },
  modelValue: {
    type: Object as PropType<Widget | null>,
    default: null,
  },
  loading: {
    type: Boolean,
    default: false,
  },
  embedOptions: {
    type: Object as PropType<EmbedOption>,
    default: () => ({
      selectedTab: "params",
      tabs: [
        {
          value: "params",
          label: "shared_requests.parameters",
          enabled: true,
        },
        {
          value: "body",
          label: "shared_requests.body",
          enabled: true,
        },
        {
          value: "headers",
          label: "shared_requests.headers",
          enabled: true,
        },
        {
          value: "authorization",
          label: "shared_requests.authorization",
          enabled: false,
        },
      ],
      theme: "system",
    }),
  },
})

const emit = defineEmits<{
  (
    e: "copy-shared-request",
    request: {
      sharedRequestID: string | undefined
      content: string | undefined
    }
  ): void
  (e: "hide-modal"): void
  (e: "update:modelValue", value: string): void
}>()

const selectedWidget = useVModel(props, "modelValue")
const embedOptions = useVModel(props, "embedOptions")

type WidgetID = "embed" | "button" | "link"

type Widget = {
  value: WidgetID
  label: string
}

const widgets: Widget[] = [
  {
    value: "embed",
    label: t("shared_requests.embed"),
  },
  {
    value: "button",
    label: t("shared_requests.button"),
  },
  {
    value: "link",
    label: t("shared_requests.link"),
  },
]

type EmbedTabs =
  | "params"
  | "bodyParams"
  | "headers"
  | "authorization"
  | "requestVariables"

type EmbedOption = {
  selectedTab: EmbedTabs
  tabs: {
    value: EmbedTabs
    label: string
    enabled: boolean
  }[]
  theme: "light" | "dark" | "system"
}

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

const embedThemeIcon = computed(() => {
  if (embedOptions.value.theme === "system") {
    return IconMonitor
  } else if (embedOptions.value.theme === "light") {
    return IconSun
  }
  return IconMoon
})

const removeEmbedOption = (option: EmbedTabs) => {
  const index = embedOptions.value.tabs.findIndex((tab) => tab.value === option)
  if (index === -1) return

  //if removed tab is the selected tab, select the next tab with enabled true
  if (embedOptions.value.selectedTab === option) {
    const nextTab = embedOptions.value.tabs.find((tab) => tab.enabled)
    if (nextTab) {
      embedOptions.value.selectedTab = nextTab.value
    }
  }

  embedOptions.value.tabs[index].enabled =
    !embedOptions.value.tabs[index].enabled
}

type ButtonVariant = {
  id: string
  img: string
}
const buttonVariants: ButtonVariant[] = [
  {
    id: "button1",
    img: "badge.svg",
  },
  {
    id: "button2",
    img: "badge-light.svg",
  },
  {
    id: "button3",
    img: "badge-dark.svg",
  },
]

type LinkVariant = {
  id: string
  link?: string
  label?: string
  type: "html" | "markdown" | "link"
}

const linkVariants: LinkVariant[] = [
  {
    id: "link1",
    link: props.request?.id,
    type: "link",
  },
  {
    id: "link2",
    label: "shared_requests.run_in_hoppscotch",
    type: "html",
  },
  {
    id: "link3",
    label: "shared_requests.run_in_hoppscotch",
    type: "markdown",
  },
]

const shortcodeBaseURL = computed(() => {
  const { organization } = platform

  if (!organization || organization.isDefaultCloudInstance) {
    return import.meta.env.VITE_SHORTCODE_BASE_URL ?? "https://hopp.sh"
  }

  const rootDomain = organization.getRootDomain()
  return `https://${organizationDomain.value}.${rootDomain}`
})

const copyEmbed = () => {
  return `<iframe src="${shortcodeBaseURL.value}/e/${props.request?.id}" title="Hoppscotch Embed" style="width: 100%; height: 480px; border-radius: 4px; border: 1px solid rgba(0, 0, 0, 0.1);"></iframe>`
}

const copyButton = (
  variationID: string,
  type: "html" | "markdown" | "link"
) => {
  let badge = ""
  if (variationID === "button1") {
    badge = "badge.svg"
  } else if (variationID === "button2") {
    badge = "badge-light.svg"
  } else {
    badge = "badge-dark.svg"
  }

  if (type === "markdown") {
    return `[![Run in Hoppscotch](${shortcodeBaseURL.value}/${badge})](${shortcodeBaseURL.value}/r/${props.request?.id})`
  }
  return `<a href="${shortcodeBaseURL.value}/r/${props.request?.id}"><img src="${shortcodeBaseURL.value}/${badge}" alt="Run in Hoppscotch" /></a>`
}

const copyLink = (variationID: string) => {
  if (variationID === "link1") {
    return `${shortcodeBaseURL.value}/r/${props.request?.id}`
  } else if (variationID === "link2") {
    return `<a href="${shortcodeBaseURL.value}/r/${props.request?.id}">Run in Hoppscotch</a>`
  }
  return `[Run in Hoppscotch](${shortcodeBaseURL.value}/r/${props.request?.id})`
}

const copyContent = ({
  id,
  widget,
  type,
}: {
  id?: string | undefined
  widget: WidgetID
  type: "html" | "markdown" | "link"
}) => {
  let content = ""
  if (widget === "button") {
    content = copyButton(id!, type)
  } else if (widget === "link") {
    content = copyLink(id!)
  } else {
    content = copyEmbed()
  }
  const copyContent = {
    sharedRequestID: props.request?.id,
    content,
  }
  emit("copy-shared-request", copyContent)
}

const tippyActions = ref<TippyComponent | null>(null)
</script>
