<template>
  <div v-if="workingConfigs" class="grid md:grid-cols-3 gap-8 md:gap-4">
    <div class="md:col-span-1">
      <h3 class="heading">{{ t('configs.auth_providers.title') }}</h3>
      <p class="my-1 text-secondaryLight">
        {{ t('configs.auth_providers.description') }}
      </p>
    </div>

    <div class="space-y-8 sm:px-8 md:col-span-2">
      <section>
        <h4 class="font-semibold text-secondaryDark">
          {{ t('configs.auth_providers.title') }}
        </h4>

        <div
          v-for="provider in workingConfigs.providers"
          class="space-y-4 py-4"
        >
          <div class="flex justify-between">
            <HoppSmartToggle
              :on="provider.enabled"
              @change="provider.enabled = !provider.enabled"
            >
              {{ capitalize(provider.name) }}
            </HoppSmartToggle>
            <HoppButtonSecondary
              v-tippy="{ theme: 'tooltip', allowHTML: true }"
              to="https://docs.hoppscotch.io/documentation/self-host/community-edition/prerequisites#oauth"
              blank
              :title="t('support.documentation')"
              :icon="IconCircleHelp"
              class="rounded hover:bg-primaryDark focus-visible:bg-primaryDark"
            />
          </div>

          <div v-if="provider.enabled" class="ml-12">
            <div
              v-for="field in providerConfigFields"
              :key="field.key"
              class="mt-5"
            >
              <template
                v-if="field.applicableProviders.includes(provider.name)"
              >
                <label>{{ field.name }}</label>
                <span class="flex max-w-lg">
                  <HoppSmartInput
                    v-model="provider.fields[field.key as keyof typeof provider['fields']]"
                    :type="
                      isMasked(provider.name, field.key) ? 'password' : 'text'
                    "
                    :autofocus="false"
                    class="!my-2 !bg-primaryLight flex-1"
                  />
                  <HoppButtonSecondary
                    :icon="
                      isMasked(provider.name, field.key) ? IconEye : IconEyeOff
                    "
                    class="bg-primaryLight h-9 mt-2"
                    @click="toggleMask(provider.name, field.key)"
                  />
                </span>
              </template>
            </div>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useVModel } from '@vueuse/core';
import { reactive } from 'vue';
import { useI18n } from '~/composables/i18n';
import { ServerConfigs, SsoAuthProviders } from '~/helpers/configs';
import IconCircleHelp from '~icons/lucide/circle-help';
import IconEye from '~icons/lucide/eye';
import IconEyeOff from '~icons/lucide/eye-off';

const t = useI18n();

const props = defineProps<{
  config: ServerConfigs;
}>();

const emit = defineEmits<{
  (e: 'update:config', v: ServerConfigs): void;
}>();

const workingConfigs = useVModel(props, 'config', emit);

// Capitalize first letter of a string
const capitalize = (text: string) =>
  text.charAt(0).toUpperCase() + text.slice(1);

// Union type for all possible field keys
type ProviderFieldKeys = keyof ProviderFields;

type ProviderFields = {
  [Field in keyof ServerConfigs['providers'][SsoAuthProviders]['fields']]: boolean;
} & Partial<{ tenant: boolean }>;

type ProviderFieldMetadata = {
  name: string;
  key: ProviderFieldKeys;
  applicableProviders: SsoAuthProviders[];
};

const providerConfigFields = <ProviderFieldMetadata[]>[
  {
    name: t('configs.auth_providers.client_id'),
    key: 'client_id',
    applicableProviders: ['google', 'github', 'microsoft'],
  },
  {
    name: t('configs.auth_providers.client_secret'),
    key: 'client_secret',
    applicableProviders: ['google', 'github', 'microsoft'],
  },
  {
    name: t('configs.auth_providers.callback_url'),
    key: 'callback_url',
    applicableProviders: ['google', 'github', 'microsoft'],
  },
  {
    name: t('configs.auth_providers.scope'),
    key: 'scope',
    applicableProviders: ['google', 'github', 'microsoft'],
  },
  {
    name: t('configs.auth_providers.tenant'),
    key: 'tenant',
    applicableProviders: ['microsoft'],
  },
  {
    name: t('configs.auth_providers.prompt'),
    key: 'prompt',
    applicableProviders: ['microsoft'],
  },
];

const maskState = reactive<Record<SsoAuthProviders, ProviderFields>>({
  google: {
    client_id: true,
    client_secret: true,
    callback_url: true,
    scope: true,
  },
  github: {
    client_id: true,
    client_secret: true,
    callback_url: true,
    scope: true,
  },
  microsoft: {
    client_id: true,
    client_secret: true,
    callback_url: true,
    scope: true,
    tenant: true,
    prompt: true,
  },
});

const toggleMask = (
  provider: SsoAuthProviders,
  fieldKey: ProviderFieldKeys
) => {
  maskState[provider][fieldKey] = !maskState[provider][fieldKey];
};

const isMasked = (provider: SsoAuthProviders, fieldKey: ProviderFieldKeys) =>
  maskState[provider][fieldKey];
</script>
