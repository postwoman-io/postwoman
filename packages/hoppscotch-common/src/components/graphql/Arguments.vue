<template>
  <template v-if="'args' in field">
    <GraphqlExplorerSection v-if="args.length > 0" title="Arguments">
      <GraphqlArgument v-for="arg in args" :key="arg.name" :arg="arg" />
    </GraphqlExplorerSection>

    <template v-if="deprecatedArgs.length > 0">
      <GraphqlExplorerSection
        v-if="showDeprecated || args.length === 0"
        title="Deprecated Arguments"
      >
        <GraphqlArgument
          v-for="arg in deprecatedArgs"
          :key="arg.name"
          :arg="arg"
        />
      </GraphqlExplorerSection>

      <button v-else type="button" @click="handleShowDeprecated">
        Show Deprecated Arguments
      </button>
    </template>
  </template>
</template>

<script setup lang="ts">
import { computed, ref } from "vue"
import { ExplorerFieldDef } from "~/helpers/graphql/explorer"

interface Props {
  field: ExplorerFieldDef
}

const props = defineProps<Props>()

const showDeprecated = ref(false)

const handleShowDeprecated = () => {
  showDeprecated.value = true
}

const args = computed(() =>
  props.field.args
    ? props.field.args.filter((argument) => !argument.deprecationReason)
    : []
)

const deprecatedArgs = computed(() =>
  props.field.args
    ? props.field.args.filter((argument) => argument.deprecationReason)
    : []
)
</script>
