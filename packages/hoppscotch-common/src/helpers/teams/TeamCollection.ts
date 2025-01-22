import { runGQLQuery } from "../backend/GQLClient"
import {
  GetCollectionChildrenDocument,
  GetSingleCollectionDocument,
} from "../backend/graphql"
import { TeamRequest } from "./TeamRequest"

/**
 * Defines how a Team Collection is represented in the TeamCollectionAdapter
 */
export interface TeamCollection {
  id: string
  title: string
  children: TeamCollection[] | null
  requests: TeamRequest[] | null
  data: string | null
}

export const getSingleCollection = (collectionID: string) =>
  runGQLQuery({
    query: GetSingleCollectionDocument,
    variables: {
      collectionID,
    },
  })

export const getCollectionChildCollections = (collectionID: string) =>
  runGQLQuery({
    query: GetCollectionChildrenDocument,
    variables: {
      collectionID,
    },
  })
