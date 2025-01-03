<template>
  <div class="flex h-screen w-screen">
    <Splitpanes class="no-splitter" :dbl-click-splitter="false" horizontal>
      <Pane style="height: auto">
        <AppHeader />
      </Pane>
      <Pane :class="spacerClass" class="flex flex-1 !overflow-auto md:mb-0">
        <Splitpanes
          class="no-splitter"
          :dbl-click-splitter="false"
          :horizontal="!mdAndLarger"
        >
          <Pane
            style="width: auto; height: auto"
            class="hidden !overflow-auto md:flex md:flex-col"
          >
            <AppSidenav />
          </Pane>
          <Pane class="flex flex-1 !overflow-auto">
            <Splitpanes
              class="no-splitter"
              :dbl-click-splitter="false"
              horizontal
            >
              <Pane class="flex flex-1 !overflow-auto">
                <main class="flex w-full flex-1" role="main">
                  <RouterView
                    v-slot="{ Component }"
                    class="flex min-w-0 flex-1"
                  >
                    <Transition name="fade" mode="out-in" appear>
                      <component :is="Component" />
                    </Transition>
                  </RouterView>
                </main>
              </Pane>
            </Splitpanes>
          </Pane>
        </Splitpanes>
      </Pane>
      <Pane v-if="mdAndLarger" style="height: auto">
        <AppFooter />
      </Pane>
      <Pane
        v-else
        style="height: auto"
        class="fixed inset-x-0 bottom-0 z-10 flex flex-col !overflow-auto"
      >
        <AppSidenav />
      </Pane>
    </Splitpanes>
    <AppActionHandler />
    <AppSpotlight :show="showSearch" @hide-modal="showSearch = false" />
    <AppSupport
      v-if="mdAndLarger"
      :show="showSupport"
      @hide-modal="showSupport = false"
    />
    <AppOptions v-else :show="showSupport" @hide-modal="showSupport = false" />

    <!-- Let additional stuff be registered -->
    <template
      v-for="(component, index) in rootExtensionComponents"
      :key="index"
    >
      <component :is="component" />
    </template>
  </div>
</template>

<script setup lang="ts">
import { useSetting } from "@composables/settings"
import { breakpointsTailwind, useBreakpoints } from "@vueuse/core"
import { useService } from "dioc/vue"
import { Pane, Splitpanes } from "splitpanes"
import "splitpanes/dist/splitpanes.css"
import { computed, onBeforeMount, onMounted, ref, watch } from "vue"
import { RouterView, useRouter } from "vue-router"

import { useI18n } from "~/composables/i18n"
import { useToast } from "~/composables/toast"
import { InvocationTriggers, defineActionHandler } from "~/helpers/actions"
import { hookKeybindingsListener } from "~/helpers/keybindings"
import { applySetting, toggleSetting } from "~/newstore/settings"
import { platform } from "~/platform"
import { HoppSpotlightSessionEventData } from "~/platform/analytics"
import { PersistenceService } from "~/services/persistence"
import { SpotlightService } from "~/services/spotlight"
import { UIExtensionService } from "~/services/ui-extension.service"

const router = useRouter()

const showSearch = ref(false)
const showSupport = ref(false)

const expandNavigation = useSetting("EXPAND_NAVIGATION")
const rightSidebar = useSetting("SIDEBAR")
const columnLayout = useSetting("COLUMN_LAYOUT")

const breakpoints = useBreakpoints(breakpointsTailwind)
const mdAndLarger = breakpoints.greater("md")

const toast = useToast()
const t = useI18n()

const persistenceService = useService(PersistenceService)
const spotlightService = useService(SpotlightService)
const uiExtensionService = useService(UIExtensionService)

const rootExtensionComponents = uiExtensionService.rootUIExtensionComponents

const HAS_OPENED_SPOTLIGHT = useSetting("HAS_OPENED_SPOTLIGHT")

onBeforeMount(() => {
  if (!mdAndLarger.value) {
    rightSidebar.value = false
    columnLayout.value = true
  }
})

onMounted(async () => {
  const cookiesAllowed =
    (await persistenceService.getLocalConfig("cookiesAllowed")) === "yes"
  const platformAllowsCookiePrompts =
    platform.platformFeatureFlags.promptAsUsingCookies ?? true

  if (!cookiesAllowed && platformAllowsCookiePrompts) {
    toast.show(`${t("app.we_use_cookies")}`, {
      duration: 0,
      action: [
        {
          text: `${t("action.learn_more")}`,
          onClick: async (_, toastObject) => {
            await persistenceService.setLocalConfig("cookiesAllowed", "yes")
            toastObject.goAway(0)
            window
              .open("https://docs.hoppscotch.io/support/privacy", "_blank")
              ?.focus()
          },
        },
        {
          text: `${t("action.dismiss")}`,
          onClick: async (_, toastObject) => {
            await persistenceService.setLocalConfig("cookiesAllowed", "yes")
            toastObject.goAway(0)
          },
        },
      ],
    })
  }
})

watch(mdAndLarger, () => {
  if (mdAndLarger.value) rightSidebar.value = true
  else {
    rightSidebar.value = false
    columnLayout.value = true
  }
})
const spacerClass = computed(() =>
  expandNavigation.value ? "spacer-small" : "spacer-expand"
)

defineActionHandler("modals.search.toggle", (_, trigger) => {
  const triggerMethodMap: Record<
    InvocationTriggers,
    HoppSpotlightSessionEventData["method"]
  > = {
    keypress: "keyboard-shortcut",
    mouseclick: "click-spotlight-bar",
  }
  spotlightService.setAnalyticsData({
    method: triggerMethodMap[trigger as InvocationTriggers],
  })

  showSearch.value = !showSearch.value
  !HAS_OPENED_SPOTLIGHT.value && toggleSetting("HAS_OPENED_SPOTLIGHT")
})

defineActionHandler("modals.support.toggle", () => {
  showSupport.value = !showSupport.value
})

defineActionHandler("navigation.jump.rest", () => {
  router.push({ path: "/" })
})

defineActionHandler("navigation.jump.graphql", () => {
  router.push({ path: "/graphql" })
})

defineActionHandler("navigation.jump.realtime", () => {
  router.push({ path: "/realtime" })
})

defineActionHandler("navigation.jump.settings", () => {
  router.push({ path: "/settings" })
})

defineActionHandler("navigation.jump.profile", () => {
  router.push({ path: "/profile" })
})

defineActionHandler("settings.theme.system", () => {
  applySetting("BG_COLOR", "system")
})

defineActionHandler("settings.theme.light", () => {
  applySetting("BG_COLOR", "light")
})

defineActionHandler("settings.theme.dark", () => {
  applySetting("BG_COLOR", "dark")
})

defineActionHandler("settings.theme.black", () => {
  applySetting("BG_COLOR", "black")
})

hookKeybindingsListener()
</script>

<style lang="scss" scoped>
.spacer-small {
  margin-bottom: 4.2rem;
}

.spacer-medium {
  margin-bottom: 4.8rem;
}

.spacer-large {
  margin-bottom: 5.5rem;
}

.spacer-expand {
  margin-bottom: 2.9rem;
}

@media screen and (min-width: 768px) {
  .spacer-small {
    margin-bottom: 0;
  }

  .spacer-medium {
    margin-bottom: 0;
  }

  .spacer-large {
    margin-bottom: 0;
  }

  .spacer-expand {
    margin-bottom: 0;
  }
}
</style>
