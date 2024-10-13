<template>
  <div class="flex items-center px-4 border-b border-dividerLight">
    <label class="truncate font-semibold text-secondaryLight">
      {{ t("authorization.oauth.grant_type") }}
    </label>

    <tippy
      placement="bottom"
      interactive
      trigger="click"
      theme="popover"
      :on-shown="() => grantTypeTippyActions?.focus()"
      class="!flex-initial"
    >
      <HoppSmartSelectWrapper>
        <HoppButtonSecondary
          class="ml-2 rounded-none pr-8"
          :label="selectedGrantType?.label"
        />
      </HoppSmartSelectWrapper>
      <template #content="{ hide }">
        <div
          ref="grantTypeTippyActions"
          class="flex flex-col focus:outline-none"
          tabindex="0"
          @keyup.escape="hide()"
        >
          <HoppSmartItem
            v-for="grantType in supportedGrantTypes"
            :key="grantType.id"
            :label="grantType.label"
            :icon="
              selectedGrantTypeID === grantType.id ? IconCircleDot : IconCircle
            "
            :active="selectedGrantTypeID === grantType.id"
            @click="
              () => {
                changeSelectedGrantType(grantType.id)

                hide()
              }
            "
          />
        </div>
      </template>
    </tippy>
  </div>

  <div class="flex flex-col">
    <div
      v-for="element in currentOAuthGrantTypeFormElements"
      :key="element.id"
      class="flex flex-1 border-b border-dividerLight"
    >
      <SmartEnvInput
        v-if="element.type === 'text'"
        v-model="element.ref.value"
        :placeholder="element.label"
        :envs="envs"
        :auto-complete-env="true"
      />
      <div
        v-else-if="element.type === 'checkbox'"
        class="px-4 py-2 flex items-center"
      >
        <span class="text-secondaryLight font-semibold mr-6">{{
          element.label
        }}</span>
        <HoppSmartCheckbox
          class="text-secondaryLight flex"
          :on="element.ref.value"
          @change="element.ref.value = !element.ref.value"
        ></HoppSmartCheckbox>
      </div>
      <div
        v-else-if="element.type === 'dropdown'"
        class="flex items-center px-4"
      >
        <label class="truncate text-secondaryLight">
          {{ element.label }}
        </label>
        <tippy
          v-if="element.ref.value"
          interactive
          trigger="click"
          theme="popover"
          class="!flex-initial"
        >
          <HoppSmartSelectWrapper>
            <HoppButtonSecondary
              class="ml-2 rounded-none pr-8"
              :label="element.ref.value.label"
            />
          </HoppSmartSelectWrapper>
          <template #content="{ hide }">
            <div
              :ref="element.tippyRefName"
              class="flex flex-col focus:outline-none"
              tabindex="0"
              @keyup.escape="hide()"
            >
              <HoppSmartItem
                v-for="item in element.options"
                :key="item.id"
                :label="item.label"
                :icon="
                  element.ref.value.id === item.id ? IconCircleDot : IconCircle
                "
                :active="element.ref.value.id === item.id"
                @click="
                  () => {
                    element.ref.value = item
                    hide()
                  }
                "
              ></HoppSmartItem>
            </div>
          </template>
        </tippy>
      </div>
    </div>

    <div class="flex items-center border-b border-dividerLight">
      <span class="flex items-center">
        <label class="ml-4 text-secondaryLight">
          {{ t("authorization.pass_key_by") }}
        </label>
        <tippy
          interactive
          trigger="click"
          theme="popover"
          :on-shown="() => authTippyActions?.focus()"
        >
          <HoppSmartSelectWrapper>
            <HoppButtonSecondary
              :label="passBy"
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
                v-for="addToTarget in addToTargets"
                :key="addToTarget.id"
                :label="addToTarget.label"
                :icon="
                  auth.addTo === addToTarget.id ? IconCircleDot : IconCircle
                "
                :active="auth.addTo === addToTarget.id"
                @click="
                  () => {
                    auth.addTo = addToTarget.id
                    hide()
                  }
                "
              />
            </div>
          </template>
        </tippy>
      </span>
    </div>

    <div class="p-2 gap-1 flex">
      <HoppButtonSecondary
        filled
        :label="`${t('authorization.generate_token')}`"
        @click="generateOAuthToken()"
      />
      <HoppButtonSecondary
        v-if="runTokenRefresh"
        filled
        :label="`${t('authorization.refresh_token')}`"
        @click="refreshOauthToken()"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { HoppGQLAuthOAuth2, HoppRESTAuthOAuth2 } from "@hoppscotch/data"
import { useService } from "dioc/vue"
import * as E from "fp-ts/Either"
import { Ref, computed, ref } from "vue"
import { z } from "zod"
import { useI18n } from "~/composables/i18n"
import { refWithCallbackOnChange } from "~/composables/ref"
import { useToast } from "~/composables/toast"
import { replaceTemplateStringsInObjectValues } from "~/helpers/auth"
import { AggregateEnvironment } from "~/newstore/environments"
import authCode, {
  AuthCodeOauthFlowParams,
  AuthCodeOauthRefreshParams,
  getDefaultAuthCodeOauthFlowParams,
} from "~/services/oauth/flows/authCode"
import clientCredentials, {
  ClientCredentialsFlowParams,
  getDefaultClientCredentialsFlowParams,
} from "~/services/oauth/flows/clientCredentials"
import implicit, {
  ImplicitOauthFlowParams,
  getDefaultImplicitOauthFlowParams,
} from "~/services/oauth/flows/implicit"
import passwordFlow, {
  PasswordFlowParams,
  getDefaultPasswordFlowParams,
} from "~/services/oauth/flows/password"
import {
  PersistedOAuthConfig,
  grantTypesInvolvingRedirect,
} from "~/services/oauth/oauth.service"
import { PersistenceService } from "~/services/persistence"
import { GQLTabService } from "~/services/tab/graphql"
import { RESTTabService } from "~/services/tab/rest"
import IconCircle from "~icons/lucide/circle"
import IconCircleDot from "~icons/lucide/circle-dot"

const t = useI18n()
const toast = useToast()

const gqlTabsService = useService(GQLTabService)
const persistenceService = useService(PersistenceService)
const restTabsService = useService(RESTTabService)

const props = defineProps<{
  modelValue: HoppRESTAuthOAuth2 | HoppGQLAuthOAuth2
  isCollectionProperty?: boolean
  envs?: AggregateEnvironment[]
  source: "REST" | "GraphQL"
}>()

const auth = ref(props.modelValue)

const addToTargets = [
  {
    id: "HEADERS" as const,
    label: "Headers",
  },
  {
    id: "QUERY_PARAMS" as const,
    label: "Query Params",
  },
]

const passBy = computed(() => {
  return (
    addToTargets.find((target) => target.id === auth.value.addTo)?.label ||
    t("state.none")
  )
})

const supportedGrantTypes = [
  {
    // used for both authCode and authCodePKCE
    id: "authCode" as const,
    label: t("authorization.oauth.label_auth_code"),
    formElements: computed(() => {
      if (!(auth.value.grantTypeInfo.grantType === "AUTHORIZATION_CODE")) {
        return
      }

      const grantType = auth.value.grantTypeInfo

      const authEndpoint = refWithCallbackOnChange(
        grantType?.authEndpoint,
        (value) => {
          auth.value.grantTypeInfo = {
            ...auth.value.grantTypeInfo,
            authEndpoint: value,
          }
        }
      )

      const tokenEndpoint = refWithCallbackOnChange(
        grantType?.tokenEndpoint,
        (value) => {
          if (!("tokenEndpoint" in auth.value.grantTypeInfo)) {
            return
          }

          auth.value.grantTypeInfo = {
            ...auth.value.grantTypeInfo,
            tokenEndpoint: value,
          }
        }
      )

      const clientID = refWithCallbackOnChange(grantType?.clientID, (value) => {
        auth.value.grantTypeInfo = {
          ...auth.value.grantTypeInfo,
          clientID: value,
        }
      })

      const clientSecret = refWithCallbackOnChange(
        grantType?.clientSecret,
        (value) => {
          if (!("clientSecret" in auth.value.grantTypeInfo)) {
            return
          }

          auth.value.grantTypeInfo = {
            ...auth.value.grantTypeInfo,
            clientSecret: value ?? "",
          }
        }
      )

      const scopes = refWithCallbackOnChange(
        grantType?.scopes ? grantType.scopes : undefined,
        (value) => {
          auth.value.grantTypeInfo = {
            ...auth.value.grantTypeInfo,
            scopes: value,
          }
        }
      )

      const isPKCE = refWithCallbackOnChange(
        auth.value.grantTypeInfo.isPKCE,
        (value) => {
          if (!("isPKCE" in auth.value.grantTypeInfo)) {
            return
          }

          auth.value.grantTypeInfo = {
            ...auth.value.grantTypeInfo,
            isPKCE: value,
          }
        }
      )

      const codeChallenge: Ref<{
        id: "plain" | "S256"
        label: string
      } | null> = refWithCallbackOnChange(
        auth.value.grantTypeInfo.codeVerifierMethod
          ? {
              id: auth.value.grantTypeInfo.codeVerifierMethod,
              label:
                auth.value.grantTypeInfo.codeVerifierMethod === "plain"
                  ? "Plain"
                  : "SHA-256",
            }
          : null,
        (value) => {
          if (!("codeVerifierMethod" in auth.value.grantTypeInfo) || !value) {
            return
          }

          auth.value.grantTypeInfo = {
            ...auth.value.grantTypeInfo,
            codeVerifierMethod: value.id,
          }
        }
      )

      const refreshToken = async () => {
        const grantTypeInfo = auth.value.grantTypeInfo

        if (!("refreshToken" in grantTypeInfo)) {
          return E.left("NO_REFRESH_TOKEN_PRESENT" as const)
        }

        const refreshToken = grantTypeInfo.refreshToken

        if (!refreshToken) {
          return E.left("NO_REFRESH_TOKEN_PRESENT" as const)
        }

        const params: AuthCodeOauthRefreshParams = {
          clientID: clientID.value,
          clientSecret: clientSecret.value,
          tokenEndpoint: tokenEndpoint.value,
          refreshToken,
        }

        const unwrappedParams = replaceTemplateStringsInObjectValues(params)

        const refreshTokenFunc = authCode.refreshToken

        if (!refreshTokenFunc) {
          return E.left("REFRESH_TOKEN_FUNCTION_NOT_DEFINED" as const)
        }

        const res = await refreshTokenFunc(unwrappedParams)

        if (E.isLeft(res)) {
          return E.left("OAUTH_REFRESH_TOKEN_FAILED" as const)
        }

        setAccessTokenInActiveContext(
          res.right.access_token,
          res.right.refresh_token
        )

        return E.right(undefined)
      }

      const runAction = async () => {
        const params: AuthCodeOauthFlowParams = {
          authEndpoint: authEndpoint.value,
          tokenEndpoint: tokenEndpoint.value,
          clientID: clientID.value,
          clientSecret: clientSecret.value,
          scopes: scopes.value,
          isPKCE: isPKCE.value,
          codeVerifierMethod: codeChallenge.value?.id,
        }

        const unwrappedParams = replaceTemplateStringsInObjectValues(params)

        const parsedArgs = authCode.params.safeParse(unwrappedParams)

        if (!parsedArgs.success) {
          return E.left("VALIDATION_FAILED" as const)
        }

        const res = await authCode.init(parsedArgs.data)

        if (E.isLeft(res)) {
          return res
        }

        return E.right(undefined)
      }

      const pkceElements = computed(() => {
        const checkbox = {
          id: "isPKCE",
          label: t("authorization.oauth.label_use_pkce"),
          type: "checkbox" as const,
          ref: isPKCE,
          onChange: (e: Event) => {
            const target = e.target as HTMLInputElement

            isPKCE.value = target.checked
          },
        }

        return isPKCE.value
          ? [
              checkbox,
              {
                id: "codeChallenge",
                label: t("authorization.oauth.label_code_challenge"),
                type: "dropdown" as const,
                ref: codeChallenge,
                tippyRefName: "pkceTippyActions",
                tippyRef: pkceTippyActions,
                options: [
                  {
                    id: "plain" as const,
                    label: "Plain",
                  },
                  {
                    id: "S256" as const,
                    label: "SHA-256",
                  },
                ],
              },
            ]
          : [checkbox]
      })

      const elements = computed(() => {
        return [
          ...pkceElements.value,
          {
            id: "authEndpoint",
            label: t("authorization.oauth.label_authorization_endpoint"),
            type: "text" as const,
            ref: authEndpoint,
          },
          {
            id: "tokenEndpoint",
            label: t("authorization.oauth.label_token_endpoint"),
            type: "text" as const,
            ref: tokenEndpoint,
          },
          {
            id: "clientId",
            label: t("authorization.oauth.label_client_id"),
            type: "text" as const,
            ref: clientID,
          },
          {
            id: "clientSecret",
            label: t("authorization.oauth.label_client_secret"),
            type: "text" as const,
            ref: clientSecret,
          },
          {
            id: "scopes",
            label: t("authorization.oauth.label_scopes"),
            type: "text" as const,
            ref: scopes,
          },
        ]
      })

      return {
        runAction,
        refreshToken,
        elements,
      }
    }),
  },
  {
    id: "clientCredentials" as const,
    label: t("authorization.oauth.label_client_credentials"),
    formElements: computed(() => {
      if (!(auth.value.grantTypeInfo.grantType === "CLIENT_CREDENTIALS")) {
        return
      }

      const grantTypeInfo = auth.value.grantTypeInfo

      const authEndpoint = refWithCallbackOnChange(
        grantTypeInfo?.authEndpoint,
        (value) => {
          auth.value.grantTypeInfo = {
            ...auth.value.grantTypeInfo,
            authEndpoint: value,
          }
        }
      )

      const clientID = refWithCallbackOnChange(
        grantTypeInfo?.clientID,
        (value) => {
          auth.value.grantTypeInfo = {
            ...auth.value.grantTypeInfo,
            clientID: value,
          }
        }
      )

      const clientSecret = refWithCallbackOnChange(
        grantTypeInfo?.clientSecret,
        (value) => {
          if (!("clientSecret" in auth.value.grantTypeInfo)) {
            return
          }

          auth.value.grantTypeInfo = {
            ...auth.value.grantTypeInfo,
            clientSecret: value,
          }
        }
      )

      const scopes = refWithCallbackOnChange(
        grantTypeInfo?.scopes ? grantTypeInfo.scopes : undefined,
        (value) => {
          auth.value.grantTypeInfo = {
            ...auth.value.grantTypeInfo,
            scopes: value,
          }
        }
      )

      const runAction = async () => {
        const values: ClientCredentialsFlowParams =
          replaceTemplateStringsInObjectValues({
            authEndpoint: authEndpoint.value,
            clientID: clientID.value,
            clientSecret: clientSecret.value,
            scopes: scopes.value,
          })

        const parsedArgs = clientCredentials.params.safeParse(values)

        if (!parsedArgs.success) {
          return E.left("VALIDATION_FAILED" as const)
        }

        const res = await clientCredentials.init(parsedArgs.data)

        if (E.isLeft(res)) {
          return E.left("OAUTH_TOKEN_FETCH_FAILED" as const)
        }

        setAccessTokenInActiveContext(res.right?.access_token)

        toast.success(t("authorization.oauth.token_fetched_successfully"))

        return E.right(undefined)
      }

      const elements = computed(() => {
        return [
          {
            id: "authEndpoint",
            label: "Authorization Endpoint",
            type: "text" as const,
            ref: authEndpoint,
          },
          {
            id: "clientId",
            label: "Client ID",
            type: "text" as const,
            ref: clientID,
          },
          {
            id: "clientSecret",
            label: "Client Secret",
            type: "text" as const,
            ref: clientSecret,
          },
          {
            id: "scopes",
            label: "Scopes",
            type: "text" as const,
            ref: scopes,
          },
        ]
      })

      return {
        runAction,
        elements,
      }
    }),
  },
  {
    id: "password" as const,
    label: "Password",
    formElements: computed(() => {
      if (!(auth.value.grantTypeInfo.grantType === "PASSWORD")) {
        return
      }

      const grantTypeInfo = auth.value.grantTypeInfo

      const authEndpoint = refWithCallbackOnChange(
        grantTypeInfo?.authEndpoint,
        (value) => {
          auth.value.grantTypeInfo = {
            ...auth.value.grantTypeInfo,
            authEndpoint: value,
          }
        }
      )

      const clientID = refWithCallbackOnChange(
        grantTypeInfo?.clientID,
        (value) => {
          auth.value.grantTypeInfo = {
            ...auth.value.grantTypeInfo,
            clientID: value,
          }
        }
      )

      const clientSecret = refWithCallbackOnChange(
        grantTypeInfo?.clientSecret,
        (value) => {
          if (!("clientSecret" in auth.value.grantTypeInfo)) {
            return
          }

          auth.value.grantTypeInfo = {
            ...auth.value.grantTypeInfo,
            clientSecret: value,
          }
        }
      )

      const scopes = refWithCallbackOnChange(
        grantTypeInfo?.scopes ? grantTypeInfo.scopes : undefined,
        (value) => {
          auth.value.grantTypeInfo.scopes = value
        }
      )

      const username = refWithCallbackOnChange(
        grantTypeInfo?.username,
        (value) => {
          if (!("username" in auth.value.grantTypeInfo)) {
            return
          }

          auth.value.grantTypeInfo = {
            ...auth.value.grantTypeInfo,
            username: value,
          }
        }
      )

      const password = refWithCallbackOnChange(
        grantTypeInfo?.password,
        (value) => {
          if (!("password" in auth.value.grantTypeInfo)) {
            return
          }

          auth.value.grantTypeInfo = {
            ...auth.value.grantTypeInfo,
            password: value,
          }
        }
      )

      const runAction = async () => {
        const values: PasswordFlowParams = replaceTemplateStringsInObjectValues(
          {
            authEndpoint: authEndpoint.value,
            clientID: clientID.value,
            clientSecret: clientSecret.value,
            scopes: scopes.value,
            username: username.value,
            password: password.value,
          }
        )

        const parsedArgs = passwordFlow.params.safeParse(values)

        if (!parsedArgs.success) {
          return E.left("VALIDATION_FAILED" as const)
        }

        const res = await passwordFlow.init(parsedArgs.data)

        if (E.isLeft(res)) {
          return E.left("OAUTH_TOKEN_FETCH_FAILED" as const)
        }

        setAccessTokenInActiveContext(res.right?.access_token)

        toast.success(t("authorization.oauth.token_fetched_successfully"))

        return E.right(undefined)
      }

      const elements = computed(() => {
        return [
          {
            id: "authEndpoint",
            label: t("authorization.oauth.label_authorization_endpoint"),
            type: "text" as const,
            ref: authEndpoint,
          },
          {
            id: "clientId",
            label: t("authorization.oauth.label_client_id"),
            type: "text" as const,
            ref: clientID,
          },
          {
            id: "clientSecret",
            label: t("authorization.oauth.label_client_secret"),
            type: "text" as const,
            ref: clientSecret,
          },
          {
            id: "username",
            label: t("authorization.oauth.label_username"),
            type: "text" as const,
            ref: username,
          },
          {
            id: "password",
            label: t("authorization.oauth.label_password"),
            type: "text" as const,
            ref: password,
          },
          {
            id: "scopes",
            label: t("authorization.oauth.label_scopes"),
            type: "text" as const,
            ref: scopes,
          },
        ]
      })

      return {
        runAction,
        elements,
      }
    }),
  },
  {
    id: "implicit" as const,
    label: t("authorization.oauth.label_implicit"),
    formElements: computed(() => {
      const grantTypeInfo = auth.value.grantTypeInfo

      const authEndpoint = refWithCallbackOnChange(
        grantTypeInfo?.authEndpoint,
        (value) => {
          auth.value.grantTypeInfo = {
            ...auth.value.grantTypeInfo,
            authEndpoint: value,
          }
        }
      )

      const clientID = refWithCallbackOnChange(
        grantTypeInfo?.clientID,
        (value) => {
          auth.value.grantTypeInfo = {
            ...auth.value.grantTypeInfo,
            clientID: value,
          }
        }
      )

      const scopes = refWithCallbackOnChange(
        grantTypeInfo?.scopes ? grantTypeInfo.scopes : undefined,
        (value) => {
          auth.value.grantTypeInfo = {
            ...auth.value.grantTypeInfo,
            scopes: value,
          }
        }
      )

      const runAction = () => {
        const values: ImplicitOauthFlowParams =
          replaceTemplateStringsInObjectValues({
            authEndpoint: authEndpoint.value,
            clientID: clientID.value,
            scopes: scopes.value,
          })

        const unwrappedValues = replaceTemplateStringsInObjectValues(values)

        const parsedArgs = implicit.params.safeParse(unwrappedValues)

        if (!parsedArgs.success) {
          return E.left("VALIDATION_FAILED" as const)
        }

        implicit.init(parsedArgs.data)

        return E.right(undefined)
      }

      const elements = computed(() => {
        return [
          {
            id: "authEndpoint",
            label: t("authorization.oauth.label_authorization_endpoint"),
            type: "text" as const,
            ref: authEndpoint,
          },
          {
            id: "clientId",
            label: t("authorization.oauth.label_client_id"),
            type: "text" as const,
            ref: clientID,
          },
          {
            id: "scopes",
            label: t("authorization.oauth.label_scopes"),
            type: "text" as const,
            ref: scopes,
          },
        ]
      })

      return {
        runAction,
        elements,
      }
    }),
  },
]

type GrantTypes = z.infer<
  typeof HoppRESTAuthOAuth2
>["grantTypeInfo"]["grantType"]

const grantTypeMap: Record<
  GrantTypes,
  (typeof supportedGrantTypes)[number]["id"]
> = {
  AUTHORIZATION_CODE: "authCode",
  CLIENT_CREDENTIALS: "clientCredentials",
  IMPLICIT: "implicit",
  PASSWORD: "password",
} as const

const grantTypeDefaultPayload = {
  AUTHORIZATION_CODE: getDefaultAuthCodeOauthFlowParams,
  CLIENT_CREDENTIALS: getDefaultClientCredentialsFlowParams,
  IMPLICIT: getDefaultImplicitOauthFlowParams,
  PASSWORD: getDefaultPasswordFlowParams,
} as const

const selectedGrantTypeID = computed(() => {
  const currentGrantType = auth.value.grantTypeInfo.grantType
  return grantTypeMap[currentGrantType]
})

const selectedGrantType = computed(() => {
  return supportedGrantTypes.find(
    (grantType) => grantType.id === selectedGrantTypeID.value
  )
})

const setAccessTokenInActiveContext = (
  accessToken?: string,
  refreshToken?: string
) => {
  if (props.isCollectionProperty && accessToken) {
    auth.value.grantTypeInfo = {
      ...auth.value.grantTypeInfo,
      token: accessToken,
    }

    // set the refresh token if provided
    // we also make sure the grantTypes supporting refreshTokens are
    if (
      refreshToken &&
      auth.value.grantTypeInfo.grantType === "AUTHORIZATION_CODE"
    ) {
      auth.value.grantTypeInfo = {
        ...auth.value.grantTypeInfo,
        refreshToken,
      }
    }

    return
  }

  const tabService = props.source === "REST" ? restTabsService : gqlTabsService

  if (
    tabService.currentActiveTab.value.document.request.auth.authType ===
      "oauth-2" &&
    accessToken
  ) {
    tabService.currentActiveTab.value.document.request.auth.grantTypeInfo.token =
      accessToken
  }

  if (
    refreshToken &&
    tabService.currentActiveTab.value.document.request.auth.authType ===
      "oauth-2"
  ) {
    // @ts-expect-error - todo: narrow the grantType to only supporting refresh tokens
    tabService.currentActiveTab.value.document.request.auth.grantTypeInfo.refreshToken =
      refreshToken
  }
}

const changeSelectedGrantType = (
  grantType: (typeof supportedGrantTypes)[number]["id"]
) => {
  const keys = Object.keys(grantTypeMap) as GrantTypes[]

  const grantTypeToSet = keys.find((key) => grantTypeMap[key] === grantType)

  if (grantTypeToSet) {
    auth.value.grantTypeInfo.grantType = grantTypeToSet

    const getDefaultPayload = grantTypeDefaultPayload[grantTypeToSet]

    // set the default payload for the grant type
    // for eg: if the grant type was auth code, and then the user selected the password grant type,
    // there wont be a password key in the payload
    // so we set the default payload, and it'll add all the keys that are missing
    if (getDefaultPayload) {
      auth.value.grantTypeInfo = {
        ...getDefaultPayload(),
        ...auth.value.grantTypeInfo,
      }
    }
  }
}

const runAction = computed(() => {
  return selectedGrantType.value?.formElements.value?.runAction
})

const runTokenRefresh = computed(() => {
  // the only grant type that supports refresh tokens is the authCode grant type
  if (selectedGrantType.value?.id === "authCode") {
    return selectedGrantType.value?.formElements.value?.refreshToken
  }

  return null
})

const currentOAuthGrantTypeFormElements = computed(() => {
  return selectedGrantType.value?.formElements.value?.elements.value
})

const refreshOauthToken = async () => {
  if (!runTokenRefresh.value) {
    return
  }

  const res = await runTokenRefresh.value()

  if (E.isLeft(res)) {
    const errorMessages = {
      NO_REFRESH_TOKEN_PRESENT: t(
        "authorization.oauth.no_refresh_token_present"
      ),
      REFRESH_TOKEN_FUNCTION_NOT_DEFINED: t(
        "authorization.oauth.refresh_token_request_failed"
      ),
      OAUTH_REFRESH_TOKEN_FAILED: t(
        "authorization.oauth.refresh_token_request_failed"
      ),
    }

    const isKnownError = res.left in errorMessages

    if (!isKnownError) {
      toast.error(t("authorization.oauth.refresh_token_failed"))
      return
    }

    toast.error(errorMessages[res.left])
    return
  }

  toast.success(t("authorization.oauth.token_refreshed_successfully"))
}

const generateOAuthToken = async () => {
  if (
    grantTypesInvolvingRedirect.includes(auth.value.grantTypeInfo.grantType)
  ) {
    const authConfig: PersistedOAuthConfig = {
      source: props.source,
      context: props.isCollectionProperty
        ? { type: "collection-properties", metadata: {} }
        : { type: "request-tab", metadata: {} },
      grant_type: auth.value.grantTypeInfo.grantType,
    }
    persistenceService.setLocalConfig(
      "oauth_temp_config",
      JSON.stringify(authConfig)
    )
  }

  const res = await runAction.value?.()

  if (res && E.isLeft(res)) {
    const errorMessages = {
      VALIDATION_FAILED: t("authorization.oauth.validation_failed"),
      OAUTH_TOKEN_FETCH_FAILED: t("authorization.oauth.token_fetch_failed"),
    }
    if (res.left in errorMessages) {
      // @ts-expect-error - not possible to have a key that doesn't exist
      toast.error(errorMessages[res.left])
      return
    }

    toast.error(t("error.something_went_wrong"))

    return
  }
}

const grantTypeTippyActions = ref<HTMLElement | null>(null)
const pkceTippyActions = ref<HTMLElement | null>(null)
const authTippyActions = ref<HTMLElement | null>(null)
</script>
