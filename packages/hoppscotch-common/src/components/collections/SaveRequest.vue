<!-- eslint-disable prettier/prettier -->
<template>
  <HoppSmartModal
    v-if="show"
    dialog
    :title="`${t('collection.save_as')}`"
    @close="hideModal"
  >
    <template #body>
      <div class="flex flex-col">
        <div class="flex gap-1">
          <HoppSmartInput
            v-model="requestName"
            class="flex-grow"
            styles="relative flex"
            placeholder=" "
            :label="t('request.name')"
            input-styles="floating-input"
            @submit="saveRequestAs"
          />
          <HoppButtonSecondary
            v-if="canDoRequestNameGeneration"
            v-tippy="{ theme: 'tooltip' }"
            :icon="IconSparkle"
            :disabled="isGenerateRequestNamePending"
            class="rounded-md"
            :class="{
              'animate-pulse': isGenerateRequestNamePending,
            }"
            :title="t('ai_experiments.generate_request_name')"
            @click="
              async () => {
                await generateRequestName(requestContext)
                submittedFeedback = false
              }
            "
          />
        </div>

        <label class="p-4">
          {{ t("collection.select_location") }}
        </label>
        <CollectionsGraphql
          v-if="mode === 'graphql'"
          :picked="picked"
          :save-request="true"
          @select="onSelect"
        />
        <Collections
          v-else
          :picked="picked"
          :save-request="true"
          @select="onSelect"
          @update-team="updateTeam"
          @update-collection-type="updateCollectionType"
        />
      </div>
    </template>
    <template #footer>
      <div class="flex justify-between items-center w-full">
        <div class="flex space-x-2">
          <HoppButtonPrimary
            :label="`${t('action.save')}`"
            :loading="modalLoadingState"
            outline
            @click="saveRequestAs"
          />
          <HoppButtonSecondary
            :label="`${t('action.cancel')}`"
            outline
            filled
            @click="hideModal"
          />
        </div>

        <div
          v-if="lastTraceID && !submittedFeedback"
          class="flex items-center gap-2"
        >
          <p>{{ t("ai_experiments.feedback_cta_request_name") }}</p>
          <template v-if="!isSubmitFeedbackPending">
            <HoppButtonSecondary
              :icon="IconThumbsUp"
              outline
              @click="
                async () => {
                  if (lastTraceID) {
                    await submitFeedback('positive', lastTraceID)
                    submittedFeedback = true
                  }
                }
              "
            />
            <HoppButtonSecondary
              :icon="IconThumbsDown"
              outline
              @click="
                async () => {
                  if (lastTraceID) {
                    await submitFeedback('negative', lastTraceID)
                    submittedFeedback = true
                  }
                }
              "
            />
          </template>
          <template v-else>
            <HoppSmartSpinner />
          </template>
        </div>
        <div v-if="submittedFeedback">
          <p>{{ t("ai_experiments.feedback_thank_you") }}</p>
        </div>
      </div>
    </template>
  </HoppSmartModal>
</template>

<script setup lang="ts">
import { useI18n } from "@composables/i18n"
import { useToast } from "@composables/toast"
import {
  HoppGQLRequest,
  HoppRESTRequest,
  isHoppRESTRequest,
} from "@hoppscotch/data"
import { computedWithControl } from "@vueuse/core"
import { useService } from "dioc/vue"
import * as TE from "fp-ts/TaskEither"
import { pipe } from "fp-ts/function"
import { cloneDeep } from "lodash-es"
import { computed, nextTick, reactive, ref, watch } from "vue"
import {
  useRequestNameGeneration,
  useSubmitFeedback,
} from "~/composables/ai-experiments"
import { GQLError } from "~/helpers/backend/GQLClient"
import {
  createRequestInCollection,
  updateTeamRequest,
} from "~/helpers/backend/mutations/TeamRequest"
import { Picked } from "~/helpers/types/HoppPicked"
import {
  cascadeParentCollectionForHeaderAuth,
  editGraphqlRequest,
  editRESTRequest,
  saveGraphqlRequestAs,
  saveRESTRequestAs,
} from "~/newstore/collections"
import { platform } from "~/platform"
import { GQLTabService } from "~/services/tab/graphql"
import { RESTTabService } from "~/services/tab/rest"
import { TeamWorkspace } from "~/services/workspace.service"
import IconSparkle from "~icons/lucide/sparkles"
import IconThumbsDown from "~icons/lucide/thumbs-down"
import IconThumbsUp from "~icons/lucide/thumbs-up"

const t = useI18n()
const toast = useToast()

const RESTTabs = useService(RESTTabService)
const GQLTabs = useService(GQLTabService)

type CollectionType =
  | {
      type: "team-collections"
      selectedTeam: TeamWorkspace
    }
  | { type: "my-collections"; selectedTeam: undefined }

const props = withDefaults(
  defineProps<{
    show: boolean
    mode: "rest" | "graphql"
    request?: HoppRESTRequest | HoppGQLRequest | null
  }>(),
  {
    show: false,
    mode: "rest",
    request: null,
  }
)

const emit = defineEmits<{
  (
    event: "edit-request",
    payload: {
      folderPath: string
      requestIndex: string
      request: HoppRESTRequest
    }
  ): void
  (e: "hide-modal"): void
}>()

const gqlRequestName = computedWithControl(
  () => GQLTabs.currentActiveTab.value,
  () => GQLTabs.currentActiveTab.value.document.request.name
)

const restRequestName = computedWithControl(
  () => RESTTabs.currentActiveTab.value,
  () =>
    RESTTabs.currentActiveTab.value.document.type === "request"
      ? RESTTabs.currentActiveTab.value.document.request.name
      : ""
)

const reqName = computed(() => {
  if (props.request) {
    return props.request.name
  } else if (props.mode === "rest") {
    return restRequestName.value
  }
  return gqlRequestName.value
})

const requestContext = computed(() => {
  if (props.request) {
    return props.request
  }

  if (
    props.mode === "rest" &&
    RESTTabs.currentActiveTab.value.document.type === "request"
  ) {
    return RESTTabs.currentActiveTab.value.document.request
  }

  return GQLTabs.currentActiveTab.value.document.request
})

const requestName = ref(reqName.value)

const {
  canDoRequestNameGeneration,
  generateRequestName,
  isGenerateRequestNamePending,
  lastTraceID,
} = useRequestNameGeneration(requestName)

watch(
  () => props.show,
  (newVal) => {
    if (!newVal) {
      submittedFeedback.value = false
      lastTraceID.value = null
    }
  }
)

const submittedFeedback = ref(false)
const { submitFeedback, isSubmitFeedbackPending } = useSubmitFeedback()

watch(
  () => [RESTTabs.currentActiveTab.value, GQLTabs.currentActiveTab.value],
  () => {
    if (
      props.mode === "rest" &&
      RESTTabs.currentActiveTab.value.document.type === "request"
    ) {
      requestName.value =
        RESTTabs.currentActiveTab.value?.document.request.name ?? ""
    } else {
      requestName.value =
        GQLTabs.currentActiveTab.value?.document.request.name ?? ""
    }
  }
)

const requestData = reactive({
  name: requestName,
  collectionIndex: undefined as number | undefined,
  folderName: undefined as number | undefined,
  requestIndex: undefined as number | undefined,
})

const collectionsType = ref<CollectionType>({
  type: "my-collections",
  selectedTeam: undefined,
})

const picked = ref<Picked | null>(null)

const modalLoadingState = ref(false)

// Resets
watch(
  () => requestData.collectionIndex,
  () => {
    requestData.folderName = undefined
    requestData.requestIndex = undefined
  }
)
watch(
  () => requestData.folderName,
  () => {
    requestData.requestIndex = undefined
  }
)

const updateTeam = (newTeam: TeamWorkspace) => {
  collectionsType.value.selectedTeam = newTeam
}

const updateCollectionType = (type: CollectionType["type"]) => {
  collectionsType.value.type = type
}

const onSelect = (pickedVal: Picked | null) => {
  picked.value = pickedVal
}

const saveRequestAs = async () => {
  if (!requestName.value) {
    toast.error(`${t("error.empty_req_name")}`)
    return
  }
  if (picked.value === null) {
    toast.error(`${t("collection.select")}`)
    return
  }

  const requestUpdated =
    props.mode === "rest"
      ? cloneDeep(
          RESTTabs.currentActiveTab.value.document.type === "request"
            ? RESTTabs.currentActiveTab.value.document.request
            : null
        )
      : cloneDeep(GQLTabs.currentActiveTab.value.document.request)

  if (!requestUpdated) return

  requestUpdated.name = requestName.value

  if (picked.value.pickedType === "my-collection") {
    if (!isHoppRESTRequest(requestUpdated))
      throw new Error("requestUpdated is not a REST Request")

    const insertionIndex = saveRESTRequestAs(
      `${picked.value.collectionIndex}`,
      requestUpdated
    )

    if (RESTTabs.currentActiveTab.value.document.type !== "request") return

    RESTTabs.currentActiveTab.value.document = {
      request: requestUpdated,
      isDirty: false,
      type: "request",
      saveContext: {
        originLocation: "user-collection",
        folderPath: `${picked.value.collectionIndex}`,
        requestIndex: insertionIndex,
        exampleID: undefined,
      },
    }

    const { auth, headers } = cascadeParentCollectionForHeaderAuth(
      `${picked.value.collectionIndex}`,
      "rest"
    )

    RESTTabs.currentActiveTab.value.document.inheritedProperties = {
      auth,
      headers,
    }

    platform.analytics?.logEvent({
      type: "HOPP_SAVE_REQUEST",
      createdNow: true,
      platform: "rest",
      workspaceType: "personal",
    })

    requestSaved()
  } else if (picked.value.pickedType === "my-folder") {
    if (!isHoppRESTRequest(requestUpdated))
      throw new Error("requestUpdated is not a REST Request")

    const insertionIndex = saveRESTRequestAs(
      picked.value.folderPath,
      requestUpdated
    )

    RESTTabs.currentActiveTab.value.document = {
      request: requestUpdated,
      isDirty: false,
      type: "request",
      saveContext: {
        originLocation: "user-collection",
        folderPath: picked.value.folderPath,
        requestIndex: insertionIndex,
      },
    }

    const { auth, headers } = cascadeParentCollectionForHeaderAuth(
      picked.value.folderPath,
      "rest"
    )

    RESTTabs.currentActiveTab.value.document.inheritedProperties = {
      auth,
      headers,
    }

    platform.analytics?.logEvent({
      type: "HOPP_SAVE_REQUEST",
      createdNow: true,
      platform: "rest",
      workspaceType: "personal",
    })

    requestSaved()
  } else if (picked.value.pickedType === "my-request") {
    if (!isHoppRESTRequest(requestUpdated))
      throw new Error("requestUpdated is not a REST Request")

    editRESTRequest(
      picked.value.folderPath,
      picked.value.requestIndex,
      requestUpdated
    )

    RESTTabs.currentActiveTab.value.document = {
      request: requestUpdated,
      isDirty: false,
      type: "request",
      saveContext: {
        originLocation: "user-collection",
        folderPath: picked.value.folderPath,
        requestIndex: picked.value.requestIndex,
      },
    }

    const { auth, headers } = cascadeParentCollectionForHeaderAuth(
      picked.value.folderPath,
      "rest"
    )

    RESTTabs.currentActiveTab.value.document.inheritedProperties = {
      auth,
      headers,
    }

    platform.analytics?.logEvent({
      type: "HOPP_SAVE_REQUEST",
      createdNow: false,
      platform: "rest",
      workspaceType: "personal",
    })

    requestSaved()
  } else if (picked.value.pickedType === "teams-collection") {
    if (!isHoppRESTRequest(requestUpdated))
      throw new Error("requestUpdated is not a REST Request")

    updateTeamCollectionOrFolder(picked.value.collectionID, requestUpdated)

    platform.analytics?.logEvent({
      type: "HOPP_SAVE_REQUEST",
      createdNow: true,
      platform: "rest",
      workspaceType: "team",
    })
  } else if (picked.value.pickedType === "teams-folder") {
    if (!isHoppRESTRequest(requestUpdated))
      throw new Error("requestUpdated is not a REST Request")

    updateTeamCollectionOrFolder(picked.value.folderID, requestUpdated)

    platform.analytics?.logEvent({
      type: "HOPP_SAVE_REQUEST",
      createdNow: true,
      platform: "rest",
      workspaceType: "team",
    })
  } else if (picked.value.pickedType === "teams-request") {
    if (!isHoppRESTRequest(requestUpdated))
      throw new Error("requestUpdated is not a REST Request")

    if (
      collectionsType.value.type !== "team-collections" ||
      !collectionsType.value.selectedTeam
    )
      throw new Error("Collections Type mismatch")

    modalLoadingState.value = true

    const data = {
      request: JSON.stringify(requestUpdated),
      title: requestUpdated.name,
    }

    platform.analytics?.logEvent({
      type: "HOPP_SAVE_REQUEST",
      createdNow: false,
      platform: "rest",
      workspaceType: "team",
    })

    pipe(
      updateTeamRequest(picked.value.requestID, data),
      TE.match(
        (err: GQLError<string>) => {
          toast.error(`${getErrorMessage(err)}`)
          modalLoadingState.value = false
        },
        () => {
          modalLoadingState.value = false
          requestSaved()
        }
      )
    )()
  } else if (picked.value.pickedType === "gql-my-request") {
    // TODO: Check for GQL request ?
    editGraphqlRequest(
      picked.value.folderPath,
      picked.value.requestIndex,
      requestUpdated as HoppGQLRequest
    )

    platform.analytics?.logEvent({
      type: "HOPP_SAVE_REQUEST",
      createdNow: false,
      platform: "gql",
      workspaceType: "team",
    })

    const { auth, headers } = cascadeParentCollectionForHeaderAuth(
      picked.value.folderPath,
      "graphql"
    )

    GQLTabs.currentActiveTab.value.document.inheritedProperties = {
      auth,
      headers,
    }

    requestSaved()
  } else if (picked.value.pickedType === "gql-my-folder") {
    // TODO: Check for GQL request ?
    saveGraphqlRequestAs(
      picked.value.folderPath,
      requestUpdated as HoppGQLRequest
    )

    platform.analytics?.logEvent({
      type: "HOPP_SAVE_REQUEST",
      createdNow: true,
      platform: "gql",
      workspaceType: "team",
    })

    const { auth, headers } = cascadeParentCollectionForHeaderAuth(
      picked.value.folderPath,
      "graphql"
    )

    GQLTabs.currentActiveTab.value.document.inheritedProperties = {
      auth,
      headers,
    }

    requestSaved()
  } else if (picked.value.pickedType === "gql-my-collection") {
    // TODO: Check for GQL request ?
    saveGraphqlRequestAs(
      `${picked.value.collectionIndex}`,
      requestUpdated as HoppGQLRequest
    )

    platform.analytics?.logEvent({
      type: "HOPP_SAVE_REQUEST",
      createdNow: true,
      platform: "gql",
      workspaceType: "team",
    })

    const { auth, headers } = cascadeParentCollectionForHeaderAuth(
      `${picked.value.collectionIndex}`,
      "graphql"
    )

    GQLTabs.currentActiveTab.value.document.inheritedProperties = {
      auth,
      headers,
    }

    requestSaved()
  }
}

/**
 * Updates a team collection or folder and sets the save context to the updated request
 * @param collectionID - ID of the collection or folder
 * @param requestUpdated - Updated request
 */
const updateTeamCollectionOrFolder = (
  collectionID: string,
  requestUpdated: HoppRESTRequest
) => {
  if (
    collectionsType.value.type !== "team-collections" ||
    !collectionsType.value.selectedTeam
  )
    throw new Error("Collections Type mismatch")

  modalLoadingState.value = true

  const data = {
    title: requestUpdated.name,
    request: JSON.stringify(requestUpdated),
    teamID: collectionsType.value.selectedTeam.teamID,
  }
  pipe(
    createRequestInCollection(collectionID, data),
    TE.match(
      (err: GQLError<string>) => {
        toast.error(`${getErrorMessage(err)}`)
        modalLoadingState.value = false
      },
      (result) => {
        const { createRequestInCollection } = result

        RESTTabs.currentActiveTab.value.document = {
          request: requestUpdated,
          isDirty: false,
          type: "request",
          saveContext: {
            originLocation: "team-collection",
            requestID: createRequestInCollection.id,
            collectionID: createRequestInCollection.collection.id,
            teamID: createRequestInCollection.collection.team.id,
          },
        }

        modalLoadingState.value = false
        requestSaved()
      }
    )
  )()
}

const requestSaved = () => {
  toast.success(`${t("request.added")}`)
  nextTick(() => {
    RESTTabs.currentActiveTab.value.document.isDirty = false
  })
  hideModal()
}

const hideModal = () => {
  picked.value = null
  emit("hide-modal")
}

const getErrorMessage = (err: GQLError<string>) => {
  console.error(err)
  if (err.type === "network_error") {
    return t("error.network_error")
  }
  switch (err.error) {
    case "team_coll/short_title":
      return t("collection.name_length_insufficient")
    case "team/invalid_coll_id":
      return t("team.invalid_id")
    case "team/not_required_role":
      return t("profile.no_permission")
    case "team_req/not_required_role":
      return t("profile.no_permission")
    case "Forbidden resource":
      return t("profile.no_permission")
    default:
      return t("error.something_went_wrong")
  }
}
</script>
