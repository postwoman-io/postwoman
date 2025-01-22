<template>
  <HoppSmartModal
    dialog
    :title="t('users.invite_user')"
    @close="emit('hide-modal')"
  >
    <template #body>
      <HoppSmartInput
        v-model="email"
        :label="t('users.email_address')"
        input-styles="floating-input"
        @submit="emit('send-invite', email)"
      />
    </template>
    <template #footer>
      <div class="w-full">
        <p class="text-secondaryLight mb-5 text-center">
          {{ t('users.invite_users_description') }}
        </p>

        <div class="flex justify-between">
          <HoppButtonSecondary
            v-tippy="{ theme: 'tooltip', allowHTML: true }"
            to="https://docs.hoppscotch.io/documentation/self-host/community-edition/admin-dashboard#invite-users-to-your-hoppscotch-instance"
            blank
            :title="t('support.documentation')"
            :icon="IconCircleHelp"
            class="rounded hover:bg-primaryDark focus-visible:bg-primaryDark"
          />
          <span class="flex space-x-2">
            <HoppButtonPrimary
              :label="t('users.add_user')"
              @click="emit('send-invite', email)"
            />
            <HoppButtonSecondary
              :label="t('users.cancel')"
              outline
              filled
              @click="hideModal"
            />
          </span>
        </div>
      </div>
    </template>
  </HoppSmartModal>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useI18n } from '~/composables/i18n';
import IconCircleHelp from '~icons/lucide/circle-help';

const t = useI18n();

const emit = defineEmits<{
  (event: 'hide-modal'): void;
  (event: 'send-invite', email: string): void;
  (event: 'copy-invite-link', email: string): void;
}>();

defineProps<{
  smtpEnabled: boolean;
}>();

const email = ref('');

const hideModal = () => {
  emit('hide-modal');
};
</script>
