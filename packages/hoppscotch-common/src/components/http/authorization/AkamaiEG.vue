<template>
  <div class="flex flex-1 border-b border-dividerLight">
    <SmartEnvInput
      v-model="auth.accessToken"
      :auto-complete-env="true"
      placeholder="Access Token"
      :envs="envs"
    />
  </div>
  <div class="flex flex-1 border-b border-dividerLight">
    <SmartEnvInput
      v-model="auth.clientToken"
      :auto-complete-env="true"
      placeholder="Client Token"
      :envs="envs"
    />
  </div>
  <div class="flex flex-1 border-b border-dividerLight">
    <SmartEnvInput
      v-model="auth.clientSecret"
      :auto-complete-env="true"
      placeholder="Client Secret"
      :envs="envs"
    />
  </div>

  <!-- advanced config -->

  <div>
    <!-- label as advanced config here -->
    <div class="p-4">
      <label class="text-secondaryLight"> Advanced Configuration </label>
      <p>
        Hoppscotch automatically assigns default values to certain fields if no
        explicit value is provided.
      </p>
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
        v-model="auth.timestamp"
        :auto-complete-env="true"
        placeholder="Timestamp"
        :envs="envs"
      />
    </div>
    <div class="flex flex-1 border-b border-dividerLight">
      <SmartEnvInput
        v-model="auth.host"
        :auto-complete-env="true"
        placeholder="Host"
        :envs="envs"
      />
    </div>
    <div class="flex flex-1 border-b border-dividerLight">
      <SmartEnvInput
        v-model="auth.headersToSign"
        :auto-complete-env="true"
        placeholder="Headers to Sign"
        :envs="envs"
      />
    </div>
    <div class="flex flex-1 border-b border-dividerLight">
      <SmartEnvInput
        v-model="auth.maxBodySize"
        :auto-complete-env="true"
        placeholder="Max Body Size"
        :envs="envs"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { HoppRESTAuthAkamaiEdgeGrid } from "@hoppscotch/data"
import { useVModel } from "@vueuse/core"
import { AggregateEnvironment } from "~/newstore/environments"

const props = defineProps<{
  modelValue: HoppRESTAuthAkamaiEdgeGrid
  envs?: AggregateEnvironment[]
}>()

const emit = defineEmits<{
  (e: "update:modelValue", value: HoppRESTAuthAkamaiEdgeGrid): void
}>()

const auth = useVModel(props, "modelValue", emit)
</script>
