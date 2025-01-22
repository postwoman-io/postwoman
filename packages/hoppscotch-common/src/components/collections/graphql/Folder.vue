<template>
  <div class="flex flex-col" :class="[{ 'bg-primaryLight': dragging }]">
    <div
      class="group flex items-stretch"
      @dragover.prevent
      @drop.prevent="dropEvent"
      @dragover="dragging = true"
      @drop="dragging = false"
      @dragleave="dragging = false"
      @dragend="dragging = false"
      @contextmenu.prevent="options.tippy.show()"
    >
      <div
        class="flex min-w-0 flex-1 items-center justify-center cursor-pointer"
        @click="toggleShowChildren()"
      >
        <span class="pointer-events-none flex items-center justify-center px-4">
          <component
            :is="collectionIcon"
            class="svg-icons"
            :class="{ 'text-accent': isSelected }"
          />
        </span>
        <span
          class="pointer-events-none flex min-w-0 flex-1 cursor-pointer py-2 pr-2 transition group-hover:text-secondaryDark"
        >
          <span class="truncate" :class="{ 'text-accent': isSelected }">
            {{ folder.name ? folder.name : folder.title }}
          </span>
        </span>
      </div>
      <div class="flex">
        <HoppButtonSecondary
          v-tippy="{ theme: 'tooltip' }"
          :icon="IconFilePlus"
          :title="t('request.new')"
          class="hidden group-hover:inline-flex"
          @click="
            emit('add-request', {
              path: folderPath,
              index: folder.requests.length,
            })
          "
        />
        <HoppButtonSecondary
          v-tippy="{ theme: 'tooltip' }"
          :icon="IconFolderPlus"
          :title="t('folder.new')"
          class="hidden group-hover:inline-flex"
          @click="emit('add-folder', { folder, path: folderPath })"
        />
        <span>
          <tippy
            ref="options"
            interactive
            trigger="click"
            theme="popover"
            :on-shown="() => tippyActions.focus()"
          >
            <HoppButtonSecondary
              v-tippy="{ theme: 'tooltip' }"
              :title="t('action.more')"
              :icon="IconMoreVertical"
            />
            <template #content="{ hide }">
              <div
                ref="tippyActions"
                class="flex flex-col focus:outline-none"
                tabindex="0"
                @keyup.r="requestAction.$el.click()"
                @keyup.n="folderAction.$el.click()"
                @keyup.e="edit.$el.click()"
                @keyup.d="duplicateAction.$el.click()"
                @keyup.delete="deleteAction.$el.click()"
                @keyup.p="propertiesAction.$el.click()"
                @keyup.escape="hide()"
              >
                <HoppSmartItem
                  ref="requestAction"
                  :icon="IconFilePlus"
                  :label="`${t('request.new')}`"
                  :shortcut="['R']"
                  @click="
                    () => {
                      emit('add-request', { path: folderPath })
                      hide()
                    }
                  "
                />
                <HoppSmartItem
                  ref="folderAction"
                  :icon="IconFolderPlus"
                  :label="`${t('folder.new')}`"
                  :shortcut="['N']"
                  @click="
                    () => {
                      emit('add-folder', { folder, path: folderPath })
                      hide()
                    }
                  "
                />
                <HoppSmartItem
                  ref="edit"
                  :icon="IconEdit"
                  :label="`${t('action.edit')}`"
                  :shortcut="['E']"
                  @click="
                    () => {
                      emit('edit-folder', { folder, folderPath })
                      hide()
                    }
                  "
                />
                <HoppSmartItem
                  ref="duplicateAction"
                  :icon="IconCopy"
                  :label="t('action.duplicate')"
                  :shortcut="['D']"
                  @click="
                    () => {
                      emit('duplicate-collection', {
                        path: folderPath,
                        collectionSyncID: folder.id,
                      }),
                        hide()
                    }
                  "
                />
                <HoppSmartItem
                  ref="deleteAction"
                  :icon="IconTrash2"
                  :label="`${t('action.delete')}`"
                  :shortcut="['⌫']"
                  @click="
                    () => {
                      confirmRemove = true
                      hide()
                    }
                  "
                />
                <HoppSmartItem
                  ref="propertiesAction"
                  :icon="IconSettings2"
                  :label="t('action.properties')"
                  :shortcut="['P']"
                  @click="
                    () => {
                      emit('edit-properties', {
                        collectionIndex: collectionIndex,
                        collection: collection,
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
    <div v-if="showChildren || isFiltered" class="flex">
      <div
        class="ml-[1.375rem] flex w-0.5 transform cursor-nsResize bg-dividerLight transition hover:scale-x-125 hover:bg-dividerDark"
        @click="toggleShowChildren()"
      ></div>
      <div class="flex flex-1 flex-col truncate">
        <!-- Referring to this component only (this is recursive) -->
        <Folder
          v-for="(subFolder, subFolderIndex) in folder.folders"
          :key="`subFolder-${String(subFolderIndex)}`"
          :picked="picked"
          :save-request="saveRequest"
          :folder="subFolder"
          :folder-index="subFolderIndex"
          :folder-path="`${folderPath}/${String(subFolderIndex)}`"
          :collection-index="collectionIndex"
          :is-filtered="isFiltered"
          @add-request="emit('add-request', $event)"
          @add-folder="emit('add-folder', $event)"
          @edit-folder="emit('edit-folder', $event)"
          @duplicate-collection="emit('duplicate-collection', $event)"
          @edit-request="emit('edit-request', $event)"
          @duplicate-request="emit('duplicate-request', $event)"
          @edit-properties="
            emit('edit-properties', {
              collectionIndex: `${folderPath}/${String(subFolderIndex)}`,
              collection: subFolder,
            })
          "
          @select="emit('select', $event)"
          @select-request="$emit('select-request', $event)"
        />
        <CollectionsGraphqlRequest
          v-for="(request, index) in folder.requests"
          :key="`request-${String(index)}`"
          :picked="picked"
          :save-request="saveRequest"
          :request="request"
          :collection-index="collectionIndex"
          :folder-index="folderIndex"
          :folder-path="folderPath"
          :folder-name="folder.name"
          :request-index="index"
          @edit-request="emit('edit-request', $event)"
          @duplicate-request="emit('duplicate-request', $event)"
          @select="emit('select', $event)"
          @select-request="$emit('select-request', $event)"
        />

        <HoppSmartPlaceholder
          v-if="
            folder.folders &&
            folder.folders.length === 0 &&
            folder.requests &&
            folder.requests.length === 0
          "
          :src="`/images/states/${colorMode.value}/pack.svg`"
          :alt="`${t('empty.folder')}`"
          :text="t('empty.folder')"
        />
      </div>
    </div>
    <HoppSmartConfirmModal
      :show="confirmRemove"
      :title="`${t('confirm.remove_folder')}`"
      @hide-modal="confirmRemove = false"
      @resolve="removeFolder"
    />
  </div>
</template>

<script setup lang="ts">
import { useI18n } from "@composables/i18n"
import { useColorMode } from "@composables/theming"
import { useToast } from "@composables/toast"
import { HoppCollection } from "@hoppscotch/data"
import { useService } from "dioc/vue"
import { computed, ref } from "vue"
import { Picked } from "~/helpers/types/HoppPicked"
import { removeGraphqlFolder } from "~/newstore/collections"
import { GQLTabService } from "~/services/tab/graphql"
import IconCheckCircle from "~icons/lucide/check-circle"
import IconCopy from "~icons/lucide/copy"
import IconEdit from "~icons/lucide/edit"
import IconFilePlus from "~icons/lucide/file-plus"
import IconFolder from "~icons/lucide/folder"
import IconFolderOpen from "~icons/lucide/folder-open"
import IconFolderPlus from "~icons/lucide/folder-plus"
import IconMoreVertical from "~icons/lucide/more-vertical"
import IconSettings2 from "~icons/lucide/settings-2"
import IconTrash2 from "~icons/lucide/trash-2"

const toast = useToast()
const t = useI18n()
const colorMode = useColorMode()

const tabs = useService(GQLTabService)

const props = defineProps<{
  picked: Picked
  // Whether the request is in a selectable mode (activates 'select' event)
  saveRequest: boolean
  folder: HoppCollection
  folderIndex: number
  collectionIndex: number
  folderPath: string
  isFiltered: boolean
}>()

const emit = defineEmits([
  "select",
  "add-request",
  "edit-request",
  "add-folder",
  "edit-folder",
  "duplicate-collection",
  "duplicate-request",
  "edit-properties",
  "select-request",
  "drop-request",
])

// Template refs
const tippyActions = ref<any | null>(null)
const options = ref<any | null>(null)
const requestAction = ref<any | null>(null)
const folderAction = ref<any | null>(null)
const edit = ref<any | null>(null)
const duplicateAction = ref<any | null>(null)
const deleteAction = ref<any | null>(null)
const propertiesAction = ref<any | null>(null)

const showChildren = ref(false)
const dragging = ref(false)
const confirmRemove = ref(false)

const isSelected = computed(
  () =>
    props.picked?.pickedType === "gql-my-folder" &&
    props.picked?.folderPath === props.folderPath
)
const collectionIcon = computed(() => {
  if (isSelected.value) return IconCheckCircle
  else if (!showChildren.value && !props.isFiltered) return IconFolder
  else if (showChildren.value || !props.isFiltered) return IconFolderOpen
  return IconFolder
})

const pick = () => {
  emit("select", {
    pickedType: "gql-my-folder",
    folderPath: props.folderPath,
  })
}

const toggleShowChildren = () => {
  if (props.saveRequest) {
    pick()
  }

  showChildren.value = !showChildren.value
}

const removeFolder = () => {
  // Cancel pick if the picked folder is deleted
  if (
    props.picked?.pickedType === "gql-my-folder" &&
    props.picked?.folderPath === props.folderPath
  ) {
    emit("select", { picked: null })
  }

  const possibleTabs = tabs.getTabsRefTo((tab) => {
    const ctx = tab.document.saveContext

    if (!ctx) return false

    return (
      ctx.originLocation === "user-collection" &&
      ctx.folderPath.startsWith(props.folderPath)
    )
  })

  for (const tab of possibleTabs) {
    tab.value.document.saveContext = undefined
    tab.value.document.isDirty = true
  }

  removeGraphqlFolder(props.folderPath, props.folder.id)
  toast.success(t("state.deleted"))
}

const dropEvent = ({ dataTransfer }: any) => {
  dragging.value = !dragging.value
  const folderPath = dataTransfer.getData("folderPath")
  const requestIndex = dataTransfer.getData("requestIndex")

  emit("drop-request", {
    folderPath,
    requestIndex,
    collectionIndex: props.folderPath,
  })
}
</script>
