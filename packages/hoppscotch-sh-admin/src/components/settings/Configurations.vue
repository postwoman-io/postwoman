<template>
  <div class="flex flex-col space-y-8 divide-y divide-divider">
    <SettingsAuthProvider v-model:config="workingConfigs" />
    <SettingsSmtpConfiguration v-model:config="workingConfigs" />
    <SettingsDataSharing v-model:config="workingConfigs" />
    <div
      v-for="(component, index) in plugins.ui.additionalConfigurationsItems"
      :key="index"
    >
      <component :is="component" v-model:config="workingConfigs" />
    </div>
    <SettingsReset />
  </div>
</template>

<script setup lang="ts">
import { useVModel } from '@vueuse/core';
import { ServerConfigs } from '~/helpers/configs';
import { plugins } from '~/plugins';

const props = defineProps<{
  config: ServerConfigs;
}>();

const emit = defineEmits<{
  (e: 'update:config', v: ServerConfigs): void;
}>();

const workingConfigs = useVModel(props, 'config', emit);
</script>
