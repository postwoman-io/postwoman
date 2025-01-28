import { useGQLQuery } from "~/composables/graphql"
import { TeamName } from "~/helpers/backend/types/TeamName"
import { BackendPlatformDef } from "~/platform/backend"

import { HoppRESTRequest } from "@hoppscotch/data"
import { runGQLQuery, runMutation } from "~/helpers/backend/GQLClient"

import { Email } from "~/helpers/backend/types/Email"
import {
  AcceptTeamInvitationDocument,
  AcceptTeamInvitationMutation,
  AcceptTeamInvitationMutationVariables,
  CreateShortcodeDocument,
  CreateShortcodeMutation,
  CreateShortcodeMutationVariables,
  CreateTeamDocument,
  CreateTeamInvitationDocument,
  CreateTeamInvitationMutation,
  CreateTeamInvitationMutationVariables,
  CreateTeamMutation,
  CreateTeamMutationVariables,
  GetInviteDetailsDocument,
  GetInviteDetailsQuery,
  GetInviteDetailsQueryVariables,
  GetMyTeamsDocument,
  GetMyTeamsQuery,
  GetMyTeamsQueryVariables,
  GetUserShortcodesDocument,
  GetUserShortcodesQuery,
  GetUserShortcodesQueryVariables,
  TeamMemberRole,
} from "../../helpers/backend/graphql"

const getInviteDetails = <GetInviteDetailsError extends string>(
  inviteID: string
) => {
  return useGQLQuery<
    GetInviteDetailsQuery,
    GetInviteDetailsQueryVariables,
    GetInviteDetailsError
  >({
    query: GetInviteDetailsDocument,
    variables: {
      inviteID,
    },
    defer: true,
  })
}

const getUserShortcodes = (cursor?: string) => {
  return runGQLQuery<
    GetUserShortcodesQuery,
    GetUserShortcodesQueryVariables,
    ""
  >({
    query: GetUserShortcodesDocument,
    variables: {
      cursor,
    },
  })
}

const getUserTeams = (cursor?: string) => {
  return runGQLQuery<GetMyTeamsQuery, GetMyTeamsQueryVariables, "">({
    query: GetMyTeamsDocument,
    variables: {
      cursor,
    },
  })
}

export const createTeam = <CreateTeamErrors extends string>(name: TeamName) => {
  return runMutation<
    CreateTeamMutation,
    CreateTeamMutationVariables,
    CreateTeamErrors
  >(CreateTeamDocument, {
    name,
  })
}

export const createTeamInvitation = <CreateTeamInvitationErrors extends string>(
  inviteeEmail: Email,
  inviteeRole: TeamMemberRole,
  teamID: string
) => {
  return runMutation<
    CreateTeamInvitationMutation,
    CreateTeamInvitationMutationVariables,
    CreateTeamInvitationErrors
  >(CreateTeamInvitationDocument, {
    inviteeEmail,
    inviteeRole,
    teamID,
  })
}

export const acceptTeamInvitation = <AcceptTeamInvitationErrors extends string>(
  inviteID: string
) => {
  return runMutation<
    AcceptTeamInvitationMutation,
    AcceptTeamInvitationMutationVariables,
    AcceptTeamInvitationErrors
  >(AcceptTeamInvitationDocument, {
    inviteID,
  })
}

export const createShortcode = (
  request: HoppRESTRequest,
  properties?: string
) => {
  return runMutation<
    CreateShortcodeMutation,
    CreateShortcodeMutationVariables,
    ""
  >(CreateShortcodeDocument, {
    request: JSON.stringify(request),
    properties,
  })
}

export const def: BackendPlatformDef = {
  getInviteDetails,
  getUserShortcodes,
  getUserTeams,
  createTeam,
  createTeamInvitation,
  acceptTeamInvitation,
  createShortcode,
}
