<template>
  <div :class="classes" v-html="renderedMarkdown"></div>
</template>

<script setup lang="ts">
import { computed, defineProps, useSlots } from "vue"
import MarkdownIt from "markdown-it"

const markdown = new MarkdownIt({
  breaks: true,
  linkify: true,
})

interface Props {
  onlyShowFirstChild?: boolean
  type: "description" | "deprecation"
}

const props = defineProps<Props>()
const slots: { default?: () => any[] } = useSlots()

const classes = computed(() => {
  let classList = `hopp-markdown-${props.type}`

  if (props.onlyShowFirstChild) {
    classList += " hopp-markdown-preview"
  }

  return classList
})

const renderedMarkdown = computed(() =>
  markdown.render(slots.default ? slots.default()[0].children : "")
)
</script>
