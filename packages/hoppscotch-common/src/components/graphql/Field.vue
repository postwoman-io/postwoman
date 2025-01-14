<template>
  <div class="hopp-doc-explorer-item">
    <div class="flex">
      <div
        :class="{
          '!line-through': field.deprecationReason,
        }"
      >
        <GraphqlFieldLink :field="field" />
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
        class="hopp-doc-explorer-deprecated inline ml-auto"
        v-tippy="{ theme: 'tooltip' }"
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
import { ExplorerFieldDef } from "~/helpers/graphql/explorer"

const props = defineProps<{
  field: ExplorerFieldDef
}>()

const args = computed(() =>
  "args" in props.field
    ? props.field.args.filter((arg) => !arg.deprecationReason)
    : []
)
</script>
