import { GQLError } from "../backend/GQLClient"

export const getEnvActionErrorMessage = (err: GQLError<string>) => {
  if (err.type === "network_error") {
    return "error.network_error"
  }

  switch (err.error) {
    case "team_environment/not_found":
      return "team_environment.not_found"
    case "team_environment/short_name":
      return "environment.short_name"
    case "Forbidden resource":
      return "profile.no_permission"
    default:
      return "error.something_went_wrong"
  }
}
