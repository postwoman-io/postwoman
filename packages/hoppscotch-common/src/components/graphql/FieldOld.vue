<template>
  <div>
    <div class="flex justify-between gap-2 group">
      <div
        class="field-title flex-1 flex items-center gap-2"
        :class="{ 'field-highlighted': isHighlighted }"
      >
        <icon-lucide-plus-circle
          @click="emit('add-field', gqlField)"
          class="cursor-pointer hover:text-accent"
        />
        <span class="transition-all duration-300 ease-out">
          {{ fieldName }}
          <span v-if="fieldArgs.length > 0">
            (
            <span v-for="(field, index) in fieldArgs" :key="`field-${index}`">
              {{ field.name }}:
              <GraphqlTypeLink
                :gql-type="field.type"
                @jump-to-type="jumpToType"
              />
              <span v-if="index !== fieldArgs.length - 1">, </span>
            </span>
            ) </span
          >:
          <GraphqlTypeLink
            :gql-type="gqlField.type"
            @jump-to-type="jumpToType"
          />
        </span>
      </div>

      <div v-if="gqlField.deprecationReason">
        <span
          v-tippy="{ theme: 'tomato' }"
          class="flex cursor-pointer items-center gap-2 text-xs !text-red-500 hover:!text-red-600"
          :title="gqlField.deprecationReason"
        >
          <IconAlertTriangle /> {{ t("state.deprecated") }}
        </span>
      </div>
    </div>
    <div
      v-if="gqlField.description"
      class="field-desc py-2 text-secondaryLight"
    >
      {{ gqlField.description }}
    </div>
    <div v-if="fieldArgs.length > 0">
      <h5 class="my-2">Arguments:</h5>
      <div class="border-l-2 border-divider pl-4">
        <div
          v-for="(field, index) in fieldArgs"
          :key="`field-${index}`"
          class="group"
        >
          <div class="argument-title flex-1 flex items-center gap-2">
            <icon-lucide-plus-circle
              @click="emit('add-arg', field)"
              class="cursor-pointer hover:text-accent"
            />
            <span class="transition-all duration-300 ease-out">
              {{ field.name }}:
              <GraphqlTypeLink
                :gql-type="field.type"
                @jump-to-type="jumpToType"
              />
            </span>
          </div>
          <div
            v-if="field.description"
            class="field-desc py-2 text-secondaryLight"
          >
            {{ field.description }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from "@composables/i18n"
import { GraphQLType } from "graphql"
import { computed } from "vue"
import IconAlertTriangle from "~icons/lucide/alert-triangle"

const t = useI18n()

const props = withDefaults(
  defineProps<{
    gqlField: any
    isHighlighted: boolean
  }>(),
  {
    gqlField: {},
    isHighlighted: false,
  }
)

const emit = defineEmits<{
  (e: "jump-to-type", type: GraphQLType): void
  (e: "add-field", field: any): void
  (e: "add-arg", arg: any): void
}>()

const fieldName = computed(() => props.gqlField.name)

const fieldArgs = computed(() => props.gqlField.args || [])

const jumpToType = (type: GraphQLType) => {
  emit("jump-to-type", type)
}
</script>

<style lang="scss" scoped>
.field-highlighted {
  @apply border-b-2 border-accent;
}

.field-title {
  @apply select-text;
}
</style>
