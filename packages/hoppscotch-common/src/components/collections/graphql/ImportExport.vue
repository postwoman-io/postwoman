<template>
  <ImportExportBase
    ref="collections-import-export"
    modal-title="graphql_collections.title"
    :importer-modules="importerModules"
    :exporter-modules="exporterModules"
    @hide-modal="emit('hide-modal')"
  />
</template>

<script setup lang="ts">
import { HoppCollection } from "@hoppscotch/data"
import * as E from "fp-ts/Either"
import { ref } from "vue"

import { useI18n } from "~/composables/i18n"
import { useToast } from "~/composables/toast"
import { ImporterOrExporter } from "~/components/importExport/types"
import { FileSource } from "~/helpers/import-export/import/import-sources/FileSource"
import { GistSource } from "~/helpers/import-export/import/import-sources/GistSource"

import IconFolderPlus from "~icons/lucide/folder-plus"
import IconUser from "~icons/lucide/user"
import { initializeDownloadFile } from "~/helpers/import-export/export"
import { useReadonlyStream } from "~/composables/stream"

import { platform } from "~/platform"
import {
  appendGraphqlCollections,
  graphqlCollections$,
} from "~/newstore/collections"
import { hoppGqlCollectionsImporter } from "~/helpers/import-export/import/hoppGql"
import { gqlCollectionsExporter } from "~/helpers/import-export/export/gqlCollections"
import { gistExporter } from "~/helpers/import-export/export/gist"
import { computed } from "vue"
import { hoppGQLImporter } from "~/helpers/import-export/import/hopp"

const t = useI18n()
const toast = useToast()

const currentUser = useReadonlyStream(
  platform.auth.getCurrentUserStream(),
  platform.auth.getCurrentUser()
)

const gqlCollections = useReadonlyStream(graphqlCollections$, [])

const isGqlCollectionGistExportInProgress = ref(false)

const GqlCollectionsHoppImporter: ImporterOrExporter = {
  metadata: {
    id: "import.from_json",
    name: "import.from_json",
    icon: IconFolderPlus,
    title: "import.from_json",
    applicableTo: ["personal-workspace"],
    disabled: false,
  },
  component: FileSource({
    acceptedFileTypes: "application/json",
    caption: "import.from_json_description",
    onImportFromFile: async (gqlCollections) => {
      const res = await hoppGqlCollectionsImporter(gqlCollections)

      if (E.isLeft(res)) {
        showImportFailedError()
        return
      }
      const validatedCollection = await hoppGQLImporter(
        JSON.stringify(res.right)
      )()

      if (E.isRight(validatedCollection)) {
        handleImportToStore(validatedCollection.right)

        platform.analytics?.logEvent({
          type: "HOPP_IMPORT_COLLECTION",
          platform: "gql",
          workspaceType: "personal",
          importer: "json",
        })
      }

      emit("hide-modal")
    },
  }),
}

const GqlCollectionsGistImporter: ImporterOrExporter = {
  metadata: {
    id: "import.from_gist",
    name: "import.from_gist",
    icon: IconFolderPlus,
    title: "import.from_gist",
    applicableTo: ["personal-workspace", "team-workspace"],
    disabled: false,
  },
  component: GistSource({
    caption: "import.gql_collections_from_gist_description",
    onImportFromGist: async (gqlCollections) => {
      if (E.isLeft(gqlCollections)) {
        showImportFailedError()
        return
      }

      const res = await hoppGqlCollectionsImporter(gqlCollections.right)

      if (E.isLeft(res)) {
        showImportFailedError()
        return
      }

      handleImportToStore(res.right)

      platform.analytics?.logEvent({
        type: "HOPP_IMPORT_COLLECTION",
        platform: "gql",
        workspaceType: "personal",
        importer: "gist",
      })

      emit("hide-modal")
    },
  }),
}

const GqlCollectionsHoppExporter: ImporterOrExporter = {
  metadata: {
    id: "export.as_json",
    name: "export.as_json",
    title: "action.download_file",
    icon: IconUser,
    disabled: false,
    applicableTo: ["personal-workspace", "team-workspace"],
  },
  action: async () => {
    if (!gqlCollections.value.length) {
      return toast.error(t("error.no_collections_to_export"))
    }

    const message = await initializeDownloadFile(
      gqlCollectionsExporter(gqlCollections.value),
      "hoppscotch-gql-collections"
    )

    if (E.isLeft(message)) {
      toast.error(t("export.failed"))
      return
    }

    toast.success(t("state.download_started"))

    platform.analytics?.logEvent({
      type: "HOPP_EXPORT_COLLECTION",
      platform: "gql",
      exporter: "json",
    })
  },
}

const GqlCollectionsGistExporter: ImporterOrExporter = {
  metadata: {
    id: "export.as_gist",
    name: "export.create_secret_gist",
    title:
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      currentUser?.value?.provider === "github.com"
        ? "export.create_secret_gist_tooltip_text"
        : "export.require_github",
    icon: IconUser,
    disabled: !currentUser.value
      ? true
      : currentUser.value?.provider !== "github.com",
    applicableTo: ["personal-workspace"],
    isLoading: isGqlCollectionGistExportInProgress,
  },
  action: async () => {
    if (!gqlCollections.value.length) {
      return toast.error(t("error.no_collections_to_export"))
    }

    if (!currentUser.value) {
      toast.error(t("profile.no_permission"))
      return
    }

    isGqlCollectionGistExportInProgress.value = true

    const accessToken = currentUser.value?.accessToken

    if (accessToken) {
      const res = await gistExporter(
        JSON.stringify(gqlCollections.value),
        accessToken
      )

      if (E.isLeft(res)) {
        toast.error(t("export.failed"))
        return
      }

      toast.success(t("export.secret_gist_success"))

      platform.analytics?.logEvent({
        type: "HOPP_EXPORT_COLLECTION",
        platform: "gql",
        exporter: "gist",
      })

      platform.io.openExternalLink(res.right)
    }

    isGqlCollectionGistExportInProgress.value = false
  },
}

const importerModules = [GqlCollectionsHoppImporter, GqlCollectionsGistImporter]

const exporterModules = computed(() => {
  const modules = [GqlCollectionsHoppExporter]

  if (platform.platformFeatureFlags.exportAsGIST) {
    modules.push(GqlCollectionsGistExporter)
  }

  return modules
})

const showImportFailedError = () => {
  toast.error(t("import.failed"))
}

const handleImportToStore = (gqlCollections: HoppCollection[]) => {
  appendGraphqlCollections(gqlCollections)
  toast.success(t("state.file_imported"))
}

const emit = defineEmits<{
  (e: "hide-modal"): () => void
}>()
</script>
