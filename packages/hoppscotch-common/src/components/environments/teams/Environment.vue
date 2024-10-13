<template>
  <div
    class="group flex items-stretch"
    @contextmenu.prevent="options!.tippy?.show()"
  >
    <span
      class="flex cursor-pointer items-center justify-center px-4"
      @click="emit('edit-environment')"
    >
      <icon-lucide-layers class="svg-icons" />
    </span>
    <span
      class="flex min-w-0 flex-1 cursor-pointer py-2 pr-2 transition group-hover:text-secondaryDark"
      @click="emit('edit-environment')"
    >
      <span class="truncate">
        {{ environment.environment.name }}
      </span>
    </span>
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
        />
        <template #content="{ hide }">
          <div
            ref="tippyActions"
            class="flex flex-col focus:outline-none"
            tabindex="0"
            role="menu"
            @keyup.e="edit!.$el.click()"
            @keyup.d="duplicate!.$el.click()"
            @keyup.j="exportAsJsonEl!.$el.click()"
            @keyup.delete="deleteAction!.$el.click()"
            @keyup.p="propertiesAction!.$el.click()"
            @keyup.escape="options!.tippy?.hide()"
          >
            <HoppSmartItem
              ref="edit"
              :icon="IconEdit"
              :label="`${t('action.edit')}`"
              :shortcut="['E']"
              :disabled="duplicateEnvironmentLoading"
              @click="
                () => {
                  emit('edit-environment')
                  hide()
                }
              "
            />

            <HoppSmartItem
              v-if="!isViewer"
              ref="duplicate"
              :icon="IconCopy"
              :label="`${t('action.duplicate')}`"
              :shortcut="['D']"
              :loading="duplicateEnvironmentLoading"
              @click="duplicateEnvironment"
            />
            <HoppSmartItem
              v-if="!isViewer"
              ref="exportAsJsonEl"
              :icon="IconEdit"
              :label="`${t('export.as_json')}`"
              :shortcut="['J']"
              :disabled="duplicateEnvironmentLoading"
              @click="
                () => {
                  exportEnvironmentAsJSON()
                  hide()
                }
              "
            />
            <HoppSmartItem
              v-if="!isViewer"
              ref="deleteAction"
              :icon="IconTrash2"
              :label="`${t('action.delete')}`"
              :shortcut="['⌫']"
              :disabled="duplicateEnvironmentLoading"
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
              :disabled="duplicateEnvironmentLoading"
              @click="
                () => {
                  emit('show-environment-properties')
                  hide()
                }
              "
            />
          </div>
        </template>
      </tippy>
    </span>
    <HoppSmartConfirmModal
      :show="confirmRemove"
      :title="`${t('confirm.remove_environment')}`"
      @hide-modal="confirmRemove = false"
      @resolve="removeEnvironment"
    />
  </div>
</template>

<script setup lang="ts">
import { useToast } from "@composables/toast"
import { HoppSmartItem } from "@hoppscotch/ui"
import { useService } from "dioc/vue"
import * as TE from "fp-ts/TaskEither"
import { pipe } from "fp-ts/function"
import { ref } from "vue"
import { TippyComponent } from "vue-tippy"
import * as E from "fp-ts/Either"

import { useI18n } from "~/composables/i18n"
import { GQLError } from "~/helpers/backend/GQLClient"
import {
  deleteTeamEnvironment,
  createDuplicateEnvironment as duplicateTeamEnvironment,
} from "~/helpers/backend/mutations/TeamEnvironment"
import { getEnvActionErrorMessage } from "~/helpers/error-messages"
import { exportAsJSON } from "~/helpers/import-export/export/environment"
import { TeamEnvironment } from "~/helpers/teams/TeamEnvironment"
import { SecretEnvironmentService } from "~/services/secret-environment.service"
import IconCopy from "~icons/lucide/copy"
import IconEdit from "~icons/lucide/edit"
import IconMoreVertical from "~icons/lucide/more-vertical"
import IconSettings2 from "~icons/lucide/settings-2"
import IconTrash2 from "~icons/lucide/trash-2"

const t = useI18n()
const toast = useToast()

const props = defineProps<{
  environment: TeamEnvironment
  isViewer: boolean
}>()

const emit = defineEmits<{
  (e: "edit-environment"): void
  (e: "show-environment-properties"): void
}>()

const secretEnvironmentService = useService(SecretEnvironmentService)

const confirmRemove = ref(false)

const exportEnvironmentAsJSON = async () => {
  const message = await exportAsJSON(props.environment)
  E.isRight(message)
    ? toast.success(t(message.right))
    : toast.error(t(message.left))
}

const tippyActions = ref<TippyComponent | null>(null)
const options = ref<TippyComponent | null>(null)
const edit = ref<typeof HoppSmartItem>()
const duplicate = ref<typeof HoppSmartItem>()
const deleteAction = ref<typeof HoppSmartItem>()
const exportAsJsonEl = ref<typeof HoppSmartItem>()
const propertiesAction = ref<typeof HoppSmartItem>()

const duplicateEnvironmentLoading = ref(false)

const removeEnvironment = () => {
  pipe(
    deleteTeamEnvironment(props.environment.id),
    TE.match(
      (err: GQLError<string>) => {
        console.error(err)
        toast.error(t(getEnvActionErrorMessage(err)))
      },
      () => {
        toast.success(`${t("team_environment.deleted")}`)
        secretEnvironmentService.deleteSecretEnvironment(props.environment.id)
      }
    )
  )()
}

const duplicateEnvironment = async () => {
  duplicateEnvironmentLoading.value = true

  await pipe(
    duplicateTeamEnvironment(props.environment.id),
    TE.match(
      (err: GQLError<string>) => {
        console.error(err)
        toast.error(t(getEnvActionErrorMessage(err)))
      },
      () => {
        toast.success(`${t("environment.duplicated")}`)
      }
    )
  )()

  duplicateEnvironmentLoading.value = false

  options.value!.tippy?.hide()
}
</script>
