<script setup lang="ts">
import { jsonLanguage } from "@codemirror/lang-json"
import { MergeView } from "@codemirror/merge"
import { onUnmounted, ref, watch } from "vue"
import { basicSetup, baseTheme } from "@helpers/editor/themes/baseTheme"
import { EditorState } from "@codemirror/state"

type MergeViewContent = {
  content: string
  langMime: string
}

const props = defineProps<{
  contentLeft: MergeViewContent
  contentRight: MergeViewContent
}>()

const diffEditor = ref<Element | null>(null)
let mergeView: MergeView | null = null

watch(
  () => props.contentRight,
  () => {
    if (!mergeView) {
      return
    }

    if (!props.contentRight.content) {
      return
    }

    mergeView.b.dispatch({
      changes: {
        from: 0,
        to: mergeView.b.state.doc.length,
        insert: props.contentRight.content,
      },
    })
  }
)

watch(
  diffEditor,
  () => {
    if (!diffEditor.value) {
      return
    }

    mergeView = new MergeView({
      a: {
        doc: props.contentLeft.content,
        extensions: [
          jsonLanguage,
          basicSetup,
          baseTheme,
          EditorState.readOnly.of(true),
        ],
      },
      b: {
        doc: props.contentRight.content,
        extensions: [jsonLanguage, baseTheme, basicSetup],
      },
      // @ts-expect-error attribute mismatch
      parent: diffEditor.value,
      highlightChanges: false,
    })
  },
  {
    immediate: true,
  }
)

onUnmounted(() => {
  if (mergeView) {
    mergeView.destroy()
  }
})
</script>

<template>
  <div ref="diffEditor"></div>
</template>
