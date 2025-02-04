<template>
  <div class="mb-6">
    <div class="hopp-doc-explorer-section-title flex gap-2 mb-2 font-bold">
      <!-- <component :is="iconComponent" /> -->
      {{ title }}
    </div>
    <div class="hopp-doc-explorer-section-content">
      <slot></slot>
    </div>
  </div>
</template>

<script setup lang="ts">
// import IconArgument from "~icons/lucide/diamond-minus"
// import IconDeprecatedArgument from "~icons/lucide/diamond-minus"
// import IconDeprecatedEnumValue from "~icons/lucide/diamond-minus"
// import IconDeprecatedField from "~icons/lucide/diamond-minus"
// import IconDierctive from "~icons/lucide/arrow-right"
// import IconEnumValue from "~icons/lucide/arrow-right"
// import IconField from "~icons/lucide/rectangle-ellipsis"
// import IconImplements from "~icons/lucide/arrow-right"
// import IconType from "~icons/lucide/file-type"
// import IconRootTypes from "~icons/lucide/folder-kanban"

type ExplorerSectionTitle =
  | "Root Types"
  | "Fields"
  | "Deprecated Fields"
  | "Type"
  | "Arguments"
  | "Deprecated Arguments"
  | "Implements"
  | "Implementations"
  | "Possible Types"
  | "Enum Values"
  | "Deprecated Enum Values"
  | "Directives"
  | "All Schema Types"

defineProps<{
  title: ExplorerSectionTitle
}>()

// const TYPE_TO_ICON: Record<ExplorerSectionTitle, any> = {
//   Arguments: IconArgument,
//   "Deprecated Arguments": IconDeprecatedArgument,
//   "Deprecated Enum Values": IconDeprecatedEnumValue,
//   "Deprecated Fields": IconDeprecatedField,
//   Directives: IconDierctive,
//   "Enum Values": IconEnumValue,
//   Fields: IconField,
//   Implements: IconImplements,
//   Implementations: IconType,
//   "Possible Types": IconType,
//   "Root Types": IconRootTypes,
//   Type: IconType,
//   "All Schema Types": IconType,
// }

// const iconComponent = TYPE_TO_ICON[props.title]
</script>
