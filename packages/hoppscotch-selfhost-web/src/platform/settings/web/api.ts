import {
  runGQLQuery,
  runGQLSubscription,
  runMutation,
} from "@hoppscotch/common/helpers/backend/GQLClient"
import {
  CreateUserSettingsDocument,
  CreateUserSettingsMutation,
  CreateUserSettingsMutationVariables,
  GetUserSettingsDocument,
  GetUserSettingsQuery,
  GetUserSettingsQueryVariables,
  UpdateUserSettingsDocument,
  UpdateUserSettingsMutation,
  UpdateUserSettingsMutationVariables,
  UserSettingsUpdatedDocument,
} from "@api/generated/graphql"

export const getUserSettings = () =>
  runGQLQuery<
    GetUserSettingsQuery,
    GetUserSettingsQueryVariables,
    "user_settings/not_found"
  >({
    query: GetUserSettingsDocument,
    variables: {},
  })

export const createUserSettings = (properties: string) =>
  runMutation<
    CreateUserSettingsMutation,
    CreateUserSettingsMutationVariables,
    ""
  >(CreateUserSettingsDocument, {
    properties,
  })()

export const updateUserSettings = (properties: string) =>
  runMutation<
    UpdateUserSettingsMutation,
    UpdateUserSettingsMutationVariables,
    ""
  >(UpdateUserSettingsDocument, {
    properties,
  })()

export const runUserSettingsUpdatedSubscription = () =>
  runGQLSubscription({
    query: UserSettingsUpdatedDocument,
    variables: {},
  })
