<template>
  <HoppSmartModal
    v-if="show"
    dialog
    :title="t(`environment.${action}`)"
    @close="hideModal"
  >
    <template #body>
      <div class="flex flex-col px-2">
        <HoppSmartInput
          v-model="editingName"
          placeholder=" "
          :input-styles="['floating-input', isViewer && 'opacity-25']"
          :label="t('action.label')"
          :disabled="isViewer"
          @submit="saveEnvironment"
        />

        <div class="my-4 flex flex-col border border-divider rounded">
          <div
            v-if="evnExpandError"
            class="mb-2 w-full overflow-auto whitespace-normal rounded bg-primaryLight px-4 py-2 font-mono text-red-400"
          >
            {{ t("environment.nested_overflow") }}
          </div>
          <HoppSmartTabs v-model="selectedEnvOption" render-inactive-tabs>
            <template #actions>
              <div class="flex flex-1 items-center justify-between">
                <HoppButtonSecondary
                  v-tippy="{ theme: 'tooltip' }"
                  to="https://docs.hoppscotch.io/documentation/features/environments"
                  blank
                  :title="t('app.wiki')"
                  :icon="IconHelpCircle"
                />
                <HoppButtonSecondary
                  v-if="!isViewer"
                  v-tippy="{ theme: 'tooltip' }"
                  :title="t('action.clear_all')"
                  :icon="clearIcon"
                  @click="clearContent()"
                />
                <HoppButtonSecondary
                  v-if="!isViewer"
                  v-tippy="{ theme: 'tooltip' }"
                  :icon="IconPlus"
                  :title="t('add.new')"
                  @click="addEnvironmentVariable"
                />
              </div>
            </template>

            <HoppSmartTab
              v-for="tab in tabsData"
              :id="tab.id"
              :key="tab.id"
              :label="tab.label"
            >
              <div class="divide-y divide-dividerLight">
                <HoppSmartPlaceholder
                  v-if="tab.variables.length === 0"
                  :src="`/images/states/${colorMode.value}/blockchain.svg`"
                  :alt="tab.emptyStateLabel"
                  :text="tab.emptyStateLabel"
                >
                  <template #body>
                    <HoppButtonSecondary
                      v-if="!isViewer"
                      :label="`${t('add.new')}`"
                      filled
                      :icon="IconPlus"
                      @click="addEnvironmentVariable"
                    />
                  </template>
                </HoppSmartPlaceholder>

                <template v-else>
                  <div
                    v-for="({ id, env }, index) in tab.variables"
                    :key="`variable-${id}-${index}`"
                    class="flex divide-x divide-dividerLight"
                  >
                    <input
                      v-model="env.key"
                      v-focus
                      class="flex flex-1 bg-transparent px-4 py-2"
                      :placeholder="`${t('count.variable', {
                        count: index + 1,
                      })}`"
                      :name="'param' + index"
                      :disabled="isViewer"
                    />
                    <SmartEnvInput
                      v-model="env.value"
                      :select-text-on-mount="
                        env.key ? env.key === editingVariableName : false
                      "
                      :placeholder="`${t('count.value', { count: index + 1 })}`"
                      :envs="liveEnvs"
                      :name="'value' + index"
                      :secret="tab.isSecret"
                      :readonly="isViewer && !tab.isSecret"
                    />
                    <div v-if="!isViewer" class="flex">
                      <HoppButtonSecondary
                        id="variable"
                        v-tippy="{ theme: 'tooltip' }"
                        :title="t('action.remove')"
                        :icon="IconTrash"
                        color="red"
                        @click="removeEnvironmentVariable(id)"
                      />
                    </div>
                  </div>
                </template>
              </div>
            </HoppSmartTab>
          </HoppSmartTabs>
        </div>
      </div>
    </template>
    <template #footer>
      <span class="flex space-x-2">
        <HoppButtonPrimary
          :label="`${t('action.save')}`"
          :loading="isLoading"
          outline
          @click="saveEnvironment"
        />
        <HoppButtonSecondary
          :label="`${t('action.cancel')}`"
          outline
          filled
          @click="hideModal"
        />
      </span>
    </template>
  </HoppSmartModal>
</template>

<script setup lang="ts">
import { ComputedRef, computed, ref, watch } from "vue"
import * as E from "fp-ts/Either"
import * as A from "fp-ts/Array"
import * as O from "fp-ts/Option"
import * as TE from "fp-ts/TaskEither"
import { flow, pipe } from "fp-ts/function"
import { Environment, parseTemplateStringE } from "@hoppscotch/data"
import { refAutoReset } from "@vueuse/core"
import { clone } from "lodash-es"
import { useToast } from "@composables/toast"
import { useI18n } from "~/composables/i18n"
import {
  createTeamEnvironment,
  updateTeamEnvironment,
} from "~/helpers/backend/mutations/TeamEnvironment"
import { GQLError } from "~/helpers/backend/GQLClient"
import { TeamEnvironment } from "~/helpers/teams/TeamEnvironment"
import { useColorMode } from "~/composables/theming"
import IconTrash from "~icons/lucide/trash"
import IconTrash2 from "~icons/lucide/trash-2"
import IconDone from "~icons/lucide/check"
import IconPlus from "~icons/lucide/plus"
import IconHelpCircle from "~icons/lucide/help-circle"
import { platform } from "~/platform"
import { useService } from "dioc/vue"
import { SecretEnvironmentService } from "~/services/secret-environment.service"
import { getEnvActionErrorMessage } from "~/helpers/error-messages"

type EnvironmentVariable = {
  id: number
  env: {
    key: string
    value: string
    secret: boolean
  }
}

const t = useI18n()
const toast = useToast()
const colorMode = useColorMode()

const props = withDefaults(
  defineProps<{
    show: boolean
    action: "edit" | "new"
    editingEnvironment?: TeamEnvironment | null
    editingTeamId: string | undefined
    editingVariableName?: string | null
    isViewer?: boolean
    isSecretOptionSelected?: boolean
    envVars?: () => Environment["variables"]
  }>(),
  {
    show: false,
    action: "edit",
    editingEnvironment: null,
    editingTeamId: "",
    editingVariableName: null,
    isViewer: false,
    isSecretOptionSelected: false,
    envVars: () => [],
  }
)

const emit = defineEmits<{
  (e: "hide-modal"): void
}>()

const idTicker = ref(0)

const tabsData: ComputedRef<
  {
    id: string
    label: string
    emptyStateLabel: string
    isSecret: boolean
    variables: EnvironmentVariable[]
  }[]
> = computed(() => {
  return [
    {
      id: "variables",
      label: t("environment.variables"),
      emptyStateLabel: t("empty.environments"),
      isSecret: false,
      variables: nonSecretVars.value,
    },
    {
      id: "secret",
      label: t("environment.secrets"),
      emptyStateLabel: t("empty.secret_environments"),
      isSecret: true,
      variables: secretVars.value,
    },
  ]
})

const editingName = ref<string | null>(null)
const editingID = ref<string | null>(null)
const vars = ref<EnvironmentVariable[]>([
  { id: idTicker.value++, env: { key: "", value: "", secret: false } },
])

const secretEnvironmentService = useService(SecretEnvironmentService)

const secretVars = computed(() =>
  pipe(
    vars.value,
    A.filter((e) => e.env.secret)
  )
)

const nonSecretVars = computed(() =>
  pipe(
    vars.value,
    A.filter((e) => !e.env.secret)
  )
)

type SelectedEnv = "variables" | "secret"

const selectedEnvOption = ref<SelectedEnv>("variables")

const clearIcon = refAutoReset<typeof IconTrash2 | typeof IconDone>(
  IconTrash2,
  1000
)

const evnExpandError = computed(() => {
  const variables = pipe(
    vars.value,
    A.map((e) => e.env)
  )

  return pipe(
    variables,
    A.exists(({ value }) => E.isLeft(parseTemplateStringE(value, variables)))
  )
})

const liveEnvs = computed(() => {
  if (evnExpandError.value) {
    return []
  }
  return [...vars.value.map((x) => ({ ...x.env, source: editingName.value! }))]
})

watch(
  () => props.show,
  (show) => {
    if (show) {
      editingName.value = props.editingEnvironment?.environment.name ?? null
      selectedEnvOption.value = props.isSecretOptionSelected
        ? "secret"
        : "variables"
      if (props.action === "new") {
        vars.value = pipe(
          props.envVars() ?? [],
          A.map((e) => ({
            id: idTicker.value++,
            env: clone(e),
          }))
        )
      } else if (props.editingEnvironment !== null) {
        editingID.value = props.editingEnvironment.id
        vars.value = pipe(
          props.editingEnvironment.environment.variables ?? [],
          A.mapWithIndex((index, e) => ({
            id: idTicker.value++,
            env: {
              key: e.key,
              value: e.secret
                ? (secretEnvironmentService.getSecretEnvironmentVariable(
                    editingID.value ?? "",
                    index
                  )?.value ??
                  // @ts-expect-error `value` field can exist for secret environment variables as inferred while importing
                  e.value ??
                  "")
                : e.value,
              secret: e.secret,
            },
          }))
        )
      }
    }
  }
)

const clearContent = () => {
  vars.value = []
  clearIcon.value = IconDone
  toast.success(`${t("state.cleared")}`)
}

const addEnvironmentVariable = () => {
  vars.value.push({
    id: idTicker.value++,
    env: {
      key: "",
      value: "",
      secret: selectedEnvOption.value === "secret",
    },
  })
}

const removeEnvironmentVariable = (id: number) => {
  const index = vars.value.findIndex((e) => e.id === id)
  if (index !== -1) {
    vars.value.splice(index, 1)
  }
}

const isLoading = ref(false)

const saveEnvironment = async () => {
  isLoading.value = true

  if (!editingName.value) {
    isLoading.value = false
    toast.error(`${t("environment.invalid_name")}`)

    return
  }

  const filteredVariables = pipe(
    vars.value,
    A.filterMap(
      flow(
        O.fromPredicate((e) => e.env.key !== ""),
        O.map((e) => e.env)
      )
    )
  )

  const secretVariables = pipe(
    filteredVariables,
    A.filterMapWithIndex((i, e) =>
      e.secret ? O.some({ key: e.key, value: e.value, varIndex: i }) : O.none
    )
  )

  const variables = pipe(
    filteredVariables,
    A.map((e) => (e.secret ? { key: e.key, secret: e.secret } : e))
  )

  const environmentUpdated: Environment = {
    v: 1,
    id: editingID.value ?? "",
    name: editingName.value,
    variables,
  }

  if (props.action === "new") {
    platform.analytics?.logEvent({
      type: "HOPP_CREATE_ENVIRONMENT",
      workspaceType: "team",
    })

    if (!props.isViewer) {
      await pipe(
        createTeamEnvironment(
          JSON.stringify(environmentUpdated.variables),
          props.editingTeamId,
          environmentUpdated.name
        ),
        TE.match(
          (err: GQLError<string>) => {
            console.error(err)
            toast.error(t(getEnvActionErrorMessage(err)))
            isLoading.value = false
          },
          (res) => {
            const envID = res.createTeamEnvironment.id
            if (envID) {
              secretEnvironmentService.addSecretEnvironment(
                envID,
                secretVariables
              )
            }
            hideModal()
            toast.success(`${t("environment.created")}`)
            isLoading.value = false
          }
        )
      )()
    }
  } else {
    if (!props.editingEnvironment) {
      console.error("No Environment Found")
      return
    }

    if (editingID.value) {
      secretEnvironmentService.addSecretEnvironment(
        editingID.value,
        secretVariables
      )

      // If the user is a viewer, we don't need to update the environment in BE
      // just update the secret environment in the local storage
      if (props.isViewer) {
        hideModal()
        toast.success(`${t("environment.updated")}`)
      }
    }

    if (!props.isViewer) {
      await pipe(
        updateTeamEnvironment(
          JSON.stringify(environmentUpdated.variables),
          props.editingEnvironment.id,
          environmentUpdated.name
        ),
        TE.match(
          (err: GQLError<string>) => {
            console.error(err)
            toast.error(t(getEnvActionErrorMessage(err)))
            isLoading.value = false
          },
          () => {
            hideModal()
            toast.success(`${t("environment.updated")}`)
            isLoading.value = false
          }
        )
      )()
    }
  }

  isLoading.value = false
}

const hideModal = () => {
  editingName.value = null
  selectedEnvOption.value = "variables"
  emit("hide-modal")
}
</script>
