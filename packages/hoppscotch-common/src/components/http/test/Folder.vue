<template>
  <div class="flex flex-col">
    <div class="h-1 w-full transition"></div>
    <div class="flex flex-col relative">
      <div
        class="absolute bg-accent opacity-0 pointer-events-none inset-0 z-1 transition"
      ></div>
      <div
        class="flex items-stretch group relative z-3 cursor-pointer pointer-events-auto"
      >
        <div class="flex items-center justify-center flex-1 min-w-0">
          <span
            class="flex items-center justify-center px-4 pointer-events-none"
          >
            <HoppSmartCheckbox
              v-if="showSelection"
              :on="isSelected"
              class="mr-2"
            />
            <component :is="IconFolderOpen" class="svg-icons" />
          </span>
          <span
            class="flex flex-1 min-w-0 py-2 pr-2 transition pointer-events-none group-hover:text-secondaryDark"
          >
            <span class="truncate">
              {{ collectionName }}
            </span>
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import IconFolderOpen from "~icons/lucide/folder-open"
import { ref, computed, watch } from "vue"
import { HoppCollection } from "@hoppscotch/data"
import { TippyComponent } from "vue-tippy"
import { TeamCollection } from "~/helpers/teams/TeamCollection"

type FolderType = "collection" | "folder"

const props = withDefaults(
  defineProps<{
    id: string
    parentID?: string | null
    data: HoppCollection | TeamCollection
    /**
     * Collection component can be used for both collections and folders.
     * folderType is used to determine which one it is.
     */
    folderType: FolderType
    isOpen: boolean
    isSelected?: boolean
    exportLoading?: boolean
    hasNoTeamAccess?: boolean
    collectionMoveLoading?: string[]
    isLastItem?: boolean
    showSelection?: boolean
  }>(),
  {
    id: "",
    parentID: null,
    folderType: "collection",
    isOpen: false,
    isSelected: false,
    exportLoading: false,
    hasNoTeamAccess: false,
    isLastItem: false,
    showSelection: false,
  }
)

const options = ref<TippyComponent | null>(null)
const collectionName = computed(() => {
  if ((props.data as HoppCollection).name)
    return (props.data as HoppCollection).name
  return (props.data as TeamCollection).title
})

watch(
  () => props.exportLoading,
  (val) => {
    if (!val) {
      options.value!.tippy?.hide()
    }
  }
)
</script>
