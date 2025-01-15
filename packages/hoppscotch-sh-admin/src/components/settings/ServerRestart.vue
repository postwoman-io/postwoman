<template>
  <HoppSmartModal
    v-if="restart"
    :dimissible="false"
    :title="t('configs.restart.title')"
  >
    <template #body>
      <div class="text-center">
        {{ t('configs.restart.description', { duration }) }}
      </div>
    </template>
  </HoppSmartModal>
</template>

<script setup lang="ts">
import { useMutation } from '@urql/vue';
import { onMounted, ref } from 'vue';
import { useI18n } from '~/composables/i18n';
import { useToast } from '~/composables/toast';
import { useConfigHandler } from '~/composables/useConfigHandler';
import {
  EnableAndDisableSsoDocument,
  ResetInfraConfigsDocument,
  ToggleAnalyticsCollectionDocument,
  ToggleSmtpDocument,
  ToggleUserHistoryStoreDocument,
  UpdateInfraConfigsDocument,
} from '~/helpers/backend/graphql';
import { ServerConfigs } from '~/helpers/configs';

const t = useI18n();
const toast = useToast();

const props = withDefaults(
  defineProps<{
    workingConfigs?: ServerConfigs;
    reset?: boolean;
  }>(),
  {
    reset: false,
  }
);

const emit = defineEmits<{
  (e: 'mutationFailure'): void;
}>();

// Mutations to update or reset server configurations and audit logs
const resetInfraConfigsMutation = useMutation(ResetInfraConfigsDocument);
const updateInfraConfigsMutation = useMutation(UpdateInfraConfigsDocument);
const updateAllowedAuthProviderMutation = useMutation(
  EnableAndDisableSsoDocument
);
const toggleDataSharingMutation = useMutation(
  ToggleAnalyticsCollectionDocument
);
const toggleSMTPMutation = useMutation(ToggleSmtpDocument);

const toggleUserHistoryStoreMutation = useMutation(
  ToggleUserHistoryStoreDocument
);

// Mutation handlers
const {
  updateInfraConfigs,
  updateAuthProvider,
  resetInfraConfigs,
  updateDataSharingConfigs,
  toggleSMTPConfigs,
  toggleUserHistoryStore,
} = useConfigHandler(props.workingConfigs);

// Call relevant mutations on component mount and initiate server restart
const duration = ref(30);
const restart = ref(false);

// Start countdown timer
const startCountdown = () => {
  const timer = setInterval(() => {
    duration.value--;
    if (duration.value === 0) {
      clearInterval(timer);
      toast.success(t('configs.restart.initiate'));
      window.location.reload();
    }
  }, 1000);
};

const triggerComponentUnMount = () => emit('mutationFailure');

// Call relevant mutations on component mount and initiate server restart
onMounted(async () => {
  if (props.reset) {
    const resetInfraConfigsResult = await resetInfraConfigs(
      resetInfraConfigsMutation
    );

    if (!resetInfraConfigsResult) {
      return triggerComponentUnMount();
    }
  } else {
    const infraResult = await updateInfraConfigs(updateInfraConfigsMutation);

    if (!infraResult) {
      return triggerComponentUnMount();
    }

    const authResult = await updateAuthProvider(
      updateAllowedAuthProviderMutation
    );

    if (!authResult) {
      return triggerComponentUnMount();
    }

    const dataSharingResult = await updateDataSharingConfigs(
      toggleDataSharingMutation
    );

    if (!dataSharingResult) {
      return triggerComponentUnMount();
    }

    const smtpResult = await toggleSMTPConfigs(toggleSMTPMutation);

    if (!smtpResult) {
      return triggerComponentUnMount();
    }

    const userHistoryStoreResult = await toggleUserHistoryStore(
      toggleUserHistoryStoreMutation
    );

    if (!userHistoryStoreResult) {
      return triggerComponentUnMount();
    }
  }

  restart.value = true;
  startCountdown();
});
</script>
