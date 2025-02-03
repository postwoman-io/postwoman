<template>
  <div class="flex flex-1 border-b border-dividerLight">
    <SmartEnvInput
      v-model="auth.authId"
      :auto-complete-env="true"
      placeholder="HAWK Auth ID"
      :envs="envs"
    />
  </div>
  <div class="flex flex-1 border-b border-dividerLight">
    <SmartEnvInput
      v-model="auth.authKey"
      :auto-complete-env="true"
      placeholder="HAWK Auth Key"
      :envs="envs"
    />
  </div>

  <div class="flex items-center border-b border-dividerLight">
    <span class="flex items-center">
      <label class="ml-4 text-secondaryLight"> Algorithm </label>
      <tippy
        interactive
        trigger="click"
        theme="popover"
        :on-shown="() => authTippyActions.focus()"
      >
        <HoppSmartSelectWrapper>
          <HoppButtonSecondary
            :label="auth.algorithm"
            class="ml-2 rounded-none pr-8"
          />
        </HoppSmartSelectWrapper>
        <template #content="{ hide }">
          <div
            ref="authTippyActions"
            class="flex flex-col focus:outline-none"
            tabindex="0"
            @keyup.escape="hide()"
          >
            <HoppSmartItem
              v-for="alg in algorithms"
              :key="alg"
              :icon="auth.algorithm === alg ? IconCircleDot : IconCircle"
              :active="auth.algorithm === alg"
              :label="alg"
              @click="
                () => {
                  auth.algorithm = alg
                  hide()
                }
              "
            />
          </div>
        </template>
      </tippy>
    </span>
  </div>

  <!-- advanced config -->

  <div class="flex flex-col divide-y divide-dividerLight">
    <!-- label as advanced config here -->
    <div class="p-4 flex flex-col space-y-1">
      <label>
        {{ t("authorization.advance_config") }}
      </label>
      <p class="text-secondaryLight">
        {{ t("authorization.advance_config_description") }}
      </p>
    </div>
    <div class="flex flex-1 border-b border-dividerLight">
      <SmartEnvInput
        v-model="auth.user"
        :auto-complete-env="true"
        :placeholder="t('authorization.username')"
        :envs="envs"
      />
    </div>
    <div class="flex flex-1 border-b border-dividerLight">
      <SmartEnvInput
        v-model="auth.nonce"
        :auto-complete-env="true"
        placeholder="Nonce"
        :envs="envs"
      />
    </div>
    <div class="flex flex-1 border-b border-dividerLight">
      <SmartEnvInput
        v-model="auth.ext"
        :auto-complete-env="true"
        placeholder="ext"
        :envs="envs"
      />
    </div>
    <div class="flex flex-1 border-b border-dividerLight">
      <SmartEnvInput
        v-model="auth.app"
        :auto-complete-env="true"
        placeholder="app"
        :envs="envs"
      />
    </div>
    <div class="flex flex-1 border-b border-dividerLight">
      <SmartEnvInput
        v-model="auth.dlg"
        :auto-complete-env="true"
        placeholder="dlg"
        :envs="envs"
      />
    </div>
    <div class="flex flex-1 border-b border-dividerLight">
      <SmartEnvInput
        v-model="auth.timestamp"
        :auto-complete-env="true"
        placeholder="Timestamp"
        :envs="envs"
      />
    </div>
  </div>

  <div class="px-4 my-6">
    <HoppSmartCheckbox
      :on="auth.includePayloadHash"
      @change="auth.includePayloadHash = !auth.includePayloadHash"
    >
      Include Payload Hash
    </HoppSmartCheckbox>
  </div>
</template>

<script setup lang="ts">
import IconCircle from "~icons/lucide/circle"
import IconCircleDot from "~icons/lucide/circle-dot"
import { useI18n } from "@composables/i18n"
import { HoppRESTAuthHAWK } from "@hoppscotch/data"
import { useVModel } from "@vueuse/core"
import { ref } from "vue"
import { AggregateEnvironment } from "~/newstore/environments"

const t = useI18n()

const props = defineProps<{
  modelValue: HoppRESTAuthHAWK
  envs?: AggregateEnvironment[]
}>()

const emit = defineEmits<{
  (e: "update:modelValue", value: HoppRESTAuthHAWK): void
}>()

const auth = useVModel(props, "modelValue", emit)

const algorithms: HoppRESTAuthHAWK["algorithm"][] = ["sha256", "sha1"]

const authTippyActions = ref<any | null>(null)
</script>
