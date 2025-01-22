<template>
  <div
    class="flex items-center w-full flex-1 justify-between cursor-pointer group"
    @contextmenu.prevent="options?.tippy?.show()"
  >
    <div
      class="pointer-events-auto flex min-w-0 flex-1 space-x-2 cursor-pointer items-center justify-center"
      @click="selectResponse()"
    >
      <span
        class="pointer-events-none flex w-10 px-2 items-center justify-start truncate relative"
      >
        <span
          class="truncate text-tiny font-semibold relative"
          :class="statusCategory.className"
        >
          {{ response.code ?? response.status }}
        </span>
      </span>

      <span
        class="pointer-events-none flex min-w-0 flex-1 items-center py-2 pr-2 transition group-hover:text-secondaryDark"
      >
        <span class="truncate font-semibold group-hover:text-secondaryDark">
          {{ responseName }}
        </span>
        <span
          v-if="isActiveExample"
          v-tippy="{ theme: 'tooltip' }"
          class="relative mx-3 flex h-1.5 w-1.5 flex-shrink-0"
          :title="`${t('collection.request_in_use')}`"
        >
          <span
            class="absolute inline-flex h-full w-full flex-shrink-0 animate-ping rounded-full bg-green-500 opacity-75"
          >
          </span>
          <span
            class="relative inline-flex h-1.5 w-1.5 flex-shrink-0 rounded-full bg-green-500"
          ></span>
        </span>
      </span>
    </div>

    <div v-if="!hasNoTeamAccess" class="flex">
      <span>
        <tippy
          ref="options"
          interactive
          trigger="click"
          theme="popover"
          :on-shown="() => tippyActions!.focus()"
        >
          <HoppButtonSecondary
            v-tippy="{ theme: 'tooltip' }"
            :title="t('action.more')"
            :icon="IconMoreVertical"
            class="!py-1"
          />
          <template #content="{ hide }">
            <div
              ref="tippyActions"
              class="flex flex-col focus:outline-none"
              tabindex="0"
              @keyup.e="edit?.$el.click()"
              @keyup.d="duplicate?.$el.click()"
              @keyup.delete="deleteAction?.$el.click()"
              @keyup.escape="hide()"
            >
              <HoppSmartItem
                ref="edit"
                :icon="IconEdit"
                :label="t('action.edit')"
                :shortcut="['E']"
                @click="
                  () => {
                    emit('edit-response', {
                      responseName: responseName,
                      responseID: saveContext.exampleID,
                    })
                    hide()
                  }
                "
              />
              <HoppSmartItem
                ref="duplicate"
                :icon="IconCopy"
                :label="t('action.duplicate')"
                :shortcut="['D']"
                @click="
                  () => {
                    emit('duplicate-response', {
                      responseName: responseName,
                      responseID: saveContext.exampleID,
                    })
                    hide()
                  }
                "
              />
              <HoppSmartItem
                ref="deleteAction"
                :icon="IconTrash2"
                :label="t('action.delete')"
                :shortcut="['⌫']"
                @click="
                  () => {
                    emit('remove-response', {
                      responseName: responseName,
                      responseID: saveContext.exampleID,
                    })
                    hide()
                  }
                "
              />
            </div>
          </template>
        </tippy>
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import IconMoreVertical from "~icons/lucide/more-vertical"
import IconEdit from "~icons/lucide/edit"
import IconCopy from "~icons/lucide/copy"
import IconTrash2 from "~icons/lucide/trash-2"
import { ref, PropType, computed } from "vue"
import { useI18n } from "@composables/i18n"
import { TippyComponent } from "vue-tippy"
import { useService } from "dioc/vue"
import { RESTTabService } from "~/services/tab/rest"
import { HoppRESTRequestResponse } from "@hoppscotch/data"
import { HoppRESTSaveContext } from "~/helpers/rest/document"
import findStatusGroup from "@helpers/findStatusGroup"

const t = useI18n()

type CollectionType = "my-collections" | "team-collections"

type SaveContext = {
  requestID: string | number
  exampleID: string
  parentID: string
  collectionsType: CollectionType
  saveRequest: boolean
}

const props = defineProps({
  response: {
    type: Object as PropType<HoppRESTRequestResponse>,
    default: null,
    required: true,
  },
  responseName: {
    type: String,
    default: "",
    required: true,
  },
  hasNoTeamAccess: {
    type: Boolean,
    default: false,
    required: false,
  },
  saveContext: {
    type: Object as PropType<SaveContext>,
    default: null,
    required: false,
  },
})

type ResponsePayload = {
  responseName: string
  responseID: string
}

const statusCategory = computed(() => {
  return findStatusGroup(props.response.code ?? 0)
})

const emit = defineEmits<{
  (event: "edit-response", payload: ResponsePayload): void
  (event: "duplicate-response", payload: ResponsePayload): void
  (event: "remove-response", payload: ResponsePayload): void
  (event: "select-response", payload: ResponsePayload): void
}>()

const tabs = useService(RESTTabService)

const pathToIndex = (path: string) => {
  const pathArr = path.split("/")
  return pathArr[pathArr.length - 1]
}

const getSaveContext = (): HoppRESTSaveContext => {
  if (props.saveContext.collectionsType === "my-collections") {
    return {
      originLocation: "user-collection",
      folderPath: props.saveContext.parentID,
      requestIndex: Number(pathToIndex(props.saveContext.requestID.toString())),
      exampleID: props.saveContext.exampleID,
    }
  }

  return {
    originLocation: "team-collection",
    requestID: props.saveContext.requestID.toString() as string,
    collectionID: props.saveContext.parentID,
    exampleID: props.saveContext.exampleID,
  }
}

const active = computed(() => tabs.currentActiveTab.value.document.saveContext)

const isActiveExample = computed(() => {
  const saveCtx = getSaveContext()

  if (!saveCtx) return

  if (saveCtx.originLocation === "team-collection") {
    return (
      active.value?.originLocation === "team-collection" &&
      active.value?.requestID === saveCtx.requestID &&
      active.value?.exampleID === saveCtx.exampleID
    )
  }

  return (
    active.value?.originLocation === "user-collection" &&
    active.value?.folderPath === saveCtx.folderPath &&
    active.value?.requestIndex === saveCtx.requestIndex &&
    active.value?.exampleID === saveCtx.exampleID
  )
})

const selectResponse = () => {
  emit("select-response", {
    responseName: props.responseName,
    responseID: props.saveContext.exampleID,
  })
}

const tippyActions = ref<HTMLButtonElement | null>(null)
const edit = ref<HTMLButtonElement | null>(null)
const deleteAction = ref<HTMLButtonElement | null>(null)
const options = ref<TippyComponent | null>(null)
const duplicate = ref<HTMLButtonElement | null>(null)
</script>
