<template>
  <span class="flex flex-1 items-center space-x-2">
    <template v-for="(folder, index) in pathFolders" :key="index">
      <span class="block" :class="{ truncate: index !== 0 }">
        {{ folder.name }}
      </span>
      <icon-lucide-chevron-right class="flex flex-shrink-0" />
    </template>
    <span
      v-if="request && 'method' in request"
      class="flex flex-shrink-0 truncate rounded-md border border-dividerDark px-1 text-tiny font-semibold"
      :style="{ color: getMethodLabelColorClassOf(request.method) }"
    >
      {{ request.method.toUpperCase() }}
    </span>
    <span v-if="request" class="block">
      {{ request.name }}
    </span>
  </span>
</template>

<script setup lang="ts">
import { HoppCollection } from "@hoppscotch/data"
import { computed } from "vue"
import { restCollectionStore } from "~/newstore/collections"
import { getMethodLabelColorClassOf } from "~/helpers/rest/labelColoring"

const props = defineProps<{
  folderPath: string
}>()

const pathFolders = computed(() => {
  try {
    const folderIndicies = props.folderPath
      .split("/")
      .slice(0, -1)
      .map((x) => parseInt(x))

    const pathItems: HoppCollection[] = []

    let currentFolder = restCollectionStore.value.state[folderIndicies.shift()!]
    pathItems.push(currentFolder)

    while (folderIndicies.length > 0) {
      const folderIndex = folderIndicies.shift()!

      const folder = currentFolder.folders[folderIndex]
      pathItems.push(folder)

      currentFolder = folder
    }

    return pathItems
  } catch (e) {
    console.error(e)
    return []
  }
})

const request = computed(() => {
  try {
    const requestIndex = parseInt(props.folderPath.split("/").at(-1)!)

    return pathFolders.value[pathFolders.value.length - 1].requests[
      requestIndex
    ]
  } catch (e) {
    return null
  }
})
</script>
