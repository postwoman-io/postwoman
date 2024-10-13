<template>
  <div class="select-wrapper">
    <select
      v-model="mySelectedCollectionID"
      autocomplete="off"
      class="select"
      autofocus
    >
      <option :key="undefined" :value="undefined" disabled selected>
        {{ t("collection.select") }}
      </option>
      <option
        v-for="(collection, collectionIndex) in myCollections"
        :key="`collection-${collectionIndex}`"
        :value="collectionIndex"
        class="bg-primary"
      >
        {{ collection.name }}
      </option>
    </select>
  </div>

  <div class="my-4">
    <HoppButtonPrimary
      class="w-full"
      :label="t('import.title')"
      :loading="loading"
      :disabled="!hasSelectedCollectionID || loading"
      @click="fetchCollectionFromMyCollections"
    />
  </div>
</template>

<script setup lang="ts">
import { HoppCollection } from "@hoppscotch/data"
import { computed, ref } from "vue"
import { useI18n } from "~/composables/i18n"
import { useReadonlyStream } from "~/composables/stream"
import { getRESTCollection, restCollections$ } from "~/newstore/collections"

const t = useI18n()

defineProps<{
  loading: boolean
}>()

const mySelectedCollectionID = ref<number | undefined>(undefined)

const hasSelectedCollectionID = computed(() => {
  return mySelectedCollectionID.value !== undefined
})

const myCollections = useReadonlyStream(restCollections$, [])

const emit = defineEmits<{
  (e: "importFromMyCollection", content: HoppCollection): void
}>()

const fetchCollectionFromMyCollections = async () => {
  if (mySelectedCollectionID.value === undefined) {
    return
  }

  const collection = getRESTCollection(mySelectedCollectionID.value)

  if (collection) {
    emit("importFromMyCollection", collection)
  }
}
</script>
