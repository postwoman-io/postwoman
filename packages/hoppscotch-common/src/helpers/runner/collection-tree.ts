import { ComposerTranslation } from "vue-i18n"
import { GQLError } from "../backend/GQLClient"

export const getErrorMessage = (
  err: GQLError<string>,
  t: ComposerTranslation
) => {
  console.error(err)
  if (err.type === "network_error") {
    return t("error.network_error")
  }
  switch (err.error) {
    case "team_coll/short_title":
      return t("collection.name_length_insufficient")
    case "team/invalid_coll_id":
    case "bug/team_coll/no_coll_id":
    case "team_req/invalid_target_id":
      return t("team.invalid_coll_id")
    case "team/not_required_role":
      return t("profile.no_permission")
    case "team_req/not_required_role":
      return t("profile.no_permission")
    case "Forbidden resource":
      return t("profile.no_permission")
    case "team_req/not_found":
      return t("team.no_request_found")
    case "bug/team_req/no_req_id":
      return t("team.no_request_found")
    case "team/collection_is_parent_coll":
      return t("team.parent_coll_move")
    case "team/target_and_destination_collection_are_same":
      return t("team.same_target_destination")
    case "team/target_collection_is_already_root_collection":
      return t("collection.invalid_root_move")
    case "team_req/requests_not_from_same_collection":
      return t("request.different_collection")
    case "team/team_collections_have_different_parents":
      return t("collection.different_parent")
    default:
      return t("error.something_went_wrong")
  }
}
