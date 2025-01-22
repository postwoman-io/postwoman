import {
  runGQLQuery,
  runGQLSubscription,
  runMutation,
} from "@hoppscotch/common/helpers/backend/GQLClient"
import {
  CreateGqlChildUserCollectionDocument,
  CreateGqlChildUserCollectionMutation,
  CreateGqlChildUserCollectionMutationVariables,
  CreateGqlRootUserCollectionDocument,
  CreateGqlRootUserCollectionMutation,
  CreateGqlRootUserCollectionMutationVariables,
  CreateGqlUserRequestDocument,
  CreateGqlUserRequestMutation,
  CreateGqlUserRequestMutationVariables,
  CreateRestChildUserCollectionDocument,
  CreateRestChildUserCollectionMutation,
  CreateRestChildUserCollectionMutationVariables,
  CreateRestRootUserCollectionDocument,
  CreateRestRootUserCollectionMutation,
  CreateRestRootUserCollectionMutationVariables,
  CreateRestUserRequestDocument,
  CreateRestUserRequestMutation,
  CreateRestUserRequestMutationVariables,
  DeleteUserCollectionDocument,
  DeleteUserCollectionMutation,
  DeleteUserCollectionMutationVariables,
  DeleteUserRequestDocument,
  DeleteUserRequestMutation,
  DeleteUserRequestMutationVariables,
  ExportUserCollectionsToJsonDocument,
  ExportUserCollectionsToJsonQuery,
  ExportUserCollectionsToJsonQueryVariables,
  GetGqlRootUserCollectionsDocument,
  GetGqlRootUserCollectionsQuery,
  GetGqlRootUserCollectionsQueryVariables,
  GetUserRootCollectionsDocument,
  GetUserRootCollectionsQuery,
  GetUserRootCollectionsQueryVariables,
  MoveUserCollectionDocument,
  MoveUserCollectionMutation,
  MoveUserCollectionMutationVariables,
  MoveUserRequestDocument,
  MoveUserRequestMutation,
  MoveUserRequestMutationVariables,
  RenameUserCollectionDocument,
  RenameUserCollectionMutation,
  RenameUserCollectionMutationVariables,
  ReqType,
  UpdateGqlUserRequestDocument,
  UpdateGqlUserRequestMutation,
  UpdateGqlUserRequestMutationVariables,
  UpdateRestUserRequestDocument,
  UpdateRestUserRequestMutation,
  UpdateRestUserRequestMutationVariables,
  UpdateUserCollectionOrderDocument,
  UpdateUserCollectionOrderMutation,
  UpdateUserCollectionOrderMutationVariables,
  UserCollectionCreatedDocument,
  UserCollectionDuplicatedDocument,
  UserCollectionMovedDocument,
  UserCollectionOrderUpdatedDocument,
  UserCollectionRemovedDocument,
  UserCollectionUpdatedDocument,
  UserRequestCreatedDocument,
  UserRequestDeletedDocument,
  UserRequestMovedDocument,
  UserRequestUpdatedDocument,
} from "../../api/generated/graphql"

export const createRESTRootUserCollection = (title: string) =>
  runMutation<
    CreateRestRootUserCollectionMutation,
    CreateRestRootUserCollectionMutationVariables,
    ""
  >(CreateRestRootUserCollectionDocument, {
    title,
  })()

export const createGQLRootUserCollection = (title: string) =>
  runMutation<
    CreateGqlRootUserCollectionMutation,
    CreateGqlRootUserCollectionMutationVariables,
    ""
  >(CreateGqlRootUserCollectionDocument, {
    title,
  })()

export const createRESTUserRequest = (
  title: string,
  request: string,
  collectionID: string
) =>
  runMutation<
    CreateRestUserRequestMutation,
    CreateRestUserRequestMutationVariables,
    ""
  >(CreateRestUserRequestDocument, {
    title,
    request,
    collectionID,
  })()

export const createGQLUserRequest = (
  title: string,
  request: string,
  collectionID: string
) =>
  runMutation<
    CreateGqlUserRequestMutation,
    CreateGqlUserRequestMutationVariables,
    ""
  >(CreateGqlUserRequestDocument, {
    title,
    request,
    collectionID,
  })()

export const createRESTChildUserCollection = (
  title: string,
  parentUserCollectionID: string
) =>
  runMutation<
    CreateRestChildUserCollectionMutation,
    CreateRestChildUserCollectionMutationVariables,
    ""
  >(CreateRestChildUserCollectionDocument, {
    title,
    parentUserCollectionID,
  })()

export const createGQLChildUserCollection = (
  title: string,
  parentUserCollectionID: string
) =>
  runMutation<
    CreateGqlChildUserCollectionMutation,
    CreateGqlChildUserCollectionMutationVariables,
    ""
  >(CreateGqlChildUserCollectionDocument, {
    title,
    parentUserCollectionID,
  })()

export const deleteUserCollection = (userCollectionID: string) =>
  runMutation<
    DeleteUserCollectionMutation,
    DeleteUserCollectionMutationVariables,
    ""
  >(DeleteUserCollectionDocument, {
    userCollectionID,
  })()

export const renameUserCollection = (
  userCollectionID: string,
  newTitle: string
) =>
  runMutation<
    RenameUserCollectionMutation,
    RenameUserCollectionMutationVariables,
    ""
  >(RenameUserCollectionDocument, { userCollectionID, newTitle })()

export const moveUserCollection = (
  sourceCollectionID: string,
  destinationCollectionID?: string
) =>
  runMutation<
    MoveUserCollectionMutation,
    MoveUserCollectionMutationVariables,
    ""
  >(MoveUserCollectionDocument, {
    userCollectionID: sourceCollectionID,
    destCollectionID: destinationCollectionID,
  })()

export const editUserRequest = (
  requestID: string,
  title: string,
  request: string
) =>
  runMutation<
    UpdateRestUserRequestMutation,
    UpdateRestUserRequestMutationVariables,
    ""
  >(UpdateRestUserRequestDocument, {
    id: requestID,
    request,
    title,
  })()

export const editGQLUserRequest = (
  requestID: string,
  title: string,
  request: string
) =>
  runMutation<
    UpdateGqlUserRequestMutation,
    UpdateGqlUserRequestMutationVariables,
    ""
  >(UpdateGqlUserRequestDocument, {
    id: requestID,
    request,
    title,
  })()

export const deleteUserRequest = (requestID: string) =>
  runMutation<
    DeleteUserRequestMutation,
    DeleteUserRequestMutationVariables,
    ""
  >(DeleteUserRequestDocument, {
    requestID,
  })()

export const moveUserRequest = (
  sourceCollectionID: string,
  destinationCollectionID: string,
  requestID: string,
  nextRequestID?: string
) =>
  runMutation<MoveUserRequestMutation, MoveUserRequestMutationVariables, "">(
    MoveUserRequestDocument,
    {
      sourceCollectionID,
      destinationCollectionID,
      requestID,
      nextRequestID,
    }
  )()

export const updateUserCollectionOrder = (
  collectionID: string,
  nextCollectionID?: string
) =>
  runMutation<
    UpdateUserCollectionOrderMutation,
    UpdateUserCollectionOrderMutationVariables,
    ""
  >(UpdateUserCollectionOrderDocument, {
    collectionID,
    nextCollectionID,
  })()

export const getUserRootCollections = () =>
  runGQLQuery<
    GetUserRootCollectionsQuery,
    GetUserRootCollectionsQueryVariables,
    ""
  >({
    query: GetUserRootCollectionsDocument,
    variables: {},
  })

export const getGQLRootUserCollections = () =>
  runGQLQuery<
    GetGqlRootUserCollectionsQuery,
    GetGqlRootUserCollectionsQueryVariables,
    ""
  >({
    query: GetGqlRootUserCollectionsDocument,
    variables: {},
  })

export const exportUserCollectionsToJSON = (
  collectionID?: string,
  collectionType: ReqType.Rest | ReqType.Gql = ReqType.Rest
) =>
  runGQLQuery<
    ExportUserCollectionsToJsonQuery,
    ExportUserCollectionsToJsonQueryVariables,
    ""
  >({
    query: ExportUserCollectionsToJsonDocument,
    variables: { collectionID, collectionType },
  })

export const runUserCollectionCreatedSubscription = () =>
  runGQLSubscription({ query: UserCollectionCreatedDocument, variables: {} })

export const runUserCollectionUpdatedSubscription = () =>
  runGQLSubscription({ query: UserCollectionUpdatedDocument, variables: {} })

export const runUserCollectionRemovedSubscription = () =>
  runGQLSubscription({ query: UserCollectionRemovedDocument, variables: {} })

export const runUserCollectionMovedSubscription = () =>
  runGQLSubscription({ query: UserCollectionMovedDocument, variables: {} })

export const runUserCollectionOrderUpdatedSubscription = () =>
  runGQLSubscription({
    query: UserCollectionOrderUpdatedDocument,
    variables: {},
  })

export const runUserCollectionDuplicatedSubscription = () =>
  runGQLSubscription({
    query: UserCollectionDuplicatedDocument,
    variables: {},
  })

export const runUserRequestCreatedSubscription = () =>
  runGQLSubscription({ query: UserRequestCreatedDocument, variables: {} })

export const runUserRequestUpdatedSubscription = () =>
  runGQLSubscription({ query: UserRequestUpdatedDocument, variables: {} })

export const runUserRequestMovedSubscription = () =>
  runGQLSubscription({ query: UserRequestMovedDocument, variables: {} })

export const runUserRequestDeletedSubscription = () =>
  runGQLSubscription({ query: UserRequestDeletedDocument, variables: {} })
