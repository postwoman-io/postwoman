<template>
  <HoppSmartModal
    dialog
    :title="t(modalTitle)"
    styles="sm:max-w-md"
    @close="hideModal"
  >
    <template #actions>
      <HoppButtonSecondary
        v-if="hasPreviousStep && !isImportSummaryStep"
        v-tippy="{ theme: 'tooltip' }"
        :title="t('action.go_back')"
        :icon="IconArrowLeft"
        @click="goToPreviousStep"
      />
    </template>
    <template #body>
      <component :is="currentStep.component" v-bind="currentStep.props()" />
    </template>
  </HoppSmartModal>
</template>
<script setup lang="ts">
import IconArrowLeft from "~icons/lucide/arrow-left"

import { useI18n } from "~/composables/i18n"
import { computed, PropType, ref, watch } from "vue"

import { useSteps, defineStep } from "~/composables/step-components"
import ImportExportList from "./ImportExportList.vue"

import ImportExportSourcesList from "./ImportExportSourcesList.vue"
import { ImporterOrExporter } from "~/components/importExport/types"
import ImportSummary from "~/components/importExport/ImportExportSteps/ImportSummary.vue"

const t = useI18n()

const props = defineProps({
  importerModules: {
    // type: Array as PropType<ReturnType<typeof defineImporter>[]>,
    type: Array as PropType<ImporterOrExporter[]>,
    default: () => [],
    required: true,
  },
  exporterModules: {
    type: Array as PropType<ImporterOrExporter[]>,
    default: () => [],
    required: true,
  },
  modalTitle: {
    type: String,
    required: true,
  },
})

const {
  addStep,
  currentStep,
  goToStep,
  goToNextStep,
  goToPreviousStep,
  hasPreviousStep,
} = useSteps()

const isImportSummaryStep = computed(() => {
  return currentStep.value.id.startsWith("import_summary_")
})

const selectedImporterID = ref<string | null>(null)
const selectedSourceID = ref<string | null>(null)

const chooseImporterOrExporter = defineStep(
  "choose_importer_or_exporter",
  ImportExportList,
  () => ({
    importers: props.importerModules.map((importer) => ({
      id: importer.metadata.id,
      name: importer.metadata.name,
      title: importer.metadata.title,
      icon: importer.metadata.icon,
      disabled: importer.metadata.disabled,
    })),
    exporters: props.exporterModules.map((exporter) => ({
      id: exporter.metadata.id,
      name: exporter.metadata.name,
      title: exporter.metadata.title,
      icon: exporter.metadata.icon,
      disabled: exporter.metadata.disabled,
      loading: exporter.metadata.isLoading?.value ?? false,
    })),
    "onImporter-selected": (id: string) => {
      selectedImporterID.value = id

      const selectedImporter = props.importerModules.find(
        (i) => i.metadata.id === id
      )

      if (selectedImporter?.onSelect) {
        const res = selectedImporter.onSelect()

        if (res) {
          return
        }
      }

      if (selectedImporter?.supported_sources) goToNextStep()
      else if (selectedImporter?.component)
        goToStep(selectedImporter.component.id)
    },
    "onExporter-selected": (id: string) => {
      const selectedExporter = props.exporterModules.find(
        (i) => i.metadata.id === id
      )

      if (selectedExporter && selectedExporter.action) {
        selectedExporter.action()
      }
    },
  })
)

const chooseImportSource = defineStep(
  "choose_import_source",
  ImportExportSourcesList,
  () => {
    const currentImporter = props.importerModules.find(
      (i) => i.metadata.id === selectedImporterID.value
    )

    const sources = currentImporter?.supported_sources

    if (!sources)
      return {
        sources: [],
      }

    sources.forEach((source) => {
      addStep(source.step)
    })

    return {
      sources: sources.map((source) => ({
        id: source.id,
        name: source.name,
        icon: source.icon,
      })),
      "onImport-source-selected": (sourceID) => {
        selectedSourceID.value = sourceID

        const sourceStep = sources.find((s) => s.id === sourceID)?.step

        if (sourceStep) {
          goToStep(sourceStep.id)
        }
      },
    }
  }
)

addStep(chooseImporterOrExporter)
addStep(chooseImportSource)

const selectedImporterImportSummary = computed(() => {
  const importer = props.importerModules.find(
    (i) => i.metadata.id === selectedImporterID.value
  )

  if (!importer?.importSummary) return null

  return importer.importSummary
})

watch(
  selectedImporterImportSummary,
  (val) => {
    if (val?.value.showImportSummary) {
      goToStep(`import_summary_${selectedImporterID.value}`)
    }
  },
  { deep: true }
)

props.importerModules.forEach((importer) => {
  if (importer.component) {
    addStep(importer.component)
  }

  const importSummary = importer.importSummary

  if (!importSummary) {
    return
  }

  if (importSummary.value) {
    addStep({
      id: `import_summary_${importer.metadata.id}`,
      component: ImportSummary,
      props: () => ({
        collections: importSummary.value.importedCollections,
        importFormat: importer.metadata.format,
        "on-close": () => {
          emit("hide-modal")
        },
      }),
    })
  }
})

const emit = defineEmits<{
  (e: "hide-modal"): void
}>()

const hideModal = () => {
  // resetImport()
  emit("hide-modal")
}
</script>
