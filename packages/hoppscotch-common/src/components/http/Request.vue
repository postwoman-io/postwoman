<template>
  <div
    class="sticky top-0 z-20 flex-none flex-shrink-0 bg-primary p-4 sm:flex sm:flex-shrink-0 sm:space-x-2"
  >
    <div
      class="min-w-[12rem] flex flex-1 whitespace-nowrap rounded border border-divider"
    >
      <div class="relative flex">
        <label for="method">
          <tippy
            interactive
            trigger="click"
            theme="popover"
            :on-shown="() => methodTippyActions.focus()"
          >
            <HoppSmartSelectWrapper>
              <input
                id="method"
                class="flex w-26 cursor-pointer rounded-l bg-primaryLight px-4 py-2 font-semibold text-secondaryDark transition"
                :value="tab.document.request.method"
                :readonly="!isCustomMethod"
                :placeholder="`${t('request.method')}`"
                @input="onSelectMethod($event)"
              />
            </HoppSmartSelectWrapper>
            <template #content="{ hide }">
              <div
                ref="methodTippyActions"
                class="flex flex-col focus:outline-none"
                tabindex="0"
                @keyup.escape="hide()"
              >
                <HoppSmartItem
                  v-for="(method, index) in methods"
                  :key="`method-${index}`"
                  :label="method"
                  :style="{
                    color: getMethodLabelColor(method),
                  }"
                  @click="
                    () => {
                      updateMethod(method)
                      hide()
                    }
                  "
                />
              </div>
            </template>
          </tippy>
        </label>
      </div>
      <div
        class="flex flex-1 whitespace-nowrap rounded-r border-l border-divider bg-primaryLight transition"
      >
        <SmartEnvInput
          v-model="tab.document.request.endpoint"
          :placeholder="`${t('request.url_placeholder')}`"
          :auto-complete-source="userHistories"
          :auto-complete-env="true"
          :inspection-results="tabResults"
          @paste="onPasteUrl($event)"
          @enter="newSendRequest"
        />
      </div>
    </div>
    <div class="mt-2 flex sm:mt-0">
      <HoppButtonPrimary
        id="send"
        v-tippy="{ theme: 'tooltip', delay: [500, 20], allowHTML: true }"
        :title="`${t(
          'action.send'
        )} <kbd>${getSpecialKey()}</kbd><kbd>↩</kbd>`"
        :label="`${
          !isTabResponseLoading ? t('action.send') : t('action.cancel')
        }`"
        class="min-w-[5rem] flex-1 rounded-r-none"
        @click="!isTabResponseLoading ? newSendRequest() : cancelRequest()"
      />
      <span class="flex">
        <tippy
          interactive
          trigger="click"
          theme="popover"
          :on-shown="() => sendTippyActions.focus()"
        >
          <HoppButtonPrimary
            v-tippy="{ theme: 'tooltip' }"
            :title="t('app.options')"
            :icon="IconChevronDown"
            filled
            class="rounded-l-none"
          />
          <template #content="{ hide }">
            <div
              ref="sendTippyActions"
              class="flex flex-col focus:outline-none"
              tabindex="0"
              @keyup.c="curl.$el.click()"
              @keyup.s="show.$el.click()"
              @keyup.delete="clearAll.$el.click()"
              @keyup.escape="hide()"
            >
              <HoppSmartItem
                ref="curl"
                :label="`${t('import.curl')}`"
                :icon="IconFileCode"
                :shortcut="['C']"
                @click="
                  () => {
                    showCurlImportModal = !showCurlImportModal
                    hide()
                  }
                "
              />
              <HoppSmartItem
                ref="show"
                :label="`${t('show.code')}`"
                :icon="IconCode2"
                :shortcut="['S']"
                @click="
                  () => {
                    showCodegenModal = !showCodegenModal
                    hide()
                  }
                "
              />
              <HoppSmartItem
                ref="clearAll"
                :label="`${t('action.clear_all')}`"
                :icon="IconRotateCCW"
                :shortcut="['⌫']"
                @click="
                  () => {
                    clearContent()
                    hide()
                  }
                "
              />
            </div>
          </template>
        </tippy>
      </span>
      <span class="ml-2 flex rounded border border-divider transition">
        <HoppButtonSecondary
          v-tippy="{ theme: 'tooltip', delay: [500, 20], allowHTML: true }"
          :title="`${t(
            'request.save'
          )} <kbd>${getSpecialKey()}</kbd><kbd>S</kbd>`"
          :label="COLUMN_LAYOUT ? `${t('request.save')}` : ''"
          filled
          :icon="IconSave"
          class="flex-1 rounded rounded-r-none"
          @click="saveRequest()"
        />
        <span class="flex">
          <tippy
            interactive
            trigger="click"
            theme="popover"
            :on-shown="() => saveTippyActions.focus()"
          >
            <HoppButtonSecondary
              v-tippy="{ theme: 'tooltip' }"
              :title="t('app.options')"
              :icon="IconChevronDown"
              filled
              class="rounded rounded-l-none"
            />
            <template #content="{ hide }">
              <div
                ref="saveTippyActions"
                class="flex flex-col focus:outline-none"
                tabindex="0"
                @keyup.escape="hide()"
              >
                <input
                  id="request-name"
                  v-model="tab.document.request.name"
                  :placeholder="`${t('request.name')}`"
                  name="request-name"
                  type="text"
                  autocomplete="off"
                  class="input mb-2 !bg-primaryContrast"
                  @keyup.enter="hide()"
                />
                <HoppSmartItem
                  ref="saveRequestAction"
                  :label="`${t('request.save_as')}`"
                  :icon="IconFolderPlus"
                  @click="
                    () => {
                      showSaveRequestModal = true
                      hide()
                    }
                  "
                />
                <hr />
                <HoppSmartItem
                  ref="copyRequestAction"
                  :label="t('request.share_request')"
                  :icon="IconShare2"
                  :loading="fetchingShareLink"
                  @click="
                    () => {
                      shareRequest()
                      hide()
                    }
                  "
                />
              </div>
            </template>
          </tippy>
        </span>
      </span>
    </div>
    <HttpImportCurl
      :text="curlText"
      :show="showCurlImportModal"
      @hide-modal="showCurlImportModal = false"
    />
    <HttpCodegenModal
      v-if="showCodegenModal"
      :show="showCodegenModal"
      @hide-modal="showCodegenModal = false"
    />
    <CollectionsSaveRequest
      v-if="showSaveRequestModal"
      mode="rest"
      :show="showSaveRequestModal"
      :request="request"
      @hide-modal="showSaveRequestModal = false"
    />
  </div>
</template>

<script setup lang="ts">
import { useI18n } from "@composables/i18n"
import { useSetting } from "@composables/settings"
import { useReadonlyStream, useStreamSubscriber } from "@composables/stream"
import { useToast } from "@composables/toast"
import { useVModel } from "@vueuse/core"
import * as E from "fp-ts/Either"
import { computed, ref, onUnmounted } from "vue"
import { defineActionHandler, invokeAction } from "~/helpers/actions"
import { runMutation } from "~/helpers/backend/GQLClient"
import { UpdateRequestDocument } from "~/helpers/backend/graphql"
import { getPlatformSpecialKey as getSpecialKey } from "~/helpers/platformutils"
import { runRESTRequest$ } from "~/helpers/RequestRunner"
import { HoppRESTResponse } from "~/helpers/types/HoppRESTResponse"
import { editRESTRequest } from "~/newstore/collections"
import IconChevronDown from "~icons/lucide/chevron-down"
import IconCode2 from "~icons/lucide/code-2"
import IconFileCode from "~icons/lucide/file-code"
import IconFolderPlus from "~icons/lucide/folder-plus"
import IconRotateCCW from "~icons/lucide/rotate-ccw"
import IconSave from "~icons/lucide/save"
import IconShare2 from "~icons/lucide/share-2"
import { getDefaultRESTRequest } from "~/helpers/rest/default"
import { RESTHistoryEntry, restHistory$ } from "~/newstore/history"
import { platform } from "~/platform"
import { HoppRESTRequest } from "@hoppscotch/data"
import { useService } from "dioc/vue"
import { InspectionService } from "~/services/inspection"
import { InterceptorService } from "~/services/interceptor.service"
import { HoppTab } from "~/services/tab"
import { HoppRequestDocument } from "~/helpers/rest/document"
import { RESTTabService } from "~/services/tab/rest"
import { getMethodLabelColor } from "~/helpers/rest/labelColoring"
import { WorkspaceService } from "~/services/workspace.service"

const t = useI18n()
const interceptorService = useService(InterceptorService)

const methods = [
  "GET",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
  "HEAD",
  "OPTIONS",
  "CONNECT",
  "TRACE",
  "CUSTOM",
]

const toast = useToast()

const { subscribeToStream } = useStreamSubscriber()

const props = defineProps<{ modelValue: HoppTab<HoppRequestDocument> }>()
const emit = defineEmits(["update:modelValue"])

const tab = useVModel(props, "modelValue", emit)

const newEndpoint = computed(() => {
  return tab.value.document.request.endpoint
})
const newMethod = computed(() => {
  return tab.value.document.request.method
})

const curlText = ref("")

const loading = ref(false)

const isTabResponseLoading = computed(
  () => tab.value.document.response?.type === "loading"
)

const showCurlImportModal = ref(false)
const showCodegenModal = ref(false)
const showSaveRequestModal = ref(false)

// Template refs
const methodTippyActions = ref<any | null>(null)
const sendTippyActions = ref<any | null>(null)
const saveTippyActions = ref<any | null>(null)
const curl = ref<any | null>(null)
const show = ref<any | null>(null)
const clearAll = ref<any | null>(null)
const copyRequestAction = ref<any | null>(null)
const saveRequestAction = ref<any | null>(null)

const history = useReadonlyStream<RESTHistoryEntry[]>(restHistory$, [])

const userHistories = computed(() => {
  return history.value.map((history) => history.request.endpoint).slice(0, 10)
})

const inspectionService = useService(InspectionService)

const tabs = useService(RESTTabService)

const workspaceService = useService(WorkspaceService)

const newSendRequest = async () => {
  if (newEndpoint.value === "" || /^\s+$/.test(newEndpoint.value)) {
    toast.error(`${t("empty.endpoint")}`)
    return
  }

  ensureMethodInEndpoint()

  loading.value = true

  // Log the request run into analytics
  platform.analytics?.logEvent({
    type: "HOPP_REQUEST_RUN",
    platform: "rest",
    strategy: interceptorService.currentInterceptorID.value!,
    workspaceType: workspaceService.currentWorkspace.value.type,
  })

  const [cancel, streamPromise] = runRESTRequest$(tab)
  const streamResult = await streamPromise

  tab.value.document.cancelFunction = cancel

  if (E.isRight(streamResult)) {
    subscribeToStream(
      streamResult.right,
      (responseState) => {
        if (loading.value) {
          // Check exists because, loading can be set to false
          // when cancelled
          updateRESTResponse(responseState)
        }
      },
      () => {
        loading.value = false
      },
      () => {
        // TODO: Change this any to a proper type
        const result = (streamResult.right as any).value
        if (
          result.type === "network_fail" &&
          result.error?.error === "NO_PW_EXT_HOOK"
        ) {
          const errorResponse: HoppRESTResponse = {
            type: "extension_error",
            error: result.error.humanMessage.heading,
            component: result.error.component,
            req: result.req,
          }
          updateRESTResponse(errorResponse)
        }
        loading.value = false
      }
    )
  } else {
    loading.value = false
    toast.error(`${t("error.script_fail")}`)
    let error: Error
    if (typeof streamResult.left === "string") {
      error = { name: "RequestFailure", message: streamResult.left }
    } else {
      error = streamResult.left
    }
    updateRESTResponse({
      type: "script_fail",
      error,
    })
  }
}

const ensureMethodInEndpoint = () => {
  const endpoint = newEndpoint.value.trim()
  tab.value.document.request.endpoint = endpoint
  if (!/^http[s]?:\/\//.test(endpoint) && !endpoint.startsWith("<<")) {
    const domain = endpoint.split(/[/:#?]+/)[0]
    if (domain === "localhost" || /([0-9]+\.)*[0-9]/.test(domain)) {
      tab.value.document.request.endpoint = "http://" + endpoint
    } else {
      tab.value.document.request.endpoint = "https://" + endpoint
    }
  }
}

const onPasteUrl = (e: { pastedValue: string; prevValue: string }) => {
  if (!e) return

  const pastedData = e.pastedValue

  if (isCURL(pastedData)) {
    showCurlImportModal.value = true
    curlText.value = pastedData
    tab.value.document.request.endpoint = e.prevValue
  }
}

function isCURL(curl: string) {
  return curl.includes("curl ")
}

const currentTabID = tabs.currentTabID.value

onUnmounted(() => {
  //check if current tab id exist in the current tab id lists
  const isCurrentTabRemoved = !tabs
    .getActiveTabs()
    .value.some((tab) => tab.id === currentTabID)

  if (isCurrentTabRemoved) cancelRequest()
})

const cancelRequest = () => {
  loading.value = false
  tab.value.document.cancelFunction?.()

  updateRESTResponse(null)
}

const updateMethod = (method: string) => {
  tab.value.document.request.method = method
}

const onSelectMethod = (e: Event | any) => {
  // type any because of value property not being recognized by TS in the event.target object. It is a valid property though.
  updateMethod(e.target.value)
}

const clearContent = () => {
  tab.value.document.request = getDefaultRESTRequest()
}

const updateRESTResponse = (response: HoppRESTResponse | null) => {
  tab.value.document.response = response
}

const currentUser = useReadonlyStream(
  platform.auth.getCurrentUserStream(),
  platform.auth.getCurrentUser()
)

const fetchingShareLink = ref(false)

const shareRequest = () => {
  if (currentUser.value) {
    invokeAction("share.request", {
      request: tab.value.document.request,
    })
  } else {
    invokeAction("modals.login.toggle")
  }
}

const cycleUpMethod = () => {
  const currentIndex = methods.indexOf(newMethod.value)
  if (currentIndex === -1) {
    // Most probs we are in CUSTOM mode
    // Cycle up from CUSTOM is PATCH
    updateMethod("PATCH")
  } else if (currentIndex === 0) {
    updateMethod("CUSTOM")
  } else {
    updateMethod(methods[currentIndex - 1])
  }
}

const cycleDownMethod = () => {
  const currentIndex = methods.indexOf(newMethod.value)
  if (currentIndex === -1) {
    // Most probs we are in CUSTOM mode
    // Cycle down from CUSTOM is GET
    updateMethod("GET")
  } else if (currentIndex === methods.length - 1) {
    updateMethod("GET")
  } else {
    updateMethod(methods[currentIndex + 1])
  }
}

const saveRequest = () => {
  const saveCtx = tab.value.document.saveContext

  if (!saveCtx) {
    showSaveRequestModal.value = true
    return
  }
  if (saveCtx.originLocation === "user-collection") {
    const req = tab.value.document.request

    try {
      editRESTRequest(saveCtx.folderPath, saveCtx.requestIndex, req)

      tab.value.document.isDirty = false

      platform.analytics?.logEvent({
        type: "HOPP_SAVE_REQUEST",
        platform: "rest",
        createdNow: false,
        workspaceType: "personal",
      })

      toast.success(`${t("request.saved")}`)
    } catch (e) {
      tab.value.document.saveContext = undefined
      saveRequest()
    }
  } else if (saveCtx.originLocation === "team-collection") {
    const req = tab.value.document.request

    // TODO: handle error case (NOTE: overwriteRequestTeams is async)
    try {
      platform.analytics?.logEvent({
        type: "HOPP_SAVE_REQUEST",
        platform: "rest",
        createdNow: false,
        workspaceType: "team",
      })

      runMutation(UpdateRequestDocument, {
        requestID: saveCtx.requestID,
        data: {
          title: req.name,
          request: JSON.stringify(req),
        },
      })().then((result) => {
        if (E.isLeft(result)) {
          toast.error(`${t("profile.no_permission")}`)
        } else {
          tab.value.document.isDirty = false

          toast.success(`${t("request.saved")}`)
        }
      })
    } catch (error) {
      showSaveRequestModal.value = true
      toast.error(`${t("error.something_went_wrong")}`)
      console.error(error)
    }
  }
}

const request = ref<HoppRESTRequest | null>(null)

defineActionHandler("request.send-cancel", () => {
  if (!loading.value) newSendRequest()
  else cancelRequest()
})
defineActionHandler("request.reset", clearContent)
defineActionHandler("request.share-request", shareRequest)
defineActionHandler("request.method.next", cycleDownMethod)
defineActionHandler("request.method.prev", cycleUpMethod)
defineActionHandler("request-response.save", saveRequest)
defineActionHandler("request.save-as", (req) => {
  showSaveRequestModal.value = true
  if (req?.requestType === "rest" && req.request) {
    request.value = req.request
  }
})
defineActionHandler("request.method.get", () => updateMethod("GET"))
defineActionHandler("request.method.post", () => updateMethod("POST"))
defineActionHandler("request.method.put", () => updateMethod("PUT"))
defineActionHandler("request.method.delete", () => updateMethod("DELETE"))
defineActionHandler("request.method.head", () => updateMethod("HEAD"))

defineActionHandler("request.import-curl", () => {
  showCurlImportModal.value = true
})
defineActionHandler("request.show-code", () => {
  showCodegenModal.value = true
})

const isCustomMethod = computed(() => {
  return (
    tab.value.document.request.method === "CUSTOM" ||
    !methods.includes(newMethod.value)
  )
})

const COLUMN_LAYOUT = useSetting("COLUMN_LAYOUT")

const tabResults = inspectionService.getResultViewFor(tabs.currentTabID.value)
</script>
