<template>
  <div v-if="smtpConfigs" class="grid md:grid-cols-3 gap-4 md:gap-4 pt-8">
    <div class="md:col-span-1">
      <h3 class="heading">{{ t('configs.mail_configs.title') }}</h3>
      <p class="my-1 text-secondaryLight">
        {{ t('configs.mail_configs.description') }}
      </p>
    </div>

    <div class="space-y-8 sm:px-8 md:col-span-2">
      <section>
        <h4 class="font-semibold text-secondaryDark">
          {{ t('configs.mail_configs.title') }}
        </h4>

        <div class="space-y-4 py-4">
          <div class="flex items-center">
            <div class="flex justify-between w-full">
              <HoppSmartToggle
                :on="smtpConfigs.enabled"
                @change="smtpConfigs.enabled = !smtpConfigs.enabled"
              >
                {{ t('configs.mail_configs.enable_smtp') }}
              </HoppSmartToggle>
              <HoppButtonSecondary
                blank
                v-tippy="{ theme: 'tooltip', allowHTML: true }"
                to="https://docs.hoppscotch.io/documentation/self-host/community-edition/prerequisites#email-delivery"
                :title="t('support.documentation')"
                :icon="IconHelpCircle"
                class="rounded hover:bg-primaryDark focus-visible:bg-primaryDark"
              />
            </div>
          </div>

          <div v-if="smtpConfigs.enabled" class="ml-12">
            <div class="flex flex-col items-start gap-5">
              <HoppSmartCheckbox
                :on="smtpConfigs.fields.email_auth"
                @change="
                  smtpConfigs.fields.email_auth = !smtpConfigs.fields.email_auth
                "
              >
                {{ t('configs.mail_configs.enable_email_auth') }}
              </HoppSmartCheckbox>

              <HoppSmartCheckbox
                :on="smtpConfigs.fields.mailer_use_custom_configs"
                :title="t('configs.mail_configs.custom_smtp_configs')"
                @change="
                  smtpConfigs.fields.mailer_use_custom_configs =
                    !smtpConfigs.fields.mailer_use_custom_configs
                "
              >
                {{ t('configs.mail_configs.custom_smtp_configs') }}
              </HoppSmartCheckbox>
            </div>
            <div
              v-for="field in smtpConfigFields"
              :key="field.key"
              class="mt-5 ml-12"
            >
              <div v-if="fieldCondition(field)">
                <div
                  v-if="isCheckboxField(field)"
                  class="flex flex-col items-start gap-5"
                >
                  <HoppSmartCheckbox
                    :on="Boolean(smtpConfigs.fields[field.key])"
                    @change="toggleCheckbox(field)"
                  >
                    {{ field.name }}
                  </HoppSmartCheckbox>
                </div>
                <span v-else>
                  <label>{{ field.name }}</label>
                  <span class="flex max-w-lg">
                    <HoppSmartInput
                      v-model="smtpConfigs.fields[field.key]"
                      :type="isMasked(field.key) ? 'password' : 'text'"
                      :autofocus="false"
                      class="!my-2 !bg-primaryLight flex-1"
                    />
                    <HoppButtonSecondary
                      :icon="isMasked(field.key) ? IconEye : IconEyeOff"
                      class="bg-primaryLight h-9 mt-2"
                      @click="toggleMask(field.key)"
                    />
                  </span>
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useVModel } from '@vueuse/core';
import { computed, reactive } from 'vue';
import { useI18n } from '~/composables/i18n';
import { ServerConfigs } from '~/helpers/configs';
import IconEye from '~icons/lucide/eye';
import IconEyeOff from '~icons/lucide/eye-off';
import IconHelpCircle from '~icons/lucide/help-circle';

const t = useI18n();

const props = defineProps<{
  config: ServerConfigs;
}>();

const emit = defineEmits<{
  (e: 'update:config', v: ServerConfigs): void;
}>();

const workingConfigs = useVModel(props, 'config', emit);

// Get or set smtpConfigs from workingConfigs
const smtpConfigs = computed({
  get() {
    return workingConfigs.value?.mailConfigs;
  },
  set(value) {
    workingConfigs.value.mailConfigs = value;
  },
});

// Mask sensitive fields
type Field = {
  name: string;
  key: keyof ServerConfigs['mailConfigs']['fields'];
};

const smtpConfigFields = reactive<Field[]>([
  {
    name: t('configs.mail_configs.smtp_url'),
    key: 'mailer_smtp_url',
  },
  {
    name: t('configs.mail_configs.address_from'),
    key: 'mailer_from_address',
  },
  {
    name: t('configs.mail_configs.host'),
    key: 'mailer_smtp_host',
  },
  {
    name: t('configs.mail_configs.port'),
    key: 'mailer_smtp_port',
  },
  {
    name: t('configs.mail_configs.user'),
    key: 'mailer_smtp_user',
  },
  {
    name: t('configs.mail_configs.password'),
    key: 'mailer_smtp_password',
  },
  {
    name: t('configs.mail_configs.secure'),
    key: 'mailer_smtp_secure',
  },
  {
    name: t('configs.mail_configs.tls_reject_unauthorized'),
    key: 'mailer_tls_reject_unauthorized',
  },
]);

const maskState = reactive<Record<string, boolean>>({
  mailer_smtp_url: true,
  mailer_from_address: true,
  mailer_smtp_host: true,
  mailer_smtp_port: true,
  mailer_smtp_user: true,
  mailer_smtp_password: true,
});

const toggleMask = (fieldKey: keyof ServerConfigs['mailConfigs']['fields']) => {
  maskState[fieldKey] = !maskState[fieldKey];
};

const isMasked = (fieldKey: keyof ServerConfigs['mailConfigs']['fields']) =>
  maskState[fieldKey];

const fieldCondition = (field: Field) => {
  const advancedFields = [
    'mailer_smtp_host',
    'mailer_smtp_port',
    'mailer_smtp_user',
    'mailer_smtp_password',
    'mailer_smtp_secure',
    'mailer_tls_reject_unauthorized',
  ];
  const basicFields = ['mailer_smtp_url'];

  if (field.key === 'mailer_from_address') {
    return true;
  }

  if (smtpConfigs.value.fields.mailer_use_custom_configs) {
    return (
      !basicFields.includes(field.key) && advancedFields.includes(field.key)
    );
  } else return basicFields.includes(field.key);
};

const isCheckboxField = (field: Field) => {
  const checkboxKeys = ['mailer_smtp_secure', 'mailer_tls_reject_unauthorized'];
  return checkboxKeys.includes(field.key);
};

const toggleCheckbox = (field: Field) =>
  ((smtpConfigs.value.fields[field.key] as boolean) =
    !smtpConfigs.value.fields[field.key]);
</script>
