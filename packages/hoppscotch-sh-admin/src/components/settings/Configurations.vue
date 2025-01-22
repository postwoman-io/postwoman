<template>
  <div class="flex flex-col space-y-8 divide-y divide-divider">
    <SettingsAuthProvider v-model:config="workingConfigs" />
    <SettingsSmtpConfiguration v-model:config="workingConfigs" />
    <SettingsHistoryConfiguration v-model:config="workingConfigs" />
    <SettingsDataSharing v-model:config="workingConfigs" />
    <SettingsReset />
  </div>
</template>

<script setup lang="ts">
import { useVModel } from '@vueuse/core';
import { ServerConfigs } from '~/helpers/configs';

const props = defineProps<{
  config: ServerConfigs;
}>();

const emit = defineEmits<{
  (e: 'update:config', v: ServerConfigs): void;
}>();

const workingConfigs = useVModel(props, 'config', emit);
</script>
