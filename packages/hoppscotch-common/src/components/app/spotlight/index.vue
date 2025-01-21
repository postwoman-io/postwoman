<template>
  <HoppSmartModal
    v-if="show"
    styles="sm:max-w-lg"
    full-width
    @close="closeSpotlightModal"
  >
    <template #body>
      <div class="flex flex-col border-b border-divider transition">
        <div class="flex items-center">
          <input
            id="command"
            v-model="search"
            v-focus
            type="text"
            autocomplete="off"
            name="command"
            :placeholder="`${t('app.type_a_command_search')}`"
            class="flex flex-1 bg-transparent px-6 pt-5 pb-3 text-base text-secondaryDark"
          />
          <HoppSmartSpinner v-if="searchSession?.loading" class="mr-6" />
        </div>
      </div>
      <div
        v-if="searchSession && search.length > 0"
        class="flex flex-1 flex-col divide-y divide-dividerLight overflow-y-auto border-b border-divider"
      >
        <div
          v-for="([sectionID, sectionResult], sectionIndex) in scoredResults"
          :key="`section-${sectionID}`"
          class="flex flex-col"
        >
          <h5
            class="sticky top-0 z-10 bg-primaryContrast px-6 py-2 text-secondaryLight"
          >
            {{ sectionResult.title }}
          </h5>
          <AppSpotlightEntry
            v-for="(result, entryIndex) in sectionResult.results"
            :key="`result-${result.id}`"
            :entry="result"
            :active="isEqual(selectedEntry, [sectionIndex, entryIndex])"
            @mouseover="onMouseOver($event, sectionIndex, entryIndex)"
            @action="runAction(sectionID, result)"
          />
        </div>
        <HoppSmartPlaceholder
          v-if="search.length > 0 && scoredResults.length === 0"
          :text="`${t('state.nothing_found')} ‟${search}”`"
        >
          <template #icon>
            <icon-lucide-search class="svg-icons opacity-75" />
          </template>
          <template #body>
            <HoppButtonSecondary
              :label="t('action.clear')"
              outline
              @click="search = ''"
            />
          </template>
        </HoppSmartPlaceholder>
      </div>
      <div
        class="flex flex-shrink-0 justify-between overflow-auto whitespace-nowrap p-4 text-tiny text-secondaryLight <sm:hidden"
      >
        <div class="flex items-center">
          <kbd class="shortcut-key">↑</kbd>
          <kbd class="shortcut-key">↓</kbd>
          <span class="mx-2 truncate">
            {{ t("action.to_navigate") }}
          </span>
          <kbd class="shortcut-key">↩</kbd>
          <span class="ml-2 truncate">
            {{ t("action.to_select") }}
          </span>
        </div>
        <div class="flex items-center">
          <kbd class="shortcut-key">ESC</kbd>
          <span class="ml-2 truncate">
            {{ t("action.to_close") }}
          </span>
        </div>
      </div>
    </template>
  </HoppSmartModal>
</template>

<script setup lang="ts">
import { useI18n } from "@composables/i18n"
import { useService } from "dioc/vue"
import { isEqual } from "lodash-es"
import { computed, ref, watch } from "vue"
import { platform } from "~/platform"
import { HoppSpotlightSessionEventData } from "~/platform/analytics"
import {
  SpotlightSearchState,
  SpotlightSearcherResult,
  SpotlightService,
} from "~/services/spotlight"
import { CollectionsSpotlightSearcherService } from "~/services/spotlight/searchers/collections.searcher"
import {
  EnvironmentsSpotlightSearcherService,
  SwitchEnvSpotlightSearcherService,
} from "~/services/spotlight/searchers/environment.searcher"
import { GeneralSpotlightSearcherService } from "~/services/spotlight/searchers/general.searcher"
import { HistorySpotlightSearcherService } from "~/services/spotlight/searchers/history.searcher"
// NOTE: Old interceptors
// import { InterceptorSpotlightSearcherService } from "~/services/spotlight/searchers/interceptor.searcher"
import { KernelInterceptorSpotlightSearcherService } from "~/services/spotlight/searchers/kernel-interceptor.searcher"
import { MiscellaneousSpotlightSearcherService } from "~/services/spotlight/searchers/miscellaneous.searcher"
import { NavigationSpotlightSearcherService } from "~/services/spotlight/searchers/navigation.searcher"
import { RequestSpotlightSearcherService } from "~/services/spotlight/searchers/request.searcher"
import { ResponseSpotlightSearcherService } from "~/services/spotlight/searchers/response.searcher"
import { SettingsSpotlightSearcherService } from "~/services/spotlight/searchers/settings.searcher"
import { TabSpotlightSearcherService } from "~/services/spotlight/searchers/tab.searcher"
import { TeamsSpotlightSearcherService } from "~/services/spotlight/searchers/teamRequest.searcher"
import { UserSpotlightSearcherService } from "~/services/spotlight/searchers/user.searcher"
import {
  SwitchWorkspaceSpotlightSearcherService,
  WorkspaceSpotlightSearcherService,
} from "~/services/spotlight/searchers/workspace.searcher"

const t = useI18n()

const props = defineProps<{
  show: boolean
}>()

const emit = defineEmits<{
  (e: "hide-modal"): void
}>()

const spotlightService = useService(SpotlightService)

useService(HistorySpotlightSearcherService)
useService(UserSpotlightSearcherService)
useService(NavigationSpotlightSearcherService)
useService(SettingsSpotlightSearcherService)
useService(CollectionsSpotlightSearcherService)
useService(MiscellaneousSpotlightSearcherService)
useService(TabSpotlightSearcherService)
useService(GeneralSpotlightSearcherService)
useService(ResponseSpotlightSearcherService)
useService(RequestSpotlightSearcherService)
useService(EnvironmentsSpotlightSearcherService)
useService(SwitchEnvSpotlightSearcherService)
useService(WorkspaceSpotlightSearcherService)
useService(SwitchWorkspaceSpotlightSearcherService)
// NOTE: Old interceptors
// useService(InterceptorSpotlightSearcherService)
useService(KernelInterceptorSpotlightSearcherService)
useService(TeamsSpotlightSearcherService)

platform.spotlight?.additionalSearchers?.forEach((searcher) =>
  useService(searcher)
)

const search = ref("")

const searchSession = ref<SpotlightSearchState>()
const stopSearchSession = ref<() => void>()

const scoredResults = computed(() =>
  Object.entries(searchSession.value?.results ?? {}).sort(
    ([, sectionA], [, sectionB]) => sectionB.avgScore - sectionA.avgScore
  )
)

const { selectedEntry } = newUseArrowKeysForNavigation()

watch(
  () => props.show,
  (show) => {
    search.value = ""

    if (show) {
      const [session, onSessionEnd] =
        spotlightService.createSearchSession(search)

      searchSession.value = session.value
      stopSearchSession.value = onSessionEnd
    } else {
      stopSearchSession.value?.()
      stopSearchSession.value = undefined
      searchSession.value = undefined
    }
  }
)

function runAction(searcherID: string, result: SpotlightSearcherResult) {
  spotlightService.selectSearchResult(searcherID, result)
  emit("hide-modal")
}

let lastMousePosition: { x: number; y: number }

const onMouseOver = (
  e: MouseEvent,
  sectionIndex: number,
  entryIndex: number
) => {
  const mousePosition = {
    x: e.clientX,
    y: e.clientY,
  }

  // if the position is same, do nothing
  if (isEqual(lastMousePosition, mousePosition)) return
  selectedEntry.value = [sectionIndex, entryIndex]
  lastMousePosition = mousePosition
}

function newUseArrowKeysForNavigation() {
  const selectedEntry = ref<[number, number]>([0, 0]) // [sectionIndex, entryIndex]

  watch(search, () => {
    selectedEntry.value = [0, 0]
  })

  const onArrowDown = () => {
    // If no entries, do nothing
    if (scoredResults.value.length === 0) return

    const [sectionIndex, entryIndex] = selectedEntry.value

    const [, section] = scoredResults.value[sectionIndex]

    if (entryIndex < section.results.length - 1) {
      selectedEntry.value = [sectionIndex, entryIndex + 1]
    } else if (sectionIndex < scoredResults.value.length - 1) {
      selectedEntry.value = [sectionIndex + 1, 0]
    } else {
      selectedEntry.value = [0, 0]
    }
  }

  const onArrowUp = () => {
    // If no entries, do nothing
    if (scoredResults.value.length === 0) return

    const [sectionIndex, entryIndex] = selectedEntry.value

    if (entryIndex > 0) {
      selectedEntry.value = [sectionIndex, entryIndex - 1]
    } else if (sectionIndex > 0) {
      const [, section] = scoredResults.value[sectionIndex - 1]
      selectedEntry.value = [sectionIndex - 1, section.results.length - 1]
    } else {
      selectedEntry.value = [
        scoredResults.value.length - 1,
        scoredResults.value[scoredResults.value.length - 1][1].results.length -
          1,
      ]
    }
  }

  const onEnter = () => {
    // If no entries, do nothing
    if (scoredResults.value.length === 0) return

    const [sectionIndex, entryIndex] = selectedEntry.value
    const [sectionID, section] = scoredResults.value[sectionIndex]
    const result = section.results[entryIndex]

    runAction(sectionID, result)
  }

  function handleKeyPress(e: KeyboardEvent) {
    if (e.key === "ArrowUp") {
      e.preventDefault()
      e.stopPropagation()

      onArrowUp()
    } else if (e.key === "ArrowDown") {
      e.preventDefault()
      e.stopPropagation()

      onArrowDown()
    } else if (e.key === "Enter") {
      e.preventDefault()
      e.stopPropagation()

      onEnter()
    }
  }

  watch(
    () => props.show,
    (show) => {
      if (show) {
        window.addEventListener("keydown", handleKeyPress)
      } else {
        window.removeEventListener("keydown", handleKeyPress)
      }
    }
  )

  return { selectedEntry }
}

function closeSpotlightModal() {
  const analyticsData: HoppSpotlightSessionEventData = {
    action: "close",
    searcherID: null,
    rank: null,
  }

  // Sets the action indicating `close` and rank as `null` in the state for analytics event logging
  spotlightService.setAnalyticsData(analyticsData)

  emit("hide-modal")
}
</script>
