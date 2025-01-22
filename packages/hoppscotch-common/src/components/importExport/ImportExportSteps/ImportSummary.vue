<script setup lang="ts">
import { HoppCollection, HoppRESTRequest } from "@hoppscotch/data"
import { computed, Ref, ref, watch } from "vue"
import { useI18n } from "~/composables/i18n"
import IconInfo from "~icons/lucide/info"
import { SupportedImportFormat } from "./../types"

const t = useI18n()

type Feature =
  | "collections"
  | "requests"
  | "responses"
  | "preRequestScripts"
  | "testScripts"

type FeatureStatus =
  | "SUPPORTED"
  | "NOT_SUPPORTED_BY_HOPPSCOTCH_IMPORT"
  | "NOT_SUPPORTED_BY_SOURCE"

type FeatureWithCount = {
  count: number
  label: string
  id: Feature
}

const props = defineProps<{
  importFormat: SupportedImportFormat
  collections: HoppCollection[]
  onClose: () => void
}>()

const importSourceAndSupportedFeatures: Record<
  SupportedImportFormat,
  Record<Feature, FeatureStatus>
> = {
  hoppscotch: {
    collections: "SUPPORTED",
    requests: "SUPPORTED",
    responses: "SUPPORTED",
    preRequestScripts: "SUPPORTED",
    testScripts: "SUPPORTED",
  },
  postman: {
    collections: "SUPPORTED",
    requests: "SUPPORTED",
    responses: "SUPPORTED",
    preRequestScripts: "NOT_SUPPORTED_BY_HOPPSCOTCH_IMPORT",
    testScripts: "NOT_SUPPORTED_BY_HOPPSCOTCH_IMPORT",
  },
  insomnia: {
    collections: "SUPPORTED",
    requests: "SUPPORTED",
    responses: "NOT_SUPPORTED_BY_SOURCE",
    preRequestScripts: "NOT_SUPPORTED_BY_HOPPSCOTCH_IMPORT",
    testScripts: "NOT_SUPPORTED_BY_HOPPSCOTCH_IMPORT",
  },
  openapi: {
    collections: "SUPPORTED",
    requests: "SUPPORTED",
    responses: "SUPPORTED",
    preRequestScripts: "NOT_SUPPORTED_BY_SOURCE",
    testScripts: "NOT_SUPPORTED_BY_SOURCE",
  },
  har: {
    collections: "SUPPORTED",
    requests: "SUPPORTED",
    responses: "NOT_SUPPORTED_BY_HOPPSCOTCH_IMPORT",
    preRequestScripts: "NOT_SUPPORTED_BY_SOURCE",
    testScripts: "NOT_SUPPORTED_BY_SOURCE",
  },
}

const featuresWithCount: Ref<FeatureWithCount[]> = ref([])

const countCollections = (collections: HoppCollection[]) => {
  let collectionCount = 0
  let requestCount = 0
  let preRequestScriptsCount = 0
  let testScriptsCount = 0
  let responseCount = 0

  const flattenHoppCollections = (_collections: HoppCollection[]) => {
    _collections.forEach((collection) => {
      collectionCount++

      collection.requests.forEach((request) => {
        requestCount++

        const _request = request as HoppRESTRequest

        preRequestScriptsCount += !!_request.preRequestScript?.trim() ? 1 : 0
        testScriptsCount += !!_request.testScript?.trim() ? 1 : 0

        responseCount += _request.responses
          ? Object.values(_request.responses).length
          : 0
      })

      flattenHoppCollections(collection.folders)
    })
  }

  flattenHoppCollections(collections)

  return {
    collectionCount,
    requestCount,
    responseCount,
    preRequestScriptsCount,
    testScriptsCount,
  }
}

watch(
  props.collections,
  (collections) => {
    const {
      collectionCount,
      requestCount,
      responseCount,
      preRequestScriptsCount,
      testScriptsCount,
    } = countCollections(collections)

    featuresWithCount.value = [
      {
        count: collectionCount,
        label: "import.import_summary_collections_title",
        id: "collections" as const,
      },
      {
        count: requestCount,
        label: "import.import_summary_requests_title",
        id: "requests" as const,
      },
      {
        count: responseCount,
        label: "import.import_summary_responses_title",
        id: "responses" as const,
      },
      {
        count: preRequestScriptsCount,
        label: "import.import_summary_pre_request_scripts_title",
        id: "preRequestScripts" as const,
      },
      {
        count: testScriptsCount,
        label: "import.import_summary_test_scripts_title",
        id: "testScripts" as const,
      },
    ]
  },
  {
    immediate: true,
  }
)

const featureSupportForImportFormat = computed(() => {
  return importSourceAndSupportedFeatures[props.importFormat]
})

const visibleFeatures = computed(() => {
  return featuresWithCount.value.filter((feature) => {
    return (
      importSourceAndSupportedFeatures[props.importFormat][feature.id] !==
      "NOT_SUPPORTED_BY_SOURCE"
    )
  })
})
</script>

<template>
  <div class="space-y-4">
    <div v-for="feature in visibleFeatures" :key="feature.id">
      <p class="flex items-center">
        <span
          class="inline-flex items-center justify-center flex-shrink-0 mr-4 border-4 rounded-full border-primary"
          :class="{
            'text-green-500':
              featureSupportForImportFormat[feature.id] === 'SUPPORTED',
            'text-amber-500':
              featureSupportForImportFormat[feature.id] ===
              'NOT_SUPPORTED_BY_HOPPSCOTCH_IMPORT',
          }"
        >
          <icon-lucide-check-circle
            v-if="featureSupportForImportFormat[feature.id] === 'SUPPORTED'"
            class="svg-icons"
          />

          <IconInfo
            v-else-if="
              featureSupportForImportFormat[feature.id] ===
              'NOT_SUPPORTED_BY_HOPPSCOTCH_IMPORT'
            "
            class="svg-icons"
          />
        </span>
        <span>{{ t(feature.label) }}</span>
      </p>

      <p class="ml-10 text-secondaryLight">
        <template
          v-if="featureSupportForImportFormat[feature.id] === 'SUPPORTED'"
        >
          {{ feature.count }}
          {{
            feature.count != 1
              ? t(feature.label)
              : t(feature.label).slice(0, -1)
          }}
          Imported
        </template>

        <template
          v-else-if="
            featureSupportForImportFormat[feature.id] ===
            'NOT_SUPPORTED_BY_HOPPSCOTCH_IMPORT'
          "
        >
          {{
            t("import.import_summary_not_supported_by_hoppscotch_import", {
              featureLabel: t(feature.label),
            })
          }}
        </template>
      </p>
    </div>
  </div>

  <div class="mt-10">
    <HoppButtonSecondary
      class="w-full"
      :label="t('action.close')"
      outline
      filled
      @click="onClose"
    />
  </div>
</template>
