<template>
  <div class="hopp-doc-explorer-item" @click="handleClick">
    <div class="flex">
      <div
        :class="{
          '!line-through': field.deprecationReason,
        }"
      >
        <GraphqlFieldLink
          :field="field"
          :show-add-field="showAddField"
          :is-added="isFieldInOperation(field)"
          @add-field="insertQuery"
        />
        <template v-if="args.length > 0">
          (<span>
            <template v-for="arg in args" :key="arg.name">
              <div
                v-if="args.length > 1"
                class="hopp-doc-explorer-argument-multiple"
              >
                <GraphqlArgument :arg="arg" inline />
              </div>
              <GraphqlArgument v-else :arg="arg" inline />
            </template> </span
          >)</template
        >:
        <GraphqlTypeLink :type="field.type" />
        <GraphqlDefaultValue :field="field" />
      </div>

      <span
        v-if="field.deprecationReason"
        v-tippy="{ theme: 'tooltip' }"
        class="hopp-doc-explorer-deprecated inline ml-auto text-red-500"
        :title="field.deprecationReason"
      >
        <icon-lucide-triangle-alert />
      </span>
    </div>

    <AppMarkdown
      v-if="field.description"
      type="description"
      class="hidden"
      :only-show-first-child="true"
    >
      {{ field.description }}
    </AppMarkdown>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue"
import { ExplorerFieldDef, useExplorer } from "~/helpers/graphql/explorer"
import { useQuery } from "~/helpers/graphql/query"

const props = withDefaults(
  defineProps<{
    field: ExplorerFieldDef
    showAddField: boolean
  }>(),
  {
    showAddField: true,
  }
)

const { push } = useExplorer()
const { handleAddField, isFieldInOperation } = useQuery()

const handleClick = () => {
  push({ name: props.field.name, def: props.field })
}

const insertQuery = () => {
  handleAddField(props.field)
}

const args = computed(() =>
  "args" in props.field
    ? props.field.args.filter((arg) => !arg.deprecationReason)
    : []
)
</script>

<style scoped lang="scss">
.hopp-doc-explorer-item {
  @apply cursor-pointer py-1 px-2 hover:bg-primaryLight;
}
</style>
