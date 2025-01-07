import {
  runMutation,
  runGQLQuery,
  runGQLSubscription,
} from "@hoppscotch/common/helpers/backend/GQLClient"

import {
  CreateUserHistoryDocument,
  CreateUserHistoryMutation,
  CreateUserHistoryMutationVariables,
  DeleteAllUserHistoryDocument,
  DeleteAllUserHistoryMutation,
  DeleteAllUserHistoryMutationVariables,
  GetRestUserHistoryDocument,
  GetRestUserHistoryQuery,
  GetRestUserHistoryQueryVariables,
  RemoveRequestFromHistoryDocument,
  RemoveRequestFromHistoryMutation,
  RemoveRequestFromHistoryMutationVariables,
  ReqType,
  ToggleHistoryStarStatusDocument,
  ToggleHistoryStarStatusMutation,
  ToggleHistoryStarStatusMutationVariables,
  UserHistoryCreatedDocument,
  UserHistoryDeletedDocument,
  UserHistoryDeletedManyDocument,
  UserHistoryUpdatedDocument,
  IsUserHistoryEnabledQuery,
  IsUserHistoryEnabledQueryVariables,
  IsUserHistoryEnabledDocument,
  UserHistoryStoreStatusChangedDocument,
  UserHistoryAllDeletedDocument,
} from "@api/generated/graphql"

export const getUserHistoryEntries = () =>
  runGQLQuery<GetRestUserHistoryQuery, GetRestUserHistoryQueryVariables, "">({
    query: GetRestUserHistoryDocument,
    variables: {},
  })

export const getUserHistoryStore = () =>
  runGQLQuery<
    IsUserHistoryEnabledQuery,
    IsUserHistoryEnabledQueryVariables,
    ""
  >({
    query: IsUserHistoryEnabledDocument,
    variables: {},
  })

export const createUserHistory = (
  reqData: string,
  resMetadata: string,
  reqType: ReqType
) =>
  runMutation<
    CreateUserHistoryMutation,
    CreateUserHistoryMutationVariables,
    ""
  >(CreateUserHistoryDocument, {
    reqData,
    resMetadata,
    reqType,
  })()

export const toggleHistoryStarStatus = (id: string) =>
  runMutation<
    ToggleHistoryStarStatusMutation,
    ToggleHistoryStarStatusMutationVariables,
    ""
  >(ToggleHistoryStarStatusDocument, {
    id,
  })()

export const removeRequestFromHistory = (id: string) =>
  runMutation<
    RemoveRequestFromHistoryMutation,
    RemoveRequestFromHistoryMutationVariables,
    ""
  >(RemoveRequestFromHistoryDocument, {
    id,
  })()

export const deleteAllUserHistory = (reqType: ReqType) =>
  runMutation<
    DeleteAllUserHistoryMutation,
    DeleteAllUserHistoryMutationVariables,
    ""
  >(DeleteAllUserHistoryDocument, {
    reqType,
  })()

export const runUserHistoryCreatedSubscription = () =>
  runGQLSubscription({
    query: UserHistoryCreatedDocument,
    variables: {},
  })

export const runUserHistoryUpdatedSubscription = () =>
  runGQLSubscription({
    query: UserHistoryUpdatedDocument,
    variables: {},
  })

export const runUserHistoryDeletedSubscription = () =>
  runGQLSubscription({
    query: UserHistoryDeletedDocument,
    variables: {},
  })

export const runUserHistoryDeletedManySubscription = () =>
  runGQLSubscription({
    query: UserHistoryDeletedManyDocument,
    variables: {},
  })

export const runUserHistoryStoreStatusChangedSubscription = () =>
  runGQLSubscription({
    query: UserHistoryStoreStatusChangedDocument,
    variables: {},
  })

export const runUserHistoryAllDeletedSubscription = () =>
  runGQLSubscription({
    query: UserHistoryAllDeletedDocument,
    variables: {},
  })
