<template>
  <ImportExportBase
    ref="collections-import-export"
    modal-title="environment.title"
    :importer-modules="importerModules"
    :exporter-modules="exporterModules"
    @hide-modal="emit('hide-modal')"
  />
</template>

<script setup lang="ts">
import { Environment, NonSecretEnvironment } from "@hoppscotch/data"
import * as E from "fp-ts/Either"
import { ref } from "vue"

import { ImporterOrExporter } from "~/components/importExport/types"
import { useI18n } from "~/composables/i18n"
import { useToast } from "~/composables/toast"
import { hoppEnvImporter } from "~/helpers/import-export/import/hoppEnv"
import { FileSource } from "~/helpers/import-export/import/import-sources/FileSource"
import { GistSource } from "~/helpers/import-export/import/import-sources/GistSource"

import {
  addGlobalEnvVariable,
  appendEnvironments,
  environments$,
} from "~/newstore/environments"

import { GQLError } from "~/helpers/backend/GQLClient"
import { CreateTeamEnvironmentMutation } from "~/helpers/backend/graphql"
import { createTeamEnvironment } from "~/helpers/backend/mutations/TeamEnvironment"
import { insomniaEnvImporter } from "~/helpers/import-export/import/insomniaEnv"
import { postmanEnvImporter } from "~/helpers/import-export/import/postmanEnv"
import { TeamEnvironment } from "~/helpers/teams/TeamEnvironment"

import { computed } from "vue"
import { useReadonlyStream } from "~/composables/stream"
import { initializeDownloadFile } from "~/helpers/import-export/export"
import { environmentsExporter } from "~/helpers/import-export/export/environments"
import { gistExporter } from "~/helpers/import-export/export/gist"
import { platform } from "~/platform"
import IconInsomnia from "~icons/hopp/insomnia"
import IconPostman from "~icons/hopp/postman"
import IconFolderPlus from "~icons/lucide/folder-plus"
import IconUser from "~icons/lucide/user"

const t = useI18n()
const toast = useToast()

const props = defineProps<{
  teamEnvironments?: TeamEnvironment[]
  teamId?: string | undefined
  environmentType: "MY_ENV" | "TEAM_ENV"
}>()

const myEnvironments = useReadonlyStream(environments$, [])

const currentUser = useReadonlyStream(
  platform.auth.getCurrentUserStream(),
  platform.auth.getCurrentUser()
)

const isPostmanImporterInProgress = ref(false)
const isInsomniaImporterInProgress = ref(false)
const isRESTImporterInProgress = ref(false)
const isGistImporterInProgress = ref(false)

const isEnvironmentGistExportInProgress = ref(false)

const isTeamEnvironment = computed(() => {
  return props.environmentType === "TEAM_ENV"
})

const environmentJson = computed(() => {
  if (isTeamEnvironment.value && props.teamEnvironments) {
    return props.teamEnvironments.map((x) => x.environment)
  }

  return myEnvironments.value
})

const workspaceType = computed(() =>
  isTeamEnvironment.value ? "team" : "personal"
)

const HoppEnvironmentsImport: ImporterOrExporter = {
  metadata: {
    id: "import.from_json",
    name: "import.from_json",
    icon: IconFolderPlus,
    title: "import.from_json",
    applicableTo: ["personal-workspace", "team-workspace"],
    disabled: false,
  },
  component: FileSource({
    acceptedFileTypes: "application/json",
    caption: "import.hoppscotch_environment_description",
    onImportFromFile: async (environments) => {
      isRESTImporterInProgress.value = true

      const res = await hoppEnvImporter(environments)()

      if (E.isRight(res)) {
        await handleImportToStore(res.right)

        platform.analytics?.logEvent({
          type: "HOPP_IMPORT_ENVIRONMENT",
          platform: "rest",
          workspaceType: isTeamEnvironment.value ? "team" : "personal",
        })

        emit("hide-modal")
      } else {
        showImportFailedError()
      }

      isRESTImporterInProgress.value = false
    },
    isLoading: isRESTImporterInProgress,
  }),
}

const PostmanEnvironmentsImport: ImporterOrExporter = {
  metadata: {
    id: "import.from_postman",
    name: "import.from_postman",
    icon: IconPostman,
    title: "import.from_json",
    applicableTo: ["personal-workspace", "team-workspace"],
    disabled: false,
  },
  component: FileSource({
    acceptedFileTypes: "application/json",
    caption: "import.postman_environment_description",
    onImportFromFile: async (environments) => {
      isPostmanImporterInProgress.value = true

      const res = await postmanEnvImporter(environments)()

      if (E.isRight(res)) {
        await handleImportToStore(res.right)

        platform.analytics?.logEvent({
          type: "HOPP_IMPORT_ENVIRONMENT",
          platform: "rest",
          workspaceType: isTeamEnvironment.value ? "team" : "personal",
        })

        emit("hide-modal")
      } else {
        showImportFailedError()
      }

      isPostmanImporterInProgress.value = false
    },
    isLoading: isPostmanImporterInProgress,
  }),
}

const insomniaEnvironmentsImport: ImporterOrExporter = {
  metadata: {
    id: "import.from_insomnia",
    name: "import.from_insomnia",
    icon: IconInsomnia,
    title: "import.from_json",
    applicableTo: ["personal-workspace", "team-workspace"],
    disabled: false,
  },
  component: FileSource({
    acceptedFileTypes: "application/json",
    caption: "import.insomnia_environment_description",
    onImportFromFile: async (environments) => {
      isInsomniaImporterInProgress.value = true

      const res = await insomniaEnvImporter(environments)()

      if (E.isRight(res)) {
        const globalEnvs = res.right.filter(
          (env) => env.name === "Base Environment"
        )
        const otherEnvs = res.right.filter(
          (env) => env.name !== "Base Environment"
        )

        await handleImportToStore(otherEnvs, globalEnvs)

        platform.analytics?.logEvent({
          type: "HOPP_IMPORT_ENVIRONMENT",
          platform: "rest",
          workspaceType: isTeamEnvironment.value ? "team" : "personal",
        })

        emit("hide-modal")
      } else {
        showImportFailedError()
      }

      isInsomniaImporterInProgress.value = false
    },
    isLoading: isInsomniaImporterInProgress,
  }),
}

const EnvironmentsImportFromGIST: ImporterOrExporter = {
  metadata: {
    id: "import.environments_from_gist",
    name: "import.environments_from_gist",
    icon: IconFolderPlus,
    title: "import.environments_from_gist",
    applicableTo: ["personal-workspace", "team-workspace"],
    disabled: false,
  },
  component: GistSource({
    caption: "import.environments_from_gist_description",
    onImportFromGist: async (environments) => {
      if (E.isLeft(environments)) {
        showImportFailedError()
        return
      }

      isGistImporterInProgress.value = true

      const res = await hoppEnvImporter(environments.right)()

      if (E.isRight(res)) {
        await handleImportToStore(res.right)

        platform.analytics?.logEvent({
          type: "HOPP_IMPORT_ENVIRONMENT",
          platform: "rest",
          workspaceType: isTeamEnvironment.value ? "team" : "personal",
        })
        emit("hide-modal")
      } else {
        showImportFailedError()
      }

      isGistImporterInProgress.value = false
    },
    isLoading: isGistImporterInProgress,
  }),
}

const HoppEnvironmentsExport: ImporterOrExporter = {
  metadata: {
    id: "export.as_json",
    name: "export.as_json",
    title: "action.download_file",
    icon: IconUser,
    disabled: false,
    applicableTo: ["personal-workspace", "team-workspace"],
  },
  action: async () => {
    if (!environmentJson.value.length) {
      return toast.error(t("error.no_environments_to_export"))
    }

    const message = await initializeDownloadFile(
      environmentsExporter(environmentJson.value),
      `hoppscotch-${workspaceType.value}-environments`
    )

    if (E.isLeft(message)) {
      toast.error(t("export.failed"))
      return
    }

    toast.success(t("state.download_started"))

    platform.analytics?.logEvent({
      type: "HOPP_EXPORT_ENVIRONMENT",
      platform: "rest",
    })
  },
}

const HoppEnvironmentsGistExporter: ImporterOrExporter = {
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
    applicableTo: ["personal-workspace", "team-workspace"],
    isLoading: isEnvironmentGistExportInProgress,
  },
  action: async () => {
    if (!environmentJson.value.length) {
      return toast.error(t("error.no_environments_to_export"))
    }

    if (!currentUser.value) {
      toast.error(t("profile.no_permission"))
      return
    }

    isEnvironmentGistExportInProgress.value = true

    const accessToken = currentUser.value?.accessToken

    if (accessToken) {
      const res = await gistExporter(
        JSON.stringify(environmentJson.value),
        accessToken,
        "hoppscotch-environment.json"
      )

      if (E.isLeft(res)) {
        toast.error(t("export.failed"))
        isEnvironmentGistExportInProgress.value = false
        return
      }

      toast.success(t("export.secret_gist_success"))

      platform.analytics?.logEvent({
        type: "HOPP_EXPORT_ENVIRONMENT",
        platform: "rest",
      })

      platform.io.openExternalLink(res.right)
    }

    isEnvironmentGistExportInProgress.value = false
  },
}

const importerModules = [
  HoppEnvironmentsImport,
  EnvironmentsImportFromGIST,
  PostmanEnvironmentsImport,
  insomniaEnvironmentsImport,
]

const exporterModules = computed(() => {
  const enabledExporters = [HoppEnvironmentsExport]

  if (platform.platformFeatureFlags.exportAsGIST) {
    enabledExporters.push(HoppEnvironmentsGistExporter)
  }

  return enabledExporters
})

const showImportFailedError = () => {
  toast.error(t("import.failed").toString())
}

const handleImportToStore = async (
  environments: Environment[],
  globalEnvs: NonSecretEnvironment[] = []
) => {
  // Add global envs to the store
  globalEnvs.forEach(({ variables }) => {
    variables.forEach(({ key, value, secret }) => {
      addGlobalEnvVariable({ key, value, secret })
    })
  })

  if (props.environmentType === "MY_ENV") {
    appendEnvironments(environments)
    toast.success(t("state.file_imported"))
  } else {
    await importToTeams(environments)
  }
}

const importToTeams = async (content: Environment[]) => {
  const envImportPromises: Promise<
    E.Either<GQLError<"">, CreateTeamEnvironmentMutation>
  >[] = []

  for (const [, env] of content.entries()) {
    const res = createTeamEnvironment(
      JSON.stringify(env.variables),
      props.teamId as string,
      env.name
    )()

    envImportPromises.push(res)
  }

  const res = await Promise.all(envImportPromises)

  const failedImports = res.some((r) => E.isLeft(r))

  if (failedImports) {
    toast.error(t("import.failed"))
  } else {
    toast.success(t("import.success"))
  }
}

const emit = defineEmits<{
  (e: "hide-modal"): () => void
}>()
</script>
