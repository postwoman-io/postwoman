<script lang="ts" setup>
import { useVModel } from '@vueuse/core';
import { computed, ref } from 'vue';
import { useI18n } from '~/composables/i18n';
import { ServerConfigs } from '~/helpers/configs';
import { RevokeAllUserHistoryByAdminDocument } from '~/helpers/backend/graphql';
import { useMutation } from '@urql/vue';
import { useToast } from '~/composables/toast';

const props = defineProps<{
  config: ServerConfigs;
}>();

const emit = defineEmits<{
  (e: 'update:config', v: ServerConfigs): void;
}>();

const workingConfigs = useVModel(props, 'config', emit);

const t = useI18n();
const toast = useToast();

// Get or set smtpConfigs from workingConfigs
const historyConfig = computed({
  get() {
    return workingConfigs.value?.historyConfig;
  },
  set(value) {
    workingConfigs.value.historyConfig = value;
  },
});

const showConfirmHistoryClearModal = ref(false);

// had to add this here, because useConfigHandler is too coupled with the settings page
const { fetching: isRevoking, executeMutation: revokeAllUserHistoryByAdmin } =
  useMutation(RevokeAllUserHistoryByAdminDocument);

const clearAllHistory = async () => {
  const res = await revokeAllUserHistoryByAdmin({});

  if (res.error) {
    toast.error(t('configs.history_configs.clear_failure'));
  }

  if (res.data) {
    toast.success(t('configs.history_configs.clear_success'));
  }

  return res;
};
</script>

<template>
  <div class="grid md:grid-cols-3 gap-4 md:gap-4 pt-8">
    <div class="md:col-span-1">
      <h3 class="heading">{{ t('configs.history_configs.title') }}</h3>
      <p class="my-1 text-secondaryLight">
        {{ t('configs.history_configs.description') }}
      </p>
    </div>

    <div class="space-y-8 sm:px-8 md:col-span-2">
      <section>
        <h4 class="font-semibold text-secondaryDark">
          {{ t('configs.history_configs.title') }}
        </h4>

        <div class="space-y-4 py-4">
          <div class="flex items-center">
            <div class="flex justify-between w-full">
              <HoppSmartToggle
                :on="historyConfig.enabled"
                @change="historyConfig.enabled = !historyConfig.enabled"
              >
                {{ t('configs.history_configs.enable_history') }}
              </HoppSmartToggle>
            </div>
          </div>
        </div>

        <HoppButtonSecondary
          :label="t('configs.history_configs.clear_history')"
          @click="showConfirmHistoryClearModal = true"
          outline
          class="my-2"
        />
      </section>
    </div>
  </div>

  <HoppSmartConfirmModal
    :show="showConfirmHistoryClearModal"
    :loading-state="isRevoking"
    :title="t('configs.history_configs.clear_confirm')"
    @hide-modal="showConfirmHistoryClearModal = false"
    @resolve="
      async () => {
        await clearAllHistory();
        showConfirmHistoryClearModal = false;
      }
    "
  />
</template>
