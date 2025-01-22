<template>
  <div class="flex flex-1 flex-col">
    <div
      class="sticky z-10 flex flex-shrink-0 items-center justify-between overflow-x-auto border-b border-dividerLight bg-primary pl-4"
      :class="[
        isCollectionProperty
          ? 'top-propertiesPrimaryStickyFold'
          : 'top-upperMobileSecondaryStickyFold sm:top-upperSecondaryStickyFold',
      ]"
    >
      <span class="flex items-center">
        <label class="truncate font-semibold text-secondaryLight">
          {{ t("authorization.type") }}
        </label>
        <tippy
          interactive
          trigger="click"
          theme="popover"
          :on-shown="() => tippyActions.focus()"
        >
          <HoppSmartSelectWrapper>
            <HoppButtonSecondary
              class="ml-2 rounded-none pr-8"
              :label="authName"
            />
          </HoppSmartSelectWrapper>
          <template #content="{ hide }">
            <div
              ref="tippyActions"
              class="flex flex-col focus:outline-none"
              tabindex="0"
              @keyup.escape="hide()"
            >
              <HoppSmartItem
                v-for="item in authTypes"
                :key="item.key"
                :label="item.label"
                :icon="item.key === authType ? IconCircleDot : IconCircle"
                :active="item.key === authType"
                @click="
                  () => {
                    item.handler
                      ? item.handler()
                      : (auth = { ...auth, authType: item.key } as HoppRESTAuth)
                    hide()
                  }
                "
              />
            </div>
          </template>
        </tippy>
      </span>
      <div class="flex">
        <!-- <HoppSmartCheckbox
          :on="!URLExcludes.auth"
          @change="setExclude('auth', !$event)"
        >
          {{ $t("authorization.include_in_url") }}
        </HoppSmartCheckbox>-->
        <HoppSmartCheckbox
          :on="authActive"
          class="px-2"
          @change="authActive = !authActive"
          >{{ t("state.enabled") }}</HoppSmartCheckbox
        >
        <HoppButtonSecondary
          v-tippy="{ theme: 'tooltip' }"
          to="https://docs.hoppscotch.io/documentation/features/authorization"
          blank
          :title="t('app.wiki')"
          :icon="IconHelpCircle"
        />
        <HoppButtonSecondary
          v-tippy="{ theme: 'tooltip' }"
          :title="t('action.clear')"
          :icon="IconTrash2"
          @click="clearContent"
        />
      </div>
    </div>
    <HoppSmartPlaceholder
      v-if="auth.authType === 'none'"
      :src="`/images/states/${colorMode.value}/login.svg`"
      :alt="`${t('empty.authorization')}`"
      :text="t('empty.authorization')"
    >
      <template #body>
        <HoppButtonSecondary
          outline
          :label="t('app.documentation')"
          to="https://docs.hoppscotch.io/documentation/features/authorization"
          blank
          :icon="IconExternalLink"
          reverse
        />
      </template>
    </HoppSmartPlaceholder>
    <div v-else class="flex flex-1 border-b border-dividerLight">
      <div class="w-2/3 border-r border-dividerLight">
        <div v-if="auth.authType === 'basic'">
          <HttpAuthorizationBasic v-model="auth" :envs="envs" />
        </div>
        <div v-if="auth.authType === 'inherit'" class="p-4">
          <span v-if="inheritedProperties?.auth">
            {{
              t("authorization.inherited_from", {
                auth: getAuthName(
                  inheritedProperties.auth.inheritedAuth.authType
                ),
                collection: inheritedProperties?.auth.parentName,
              })
            }}
          </span>
          <span v-else>
            {{ t("authorization.save_to_inherit") }}
          </span>
        </div>
        <div v-if="auth.authType === 'bearer'">
          <div class="flex flex-1 border-b border-dividerLight">
            <SmartEnvInput
              v-model="auth.token"
              placeholder="Token"
              :auto-complete-env="true"
              :envs="envs"
              class="px-4"
            />
          </div>
        </div>
        <div v-if="auth.authType === 'oauth-2'" class="w-full">
          <div class="flex flex-1 border-b border-dividerLight">
            <!-- Ensure a new object is assigned here to avoid reactivity issues -->
            <SmartEnvInput
              :model-value="auth.grantTypeInfo.token"
              placeholder="Token"
              :envs="envs"
              @update:model-value="
                auth.grantTypeInfo = { ...auth.grantTypeInfo, token: $event }
              "
            />
          </div>
          <HttpAuthorizationOAuth2
            v-model="auth"
            :is-collection-property="isCollectionProperty"
            :envs="envs"
            :source="source"
          />
        </div>
        <div v-if="auth.authType === 'api-key'">
          <HttpAuthorizationApiKey v-model="auth" :envs="envs" />
        </div>
        <div v-if="auth.authType === 'aws-signature'">
          <HttpAuthorizationAWSSign v-model="auth" :envs="envs" />
        </div>
        <div v-if="auth.authType === 'digest'">
          <HttpAuthorizationDigest v-model="auth" :envs="envs" />
        </div>
      </div>
      <div
        class="z-[9] sticky top-upperTertiaryStickyFold h-full min-w-[12rem] max-w-1/3 flex-shrink-0 overflow-auto overflow-x-auto bg-primary p-4"
      >
        <div class="pb-2 text-secondaryLight">
          {{ t("helpers.authorization") }}
        </div>
        <HoppSmartAnchor
          class="link"
          :label="t('authorization.learn')"
          :icon="IconExternalLink"
          to="https://docs.hoppscotch.io/documentation/features/authorization"
          blank
          reverse
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from "@composables/i18n"
import { pluckRef } from "@composables/ref"
import { useColorMode } from "@composables/theming"
import { useVModel } from "@vueuse/core"
import { computed, onMounted, ref } from "vue"
import { HoppInheritedProperty } from "~/helpers/types/HoppInheritedProperties"
import { AggregateEnvironment } from "~/newstore/environments"
import IconCircle from "~icons/lucide/circle"
import IconCircleDot from "~icons/lucide/circle-dot"
import IconExternalLink from "~icons/lucide/external-link"
import IconHelpCircle from "~icons/lucide/help-circle"
import IconTrash2 from "~icons/lucide/trash-2"

import { getDefaultAuthCodeOauthFlowParams } from "~/services/oauth/flows/authCode"
import {
  HoppRESTAuth,
  HoppRESTAuthAWSSignature,
  HoppRESTAuthDigest,
  HoppRESTAuthOAuth2,
} from "@hoppscotch/data"

const t = useI18n()

const colorMode = useColorMode()

const props = withDefaults(
  defineProps<{
    modelValue: HoppRESTAuth
    isCollectionProperty?: boolean
    isRootCollection?: boolean
    inheritedProperties?: HoppInheritedProperty
    envs?: AggregateEnvironment[]
    source?: "REST" | "GraphQL"
  }>(),
  {
    source: "REST",
    envs: undefined,
    inheritedProperties: undefined,
  }
)

const emit = defineEmits<{
  (e: "update:modelValue", value: HoppRESTAuth): void
}>()

const auth = useVModel(props, "modelValue", emit)

onMounted(() => {
  if (props.isRootCollection && auth.value.authType === "inherit") {
    auth.value = {
      authType: "none",
      authActive: true,
    }
  }
})

type AuthType = {
  key: HoppRESTAuth["authType"]
  label: string
  handler?: () => void
}

const selectAPIKeyAuthType = () => {
  auth.value = {
    ...auth.value,
    authType: "api-key",
    addTo: "HEADERS",
  } as HoppRESTAuth
}

const selectAWSSignatureAuthType = () => {
  const {
    accessKey = "",
    secretKey = "",
    region = "",
    serviceName = "",
    addTo = "HEADERS",
  } = auth.value as HoppRESTAuthAWSSignature

  auth.value = {
    ...auth.value,
    authType: "aws-signature",
    addTo,
    accessKey,
    secretKey,
    region,
    serviceName,
  }
}

const selectDigestAuthType = () => {
  const {
    username = "",
    password = "",
    algorithm = "MD5",
  } = auth.value as HoppRESTAuthDigest

  auth.value = {
    ...auth.value,
    authType: "digest",
    username,
    password,
    algorithm,
  } as HoppRESTAuth
}

const authTypes: AuthType[] = [
  {
    key: "inherit",
    label: "Inherit",
  },
  {
    key: "none",
    label: "None",
  },
  {
    key: "basic",
    label: "Basic Auth",
  },
  {
    key: "digest",
    label: "Digest Auth",
    handler: selectDigestAuthType,
  },
  {
    key: "bearer",
    label: "Bearer",
  },
  {
    key: "oauth-2",
    label: "OAuth 2.0",
    handler: selectOAuth2AuthType,
  },
  {
    key: "api-key",
    label: "API Key",
    handler: selectAPIKeyAuthType,
  },
  {
    key: "aws-signature",
    label: "AWS Signature",
    handler: selectAWSSignatureAuthType,
  },
]

const authType = pluckRef(auth, "authType")
const getAuthName = (type: HoppRESTAuth["authType"] | undefined) => {
  if (!type) return "None"
  return authTypes.find((a) => a.key === type)?.label || "None"
}
const authName = computed(() => getAuthName(authType.value))

function selectOAuth2AuthType() {
  const defaultGrantTypeInfo: HoppRESTAuthOAuth2["grantTypeInfo"] = {
    ...getDefaultAuthCodeOauthFlowParams(),
    grantType: "AUTHORIZATION_CODE",
    token: "",
  }

  // @ts-expect-error - the existing grantTypeInfo might be in the auth object, typescript doesnt know that
  const existingGrantTypeInfo = auth.value.grantTypeInfo as
    | HoppRESTAuthOAuth2["grantTypeInfo"]
    | undefined

  const grantTypeInfo = existingGrantTypeInfo
    ? existingGrantTypeInfo
    : defaultGrantTypeInfo

  auth.value = {
    ...auth.value,
    authType: "oauth-2",
    addTo: "HEADERS",
    grantTypeInfo: grantTypeInfo,
  }
}

const authActive = pluckRef(auth, "authActive")

const clearContent = () => {
  auth.value = {
    authType: "inherit",
    authActive: true,
  }
}

// Template refs
const tippyActions = ref<any | null>(null)
</script>
