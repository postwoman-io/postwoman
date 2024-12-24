<template>
  <div class="flex flex-col">
    <h1 class="text-lg font-bold text-secondaryDark">
      {{ t('settings.settings') }}
    </h1>
  </div>

  <div
    v-if="fetchingInfraConfigs || fetchingAllowedAuthProviders"
    class="flex justify-center"
  >
    <HoppSmartSpinner />
  </div>

  <div v-else-if="infraConfigsError || allowedAuthProvidersError">
    {{ t('configs.load_error') }}
  </div>

  <div v-else-if="workingConfigs" class="flex flex-col py-8">
    <HoppSmartTabs v-model="selectedOptionTab" render-inactive-tabs>
      <HoppSmartTab :id="'config'" :label="t('configs.title')">
        <SettingsConfigurations
          v-model:config="workingConfigs"
          class="py-8 px-4"
        />
      </HoppSmartTab>
      <HoppSmartTab :id="'token'" :label="t('infra_tokens.tab_title')">
        <Tokens />
      </HoppSmartTab>
    </HoppSmartTabs>
  </div>

  <div v-if="isConfigUpdated" class="fixed bottom-0 right-0 m-10">
    <HoppButtonPrimary
      :label="t('configs.save_changes')"
      @click="triggerSaveChangesModal()"
    />
  </div>

  <SettingsServerRestart
    v-if="initiateServerRestart"
    :workingConfigs="workingConfigs"
    @mutation-failure="initiateServerRestart = false"
  />

  <HoppSmartConfirmModal
    :show="showSaveChangesModal"
    :title="t('configs.confirm_changes')"
    @hide-modal="showSaveChangesModal = false"
    @resolve="restartServer"
  />
</template>

<script setup lang="ts">
import { isEqual } from 'lodash-es';
import { computed, ref } from 'vue';
import { useI18n } from '~/composables/i18n';
import { useToast } from '~/composables/toast';
import {
  hasInputValidationFailed,
  useConfigHandler,
} from '~/composables/useConfigHandler';

const t = useI18n();
const toast = useToast();

const showSaveChangesModal = ref(false);
const initiateServerRestart = ref(false);

// Tabs
type OptionTabs = 'config' | 'token';
const selectedOptionTab = ref<OptionTabs>('config');

// Obtain the current and working configs from the useConfigHandler composable
const {
  currentConfigs,
  workingConfigs,
  fetchingInfraConfigs,
  infraConfigsError,
  fetchingAllowedAuthProviders,
  allowedAuthProvidersError,
  AreAnyConfigFieldsEmpty,
} = useConfigHandler();

// Check if the configs have been updated
const isConfigUpdated = computed(() =>
  currentConfigs.value && workingConfigs.value
    ? !isEqual(currentConfigs.value, workingConfigs.value)
    : false
);

// Check if any of the fields in workingConfigs are empty
const areAnyFieldsEmpty = computed(() =>
  workingConfigs.value ? AreAnyConfigFieldsEmpty(workingConfigs.value) : false
);

const triggerSaveChangesModal = () => {
  if (areAnyFieldsEmpty.value) {
    return toast.error(t('configs.input_empty'));
  }

  if (hasInputValidationFailed.value) {
    return toast.error(
      'You have wrong input. Correct input errors and try again'
    );
  }
  showSaveChangesModal.value = true;
};

const restartServer = () => {
  if (areAnyFieldsEmpty.value) {
    return toast.error(t('configs.input_empty'));
  }
  initiateServerRestart.value = true;
  showSaveChangesModal.value = false;
};
</script>
