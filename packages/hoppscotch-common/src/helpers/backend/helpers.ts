import {
  HoppCollection,
  HoppRESTAuth,
  HoppRESTHeaders,
  HoppRESTRequest,
  makeCollection,
  translateToNewRequest,
} from "@hoppscotch/data"
import * as A from "fp-ts/Array"
import * as E from "fp-ts/Either"
import * as TE from "fp-ts/TaskEither"
import { flow, pipe } from "fp-ts/function"
import { z } from "zod"

import { getI18n } from "~/modules/i18n"
import { TeamCollection } from "../teams/TeamCollection"
import { TeamRequest } from "../teams/TeamRequest"
import { GQLError, runGQLQuery } from "./GQLClient"
import {
  ExportAsJsonDocument,
  GetCollectionChildrenIDsDocument,
  GetCollectionRequestsDocument,
  GetCollectionTitleAndDataDocument,
} from "./graphql"

type TeamCollectionJSON = {
  name: string
  folders: TeamCollectionJSON[]
  requests: HoppRESTRequest[]
  data: string
}

type CollectionDataProps = { auth: HoppRESTAuth; headers: HoppRESTHeaders }

export const BACKEND_PAGE_SIZE = 10

const getCollectionChildrenIDs = async (collID: string) => {
  const collsList: string[] = []

  while (true) {
    const data = await runGQLQuery({
      query: GetCollectionChildrenIDsDocument,
      variables: {
        collectionID: collID,
        cursor:
          collsList.length > 0 ? collsList[collsList.length - 1] : undefined,
      },
    })

    if (E.isLeft(data)) {
      return E.left(data.left)
    }

    if (!data.right.collection) return E.right([])

    const children = data.right.collection.children || []
    collsList.push(...children.map((x) => x.id))

    if (children.length !== BACKEND_PAGE_SIZE) break
  }

  return E.right(collsList)
}

const getCollectionRequests = async (collID: string) => {
  const reqList: TeamRequest[] = []

  while (true) {
    const data = await runGQLQuery({
      query: GetCollectionRequestsDocument,
      variables: {
        collectionID: collID,
        cursor: reqList.length > 0 ? reqList[reqList.length - 1].id : undefined,
      },
    })

    if (E.isLeft(data)) {
      return E.left(data.left)
    }

    reqList.push(
      ...data.right.requestsInCollection.map(
        (x) =>
          <TeamRequest>{
            id: x.id,
            request: translateToNewRequest(JSON.parse(x.request)),
            collectionID: collID,
            title: x.title,
          }
      )
    )

    if (data.right.requestsInCollection.length !== BACKEND_PAGE_SIZE) break
  }

  return E.right(reqList)
}

// Pick the value from the parsed result if it is successful, otherwise, return the default value
const parseWithDefaultValue = <T>(
  parseResult: z.SafeParseReturnType<T, T>,
  defaultValue: T
): T => (parseResult.success ? parseResult.data : defaultValue)

// Parse the incoming value for the `data` (authorization/headers) field and obtain the value in the expected format
const parseCollectionData = (
  data: string | Record<string, unknown> | null
): CollectionDataProps => {
  const defaultDataProps: CollectionDataProps = {
    auth: { authType: "inherit", authActive: true },
    headers: [],
  }

  if (!data) {
    return defaultDataProps
  }

  let parsedData: CollectionDataProps | Record<string, unknown> | null

  if (typeof data === "string") {
    try {
      parsedData = JSON.parse(data)
    } catch {
      return defaultDataProps
    }
  } else {
    parsedData = data
  }

  const auth = parseWithDefaultValue<CollectionDataProps["auth"]>(
    HoppRESTAuth.safeParse(parsedData?.auth),
    defaultDataProps.auth
  )

  const headers = parseWithDefaultValue<CollectionDataProps["headers"]>(
    HoppRESTHeaders.safeParse(parsedData?.headers),
    defaultDataProps.headers
  )

  return {
    auth,
    headers,
  }
}

// Transforms the collection JSON string obtained with workspace level export to `HoppRESTCollection`
const teamCollectionJSONToHoppRESTColl = (
  coll: TeamCollectionJSON
): HoppCollection => {
  const { auth, headers } = parseCollectionData(coll.data)

  return makeCollection({
    name: coll.name,
    folders: coll.folders.map(teamCollectionJSONToHoppRESTColl),
    requests: coll.requests,
    auth,
    headers,
  })
}

export const getCompleteCollectionTree = (
  collID: string
): TE.TaskEither<GQLError<string>, TeamCollection> =>
  pipe(
    TE.Do,

    TE.bind("titleAndData", () =>
      pipe(
        () =>
          runGQLQuery({
            query: GetCollectionTitleAndDataDocument,
            variables: {
              collectionID: collID,
            },
          }),
        TE.map((result) =>
          result.collection
            ? {
                title: result.collection!.title,
                data: result.collection!.data,
              }
            : null
        )
      )
    ),
    TE.bind("children", () =>
      pipe(
        // TaskEither -> () => Promise<Either>
        () => getCollectionChildrenIDs(collID),
        TE.chain(flow(A.map(getCompleteCollectionTree), TE.sequenceArray))
      )
    ),

    TE.bind("requests", () => () => getCollectionRequests(collID)),

    TE.map(
      ({ titleAndData, children, requests }) =>
        <TeamCollection>{
          id: collID,
          children,
          requests,
          title: titleAndData?.title,
          data: titleAndData?.data,
        }
    )
  )

export const teamCollToHoppRESTColl = (
  coll: TeamCollection
): HoppCollection => {
  const data =
    coll.data && coll.data !== "null"
      ? JSON.parse(coll.data)
      : {
          auth: { authType: "inherit", authActive: true },
          headers: [],
        }

  const { auth, headers } = parseCollectionData(data)

  return makeCollection({
    id: coll.id,
    name: coll.title,
    folders: coll.children?.map(teamCollToHoppRESTColl) ?? [],
    requests: coll.requests?.map((x) => x.request) ?? [],
    auth: auth ?? { authType: "inherit", authActive: true },
    headers: headers ?? [],
  })
}

/**
 * Get the JSON string of all the collection of the specified team
 * @param teamID - ID of the team
 * @returns Either of the JSON string of the collection or the error
 */
export const getTeamCollectionJSON = async (teamID: string) => {
  const data = await runGQLQuery({
    query: ExportAsJsonDocument,
    variables: {
      teamID,
    },
  })

  if (E.isLeft(data)) {
    return E.left(data.left.error.toString())
  }

  const collections = JSON.parse(data.right.exportCollectionsToJSON)

  if (!collections.length) {
    const t = getI18n()

    return E.left(t("error.no_collections_to_export"))
  }

  const hoppCollections = collections.map(teamCollectionJSONToHoppRESTColl)
  return E.right(JSON.stringify(hoppCollections))
}
