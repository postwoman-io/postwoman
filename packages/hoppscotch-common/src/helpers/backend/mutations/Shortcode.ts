import { HoppRESTRequest } from "@hoppscotch/data"
import { platform } from "~/platform"
import { runMutation } from "../GQLClient"
import {
  DeleteShortcodeDocument,
  DeleteShortcodeMutation,
  DeleteShortcodeMutationVariables,
  UpdateEmbedPropertiesDocument,
  UpdateEmbedPropertiesMutation,
  UpdateEmbedPropertiesMutationVariables,
} from "../graphql"

type DeleteShortcodeErrors = "shortcode/not_found"

export const createShortcode = (
  request: HoppRESTRequest,
  properties?: string
) => platform.backend.createShortcode(request, properties)

export const deleteShortcode = (code: string) =>
  runMutation<
    DeleteShortcodeMutation,
    DeleteShortcodeMutationVariables,
    DeleteShortcodeErrors
  >(DeleteShortcodeDocument, {
    code,
  })

export const updateEmbedProperties = (code: string, properties: string) =>
  runMutation<
    UpdateEmbedPropertiesMutation,
    UpdateEmbedPropertiesMutationVariables,
    ""
  >(UpdateEmbedPropertiesDocument, {
    code,
    properties,
  })
