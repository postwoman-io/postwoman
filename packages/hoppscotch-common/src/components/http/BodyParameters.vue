<template>
  <div class="flex flex-col h-full">
    <div
      class="sticky top-upperMobileStickyFold z-10 flex flex-shrink-0 items-center justify-between overflow-x-auto border-b border-dividerLight bg-primary pl-4 sm:top-upperMobileTertiaryStickyFold"
    >
      <label class="truncate font-semibold text-secondaryLight">
        {{ t("request.body") }}
      </label>
      <div class="flex">
        <div class="flex items-center gap-2">
          <HoppSmartCheckbox
            :on="body.showIndividualContentType"
            @change="
              () => {
                body.showIndividualContentType = !body.showIndividualContentType
              }
            "
            >{{ t(`request.show_content_type`) }}</HoppSmartCheckbox
          >
        </div>
        <HoppButtonSecondary
          v-tippy="{ theme: 'tooltip' }"
          to="https://docs.hoppscotch.io/documentation/getting-started/rest/uploading-data"
          blank
          :title="t('app.wiki')"
          :icon="IconHelpCircle"
        />
        <HoppButtonSecondary
          v-tippy="{ theme: 'tooltip' }"
          :title="t('action.clear_all')"
          :icon="IconTrash2"
          @click="clearContent"
        />
        <HoppButtonSecondary
          v-if="isBulkEditing"
          v-tippy="{ theme: 'tooltip' }"
          :title="t('state.linewrap')"
          :class="{ '!text-accent': wrapLines }"
          :icon="IconWrapText"
          @click.prevent="
            toggleNestedSetting('WRAP_LINES', 'multipartFormdata')
          "
        />
        <HoppButtonSecondary
          v-tippy="{ theme: 'tooltip' }"
          :title="t('state.bulk_mode')"
          :class="{ '!text-accent': isBulkEditing }"
          :icon="IconBulkEdit"
          @click="toggleBulkEdit"
        />
        <HoppButtonSecondary
          v-tippy="{ theme: 'tooltip' }"
          :title="t('add.new')"
          :icon="IconPlus"
          :disabled="isBulkEditing"
          @click="addBodyParam"
        />
      </div>
    </div>

    <draggable
      v-if="!isBulkEditing"
      v-model="workingParams"
      item-key="id"
      animation="250"
      handle=".draggable-handle"
      draggable=".draggable-content"
      ghost-class="cursor-move"
      chosen-class="bg-primaryLight"
      drag-class="cursor-grabbing"
    >
      <template #item="{ element: { entry }, index }">
        <div
          class="draggable-content group flex divide-x divide-dividerLight border-b border-dividerLight"
        >
          <span>
            <HoppButtonSecondary
              v-tippy="{
                theme: 'tooltip',
                delay: [500, 20],
                content:
                  index !== workingParams?.length - 1
                    ? t('action.drag_to_reorder')
                    : null,
              }"
              :icon="IconGripVertical"
              class="opacity-0"
              :class="{
                'draggable-handle cursor-grab group-hover:opacity-100':
                  index !== workingParams?.length - 1,
              }"
              tabindex="-1"
            />
          </span>
          <SmartEnvInput
            v-model="entry.key"
            :placeholder="`${t('count.parameter', { count: index + 1 })}`"
            :auto-complete-env="true"
            :envs="envs"
            @change="
              updateBodyParam(index, {
                key: $event,
                value: entry.value,
                active: entry.active,
                isFile: entry.isFile,
                contentType: entry.contentType,
              })
            "
          />
          <div v-if="entry.isFile" class="file-chips-container">
            <div class="file-chips-wrapper space-x-1">
              <HoppSmartFileChip
                v-for="(file, fileIndex) in entry.value"
                :key="`param-${index}-file-${fileIndex}`"
                >{{ file.name }}</HoppSmartFileChip
              >
            </div>
          </div>
          <span v-else class="flex flex-1">
            <SmartEnvInput
              v-model="entry.value"
              :placeholder="`${t('count.value', { count: index + 1 })}`"
              :auto-complete-env="true"
              :envs="envs"
              @change="
                updateBodyParam(index, {
                  key: entry.key,
                  value: $event,
                  active: entry.active,
                  isFile: entry.isFile,
                  contentType: entry.contentType,
                })
              "
            />
          </span>
          <span v-if="body.showIndividualContentType" class="flex flex-1">
            <SmartEnvInput
              v-model="entry.contentType"
              :placeholder="
                entry.contentType ? entry.contentType : `Auto (Content Type)`
              "
              :auto-complete-env="true"
              :auto-complete-source="autoCompleteContenTypes"
              :envs="envs"
              @change="
                updateBodyParam(index, {
                  key: entry.key,
                  value: entry.value,
                  active: entry.active,
                  isFile: entry.isFile,
                  contentType: $event,
                })
              "
            />
          </span>
          <span>
            <label :for="`attachment${index}`" class="p-0">
              <input
                :id="`attachment${index}`"
                :name="`attachment${index}`"
                type="file"
                multiple
                class="cursor-pointer p-1 text-tiny text-secondaryLight transition file:mr-2 file:cursor-pointer file:rounded file:border-0 file:bg-primaryLight file:px-4 file:py-1 file:text-tiny file:text-secondary file:transition hover:text-secondaryDark hover:file:bg-primaryDark hover:file:text-secondaryDark"
                @change="setRequestAttachment(index, entry, $event)"
              />
            </label>
          </span>
          <span>
            <HoppButtonSecondary
              v-tippy="{ theme: 'tooltip' }"
              :title="
                entry.hasOwnProperty('active')
                  ? entry.active
                    ? t('action.turn_off')
                    : t('action.turn_on')
                  : t('action.turn_off')
              "
              :icon="
                entry.hasOwnProperty('active')
                  ? entry.active
                    ? IconCheckCircle
                    : IconCircle
                  : IconCheckCircle
              "
              color="green"
              @click="
                updateBodyParam(index, {
                  key: entry.key,
                  value: entry.value,
                  active: entry.hasOwnProperty('active')
                    ? !entry.active
                    : false,
                  isFile: entry.isFile,
                  contentType: entry.contentType,
                })
              "
            />
          </span>
          <span>
            <HoppButtonSecondary
              v-tippy="{ theme: 'tooltip' }"
              :title="t('action.remove')"
              :icon="IconTrash"
              color="red"
              @click="deleteBodyParam(index)"
            />
          </span>
        </div>
      </template>
    </draggable>

    <div v-else-if="isBulkEditing" class="h-full relative flex flex-col flex-1">
      <div ref="bulkEditor" class="absolute inset-0"></div>
    </div>

    <HoppSmartPlaceholder
      v-if="workingParams.length === 0 && !isBulkEditing"
      :src="`/images/states/${colorMode.value}/upload_single_file.svg`"
      :alt="`${t('empty.body')}`"
      :text="t('empty.body')"
    >
      <template #body>
        <HoppButtonSecondary
          :label="`${t('add.new')}`"
          filled
          :icon="IconPlus"
          @click="addBodyParam"
        />
      </template>
    </HoppSmartPlaceholder>
  </div>
</template>

<script setup lang="ts">
import IconHelpCircle from "~icons/lucide/help-circle"
import IconTrash2 from "~icons/lucide/trash-2"
import IconPlus from "~icons/lucide/plus"
import IconGripVertical from "~icons/lucide/grip-vertical"
import IconCheckCircle from "~icons/lucide/check-circle"
import IconCircle from "~icons/lucide/circle"
import IconTrash from "~icons/lucide/trash"
import IconBulkEdit from "~icons/lucide/edit"
import IconWrapText from "~icons/lucide/wrap-text"
import { reactive, ref, watch } from "vue"
import { flow, pipe } from "fp-ts/function"
import * as O from "fp-ts/Option"
import * as A from "fp-ts/Array"
import {
  FormDataKeyValue,
  HoppRESTReqBody,
  parseRawKeyValueEntriesE,
} from "@hoppscotch/data"
import { isEqual, clone } from "lodash-es"
import draggable from "vuedraggable-es"
import { pluckRef } from "@composables/ref"
import { useI18n } from "@composables/i18n"
import { useToast } from "@composables/toast"
import { useColorMode } from "@composables/theming"
import { useVModel } from "@vueuse/core"
import { AggregateEnvironment } from "~/newstore/environments"
import { useCodemirror } from "~/composables/codemirror"
import { useNestedSetting } from "~/composables/settings"
import { toggleNestedSetting } from "~/newstore/settings"
import * as E from "fp-ts/Either"
import linter from "~/helpers/editor/linting/rawKeyValue"

type Body = HoppRESTReqBody & { contentType: "multipart/form-data" }

const props = defineProps<{
  modelValue: Body
  envs: AggregateEnvironment[]
}>()

const emit = defineEmits<{
  (e: "update:modelValue", val: Body): void
}>()

const body = useVModel(props, "modelValue", emit)

type WorkingFormDataKeyValue = { id: number; entry: FormDataKeyValue }

const colorMode = useColorMode()
const t = useI18n()

const toast = useToast()

const idTicker = ref(0)

const deletionToast = ref<{ goAway: (delay: number) => void } | null>(null)

const bodyParams = pluckRef(body, "body")

const autoCompleteContenTypes = [
  "application/atom+xml",
  "application/ecmascript",
  "application/json",
  "application/vnd.api+json",
  "application/javascript",
  "application/octet-stream",
  "application/ogg",
  "application/pdf",
  "application/postscript",
  "application/rdf+xml",
  "application/rss+xml",
  "application/soap+xml",
  "application/font-woff",
  "application/x-yaml",
  "application/xhtml+xml",
  "application/xml",
  "application/xml-dtd",
  "application/xop+xml",
  "application/zip",
  "application/gzip",
  "application/graphql",
  "application/x-www-form-urlencoded",
  "audio/basic",
  "audio/L24",
  "audio/mp4",
  "audio/mpeg",
  "audio/ogg",
  "audio/vorbis",
  "audio/vnd.rn-realaudio",
  "audio/vnd.wave",
  "audio/webm",
  "image/gif",
  "image/jpeg",
  "image/pjpeg",
  "image/png",
  "image/svg+xml",
  "image/tiff",
  "message/http",
  "message/imdn+xml",
  "message/partial",
  "message/rfc822",
  "multipart/mixed",
  "multipart/alternative",
  "multipart/related",
  "multipart/form-data",
  "multipart/signed",
  "multipart/encrypted",
  "text/cmd",
  "text/css",
  "text/csv",
  "text/html",
  "text/plain",
  "text/vcard",
  "text/xml",
]

// The UI representation of the parameters list (has the empty end param)
const workingParams = ref<WorkingFormDataKeyValue[]>([
  {
    id: idTicker.value++,
    entry: {
      key: "",
      value: "",
      active: true,
      isFile: false,
      contentType: undefined,
    },
  },
])

// Rule: Working Params always have last element is always an empty param
watch(workingParams, (paramsList) => {
  if (
    paramsList.length > 0 &&
    paramsList[paramsList.length - 1].entry.key !== ""
  ) {
    workingParams.value.push({
      id: idTicker.value++,
      entry: {
        key: "",
        value: "",
        active: true,
        isFile: false,
      },
    })
  }
})

// Sync logic between params and working params
watch(
  bodyParams,
  (newParamsList) => {
    if (!Array.isArray(newParamsList)) return

    // Sync should overwrite working params
    const filteredWorkingParams = pipe(
      workingParams.value,
      A.filterMap(
        flow(
          O.fromPredicate((e) => e.entry.key !== "" || e.entry.isFile),
          O.map((e) => e.entry)
        )
      )
    )

    if (!isEqual(newParamsList, filteredWorkingParams)) {
      workingParams.value = pipe(
        newParamsList,
        A.map((x) => ({ id: idTicker.value++, entry: x }))
      )
    }
  },
  { immediate: true }
)

watch(workingParams, (newWorkingParams) => {
  const fixedParams = pipe(
    newWorkingParams,
    A.filterMap(
      flow(
        O.fromPredicate((e) => e.entry.key !== "" || e.entry.isFile),
        O.map((e) => e.entry)
      )
    )
  )

  if (!isEqual(bodyParams.value, fixedParams)) {
    bodyParams.value = fixedParams
  }
})

const addBodyParam = () => {
  workingParams.value.push({
    id: idTicker.value++,
    entry: {
      key: "",
      value: "",
      active: true,
      isFile: false,
    },
  })
}

const updateBodyParam = (index: number, entry: FormDataKeyValue) => {
  workingParams.value = workingParams.value.map((h, i) =>
    i === index ? { id: h.id, entry } : h
  )
}

const deleteBodyParam = (index: number) => {
  const paramsBeforeDeletion = clone(workingParams.value)

  if (
    !(
      paramsBeforeDeletion.length > 0 &&
      index === paramsBeforeDeletion.length - 1
    )
  ) {
    if (deletionToast.value) {
      deletionToast.value.goAway(0)
      deletionToast.value = null
    }

    deletionToast.value = toast.success(`${t("state.deleted")}`, {
      action: [
        {
          text: `${t("action.undo")}`,
          onClick: (_, toastObject) => {
            workingParams.value = paramsBeforeDeletion
            toastObject.goAway(0)
            deletionToast.value = null
          },
        },
      ],

      onComplete: () => {
        deletionToast.value = null
      },
    })
  }

  workingParams.value = workingParams.value.filter(
    (_, arrIndex) => arrIndex !== index
  )
}

const convertWorkingParamsToBulkEditContent = (
  params: WorkingFormDataKeyValue[]
) => {
  return (
    params
      .filter((param) => param.entry.key !== "")
      // filter out file params
      .filter((param) => !param.entry.isFile)
      .map(
        (param) =>
          `${!param.entry.active ? "#" : ""}${param.entry.key}: ${param.entry.value}`
      )
      .join("\n")
  )
}

const bulkEditor = ref<HTMLElement | null>(null)
const bulkEditContent = ref<string | undefined>(
  convertWorkingParamsToBulkEditContent(
    Array.isArray(bodyParams.value)
      ? bodyParams.value.map((entry) => ({ id: idTicker.value++, entry }))
      : []
  )
)
const isBulkEditing = ref(body.value.isBulkEditing)
const wrapLines = useNestedSetting("WRAP_LINES", "multipartFormdata")

watch(isBulkEditing, () => {
  body.value.isBulkEditing = isBulkEditing.value
})

// update working params when bulk edit content changes
watch(bulkEditContent, () => {
  if (isBulkEditing.value && bulkEditContent.value !== undefined) {
    const res = parseRawKeyValueEntriesE(bulkEditContent.value)

    if (E.isLeft(res)) {
      return
    }

    workingParams.value = [
      ...res.right.map((entry) => ({
        id: idTicker.value++,
        entry: {
          key: entry.key,
          value: entry.value,
          active: entry.active,
          isFile: false as const,
        },
      })),
      // file params are not supported in bulk edit, so we need to add them back
      ...workingParams.value.filter((param) => param.entry.isFile),
    ]
  }
})

const toggleBulkEdit = () => {
  isBulkEditing.value = !isBulkEditing.value

  if (isBulkEditing.value) {
    bulkEditContent.value = convertWorkingParamsToBulkEditContent(
      workingParams.value
    )
  } else {
    bulkEditContent.value = undefined
  }
}

useCodemirror(
  bulkEditor,
  bulkEditContent,
  reactive({
    extendedEditorConfig: {
      mode: "text/x-yaml",
      placeholder: t("state.bulk_mode_placeholder").toString(),
      lineWrapping: wrapLines,
    },
    linter,
    completer: null,
    environmentHighlights: true,
    predefinedVariablesHighlights: true,
  })
)

const clearContent = () => {
  // set params list to the initial state
  workingParams.value = [
    {
      id: idTicker.value++,
      entry: {
        key: "",
        value: "",
        active: true,
        isFile: false,
      },
    },
  ]

  // clear bulk edit content
  bulkEditContent.value = ""
  isBulkEditing.value = false
}

const setRequestAttachment = (
  index: number,
  entry: FormDataKeyValue,
  event: InputEvent | Event
) => {
  // check if file exists or not
  if ((event.target as HTMLInputElement).files?.length === 0) {
    updateBodyParam(index, {
      ...entry,
      isFile: false,
      value: "",
    })
    return
  }

  const fileEntry: FormDataKeyValue = {
    ...entry,
    isFile: true,
    value: Array.from((event.target as HTMLInputElement).files!),
  }
  updateBodyParam(index, fileEntry)
}
</script>

<style lang="scss" scoped>
.file-chips-container {
  @apply flex flex-1;
  @apply whitespace-nowrap;
  @apply overflow-auto;
  @apply bg-transparent;

  .file-chips-wrapper {
    @apply flex;
    @apply p-1;
    @apply w-0;
  }
}
</style>
