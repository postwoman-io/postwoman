<template>
  <div
    class="group flex items-stretch"
    @contextmenu.prevent="options!.tippy?.show()"
  >
    <span
      v-if="environmentIndex === 'Global'"
      class="flex cursor-pointer items-center justify-center px-4"
      @click="emit('edit-environment')"
    >
      <icon-lucide-globe class="svg-icons" />
    </span>
    <span
      v-else
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
        {{ environment.name }}
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
            @keyup.delete="
              !(environmentIndex === 'Global')
                ? deleteAction!.$el.click()
                : null
            "
            @keyup.escape="hide()"
          >
            <HoppSmartItem
              ref="edit"
              :icon="IconEdit"
              :label="`${t('action.edit')}`"
              :shortcut="['E']"
              :disabled="duplicateGlobalEnvironmentLoading"
              @click="
                () => {
                  emit('edit-environment')
                  hide()
                }
              "
            />
            <HoppSmartItem
              ref="duplicate"
              :icon="IconCopy"
              :label="t('action.duplicate')"
              :shortcut="['D']"
              :loading="duplicateGlobalEnvironmentLoading"
              @click="
                () => {
                  duplicateEnvironments()
                  !showContextMenuLoadingState && hide()
                }
              "
            />
            <HoppSmartItem
              ref="exportAsJsonEl"
              :icon="IconEdit"
              :label="`${t('export.as_json')}`"
              :shortcut="['J']"
              :disabled="duplicateGlobalEnvironmentLoading"
              @click="
                () => {
                  exportEnvironmentAsJSON()
                  hide()
                }
              "
            />
            <HoppSmartItem
              v-if="environmentIndex !== 'Global'"
              ref="deleteAction"
              :icon="IconTrash2"
              :label="`${t('action.delete')}`"
              :shortcut="['⌫']"
              :disabled="duplicateGlobalEnvironmentLoading"
              @click="
                () => {
                  confirmRemove = true
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
import { useI18n } from "@composables/i18n"
import { useToast } from "@composables/toast"
import { Environment } from "@hoppscotch/data"
import { HoppSmartItem } from "@hoppscotch/ui"
import { useService } from "dioc/vue"
import { computed, ref, watch } from "vue"
import { TippyComponent } from "vue-tippy"
import * as E from "fp-ts/Either"

import { exportAsJSON } from "~/helpers/import-export/export/environment"
import {
  deleteEnvironment,
  duplicateEnvironment,
} from "~/newstore/environments"
import { SecretEnvironmentService } from "~/services/secret-environment.service"
import IconCopy from "~icons/lucide/copy"
import IconEdit from "~icons/lucide/edit"
import IconMoreVertical from "~icons/lucide/more-vertical"
import IconTrash2 from "~icons/lucide/trash-2"

const t = useI18n()
const toast = useToast()

const props = withDefaults(
  defineProps<{
    environment: Environment
    environmentIndex: number | "Global" | null
    duplicateGlobalEnvironmentLoading?: boolean
    showContextMenuLoadingState?: boolean
  }>(),
  {
    duplicateGlobalEnvironmentLoading: false,
    showContextMenuLoadingState: false,
  }
)

const emit = defineEmits<{
  (e: "edit-environment"): void
  (e: "duplicate-global-environment"): void
}>()

const confirmRemove = ref(false)

const secretEnvironmentService = useService(SecretEnvironmentService)

watch(
  () => props.duplicateGlobalEnvironmentLoading,
  (newDuplicateGlobalEnvironmentLoadingVal) => {
    if (!newDuplicateGlobalEnvironmentLoadingVal) {
      options?.value?.tippy?.hide()
    }
  }
)

const isGlobalEnvironment = computed(() => props.environmentIndex === "Global")

const exportEnvironmentAsJSON = async () => {
  const { environment, environmentIndex } = props

  const message = await exportAsJSON(environment, environmentIndex)
  E.isRight(message)
    ? toast.success(t(message.right))
    : toast.error(t(message.left))
}

const tippyActions = ref<HTMLDivElement | null>(null)
const options = ref<TippyComponent | null>(null)
const edit = ref<typeof HoppSmartItem>()
const duplicate = ref<typeof HoppSmartItem>()
const exportAsJsonEl = ref<typeof HoppSmartItem>()
const deleteAction = ref<typeof HoppSmartItem>()

const removeEnvironment = () => {
  if (props.environmentIndex === null) return
  if (!isGlobalEnvironment.value) {
    deleteEnvironment(props.environmentIndex as number, props.environment.id)
    secretEnvironmentService.deleteSecretEnvironment(props.environment.id)
  }
  toast.success(`${t("state.deleted")}`)
}

const duplicateEnvironments = () => {
  if (props.environmentIndex === null) {
    return
  }

  if (isGlobalEnvironment.value) {
    emit("duplicate-global-environment")
    return
  }

  duplicateEnvironment(props.environmentIndex as number)
  toast.success(`${t("environment.duplicated")}`)
}
</script>
