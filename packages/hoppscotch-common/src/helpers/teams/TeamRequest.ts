import { HoppRESTRequest } from "@hoppscotch/data"
import { runGQLQuery } from "../backend/GQLClient"
import {
  GetCollectionChildrenDocument,
  GetCollectionRequestsDocument,
  GetSingleRequestDocument,
} from "../backend/graphql"

/**
 * Defines how a Teams request is represented in TeamCollectionAdapter
 */
export interface TeamRequest {
  id: string
  collectionID: string
  title: string
  request: HoppRESTRequest
}

export const getCollectionChildRequests = (collectionID: string) =>
  runGQLQuery({
    query: GetCollectionRequestsDocument,
    variables: {
      collectionID,
    },
  })

export const getSingleRequest = (requestID: string) =>
  runGQLQuery({
    query: GetSingleRequestDocument,
    variables: {
      requestID,
    },
  })

export const getCollectionChildCollections = (collectionID: string) =>
  runGQLQuery({
    query: GetCollectionChildrenDocument,
    variables: {
      collectionID,
    },
  })
