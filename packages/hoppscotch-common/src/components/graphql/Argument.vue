<template>
  <template v-if="inline">
    <span>
      <span class="hopp-doc-explorer-argument-name">{{ arg.name }}</span
      >:
      <GraphqlTypeLink :type="arg.type" />
      <GraphqlDefaultValue v-if="showDefaultValue !== false" :field="arg" />
    </span>
  </template>

  <div v-else class="hopp-doc-explorer-argument">
    <span>
      <span class="hopp-doc-explorer-argument-name">{{ arg.name }}</span>
      :
      <GraphqlTypeLink :type="arg.type" />
      <GraphqlDefaultValue v-if="showDefaultValue !== false" :field="arg" />
    </span>

    <AppMarkdown v-if="arg.description" type="description">
      {{ arg.description }}
    </AppMarkdown>

    <div
      v-if="arg.deprecationReason"
      class="hopp-doc-explorer-argument-deprecation"
    >
      <div class="hopp-doc-explorer-argument-deprecation-label">Deprecated</div>

      <AppMarkdown type="deprecationReason">
        {{ arg.deprecationReason }}
      </AppMarkdown>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { GraphQLArgument } from "graphql"

interface ArgumentProps {
  /**
   * The argument that should be rendered.
   */
  arg: GraphQLArgument
  /**
   * Toggle if the default value for the argument is shown (if there is one)
   * @default false
   */
  showDefaultValue?: boolean
  /**
   * Toggle whether to render the whole argument including description and
   * deprecation reason (`false`) or to just render the argument name, type,
   * and default value in a single line (`true`).
   * @default false
   */
  inline?: boolean
}

withDefaults(defineProps<ArgumentProps>(), {
  showDefaultValue: false,
  inline: false,
})
</script>
