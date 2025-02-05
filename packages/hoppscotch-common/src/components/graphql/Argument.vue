<template>
  <template v-if="inline">
    <span>
      <span class="hopp-doc-explorer-argument-name"> {{ arg.name }} </span>:
      <GraphqlTypeLink :type="arg.type" />
      <GraphqlDefaultValue v-if="showDefaultValue !== false" :field="arg" />
    </span>
  </template>

  <div v-else class="hopp-doc-explorer-argument">
    <p class="inline-flex items-center mb-0 gap-2 align-bottom">
      <span
        v-if="showAddButton"
        class="hover:text-accent cursor-pointer"
        :class="{ 'text-accent': isArgumentInOperation(arg) }"
        @click="insertQuery"
      >
        <icon-lucide-plus-circle v-if="!isArgumentInOperation(arg)" />
        <icon-lucide-circle-check v-else />
      </span>
      <span class="hopp-doc-explorer-argument-name"> {{ arg.name }} </span>:
      <GraphqlTypeLink :type="arg.type" />
      <GraphqlDefaultValue v-if="showDefaultValue !== false" :field="arg" />
    </p>

    <!-- <AppMarkdown v-if="arg.description" type="description">
      {{ arg.description }}
    </AppMarkdown> -->

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
import { useQuery } from "~/helpers/graphql/query"

const { handleAddArgument, isArgumentInOperation } = useQuery()

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

  /**
   * Whether to show the add button or not
   */
  showAddButton?: boolean
}

const props = withDefaults(defineProps<ArgumentProps>(), {
  showDefaultValue: false,
  inline: false,
  showAddButton: false,
})

const insertQuery = () => {
  handleAddArgument(props.arg)
}
</script>

<style scoped lang="scss">
.hopp-doc-explorer-argument {
  @apply cursor-pointer py-1 px-2 hover:bg-primaryLight;
}
</style>
