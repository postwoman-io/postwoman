<template>
  <div class="flex items-center justify-center">
    <HoppSmartSpinner />
  </div>
</template>

<script setup lang="ts">
import { useI18n } from "~/composables/i18n"
import { useToast } from "~/composables/toast"

import { useService } from "dioc/vue"
import * as E from "fp-ts/Either"
import { onMounted } from "vue"
import { RESTTabService } from "~/services/tab/rest"

import { useRouter } from "vue-router"

import {
  PersistedOAuthConfig,
  routeOAuthRedirect,
} from "~/services/oauth/oauth.service"
import { PersistenceService } from "~/services/persistence"
import { GQLTabService } from "~/services/tab/graphql"

const t = useI18n()
const router = useRouter()

const toast = useToast()

const gqlTabs = useService(GQLTabService)
const persistenceService = useService(PersistenceService)
const restTabs = useService(RESTTabService)

function translateOAuthRedirectError(error: string) {
  switch (error) {
    case "AUTH_SERVER_RETURNED_ERROR":
      return t("authorization.oauth.redirect_auth_server_returned_error")

    case "NO_AUTH_CODE":
      return t("authorization.oauth.redirect_no_auth_code")

    case "INVALID_STATE":
      return t("authorization.oauth.redirect_invalid_state")

    case "NO_TOKEN_ENDPOINT":
      return t("authorization.oauth.redirect_no_token_endpoint")

    case "NO_CLIENT_ID":
      return t("authorization.oauth.redirect_no_client_id")

    case "NO_CLIENT_SECRET":
      return t("authorization.oauth.redirect_no_client_secret")

    case "NO_CODE_VERIFIER":
      return t("authorization.oauth.redirect_no_code_verifier")

    case "AUTH_TOKEN_REQUEST_FAILED":
      return t("authorization.oauth.redirect_auth_token_request_failed")

    case "AUTH_TOKEN_REQUEST_INVALID_RESPONSE":
      return t(
        "authorization.oauth.redirect_auth_token_request_invalid_response"
      )

    default:
      return t("authorization.oauth.something_went_wrong_on_oauth_redirect")
  }
}

onMounted(async () => {
  const localOAuthTempConfig =
    await persistenceService.getLocalConfig("oauth_temp_config")

  if (!localOAuthTempConfig) {
    toast.error(t("authorization.oauth.something_went_wrong_on_oauth_redirect"))
    router.push("/")
    return
  }

  const persistedOAuthConfig: PersistedOAuthConfig =
    JSON.parse(localOAuthTempConfig)

  const { context, source } = persistedOAuthConfig

  const tokenInfo = await routeOAuthRedirect()

  if (E.isLeft(tokenInfo)) {
    toast.error(translateOAuthRedirectError(tokenInfo.left))
    router.push(source === "REST" ? "/" : "/graphql")
    return
  }

  // Indicates the access token generation flow originated from the modal for setting authorization/headers at the collection level
  if (context?.type === "collection-properties") {
    // Set the access token in `localStorage` to retrieve from the modal while redirecting back
    const authConfig: PersistedOAuthConfig = {
      ...persistedOAuthConfig,
      token: tokenInfo.right.access_token,
    }

    if (tokenInfo.right.refresh_token) {
      authConfig.refresh_token = tokenInfo.right.refresh_token
    }

    await persistenceService.setLocalConfig(
      "oauth_temp_config",
      JSON.stringify(authConfig)
    )

    toast.success(t("authorization.oauth.token_fetched_successfully"))

    router.push(source === "REST" ? "/" : "/graphql")
    return
  }

  const routeToRedirect = source === "GraphQL" ? "/graphql" : "/"
  const tabService = source === "GraphQL" ? gqlTabs : restTabs

  if (
    tabService.currentActiveTab.value.document.request.auth.authType ===
    "oauth-2"
  ) {
    tabService.currentActiveTab.value.document.request.auth.grantTypeInfo.token =
      tokenInfo.right.access_token

    if (
      tabService.currentActiveTab.value.document.request.auth.grantTypeInfo
        .grantType === "AUTHORIZATION_CODE"
    ) {
      tabService.currentActiveTab.value.document.request.auth.grantTypeInfo.refreshToken =
        tokenInfo.right.refresh_token
    }

    toast.success(t("authorization.oauth.token_fetched_successfully"))
  }

  router.push(routeToRedirect)
})
</script>
