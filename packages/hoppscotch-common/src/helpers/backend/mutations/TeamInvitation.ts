import { pipe } from "fp-ts/function"
import * as TE from "fp-ts/TaskEither"
import { platform } from "~/platform"
import { runMutation } from "../GQLClient"
import {
  RevokeTeamInvitationDocument,
  RevokeTeamInvitationMutation,
  RevokeTeamInvitationMutationVariables,
  TeamMemberRole,
} from "../graphql"
import { Email } from "../types/Email"

export type CreateTeamInvitationErrors =
  | "invalid/email"
  | "team/invalid_id"
  | "team/member_not_found"
  | "team_invite/already_member"
  | "team_invite/member_has_invite"
  | "user/not_found"

type RevokeTeamInvitationErrors =
  | "team/not_required_role"
  | "team_invite/no_invite_found"

type AcceptTeamInvitationErrors =
  | "team_invite/no_invite_found"
  | "team_invite/already_member"
  | "team_invite/email_do_not_match"

export const createTeamInvitation = (
  inviteeEmail: Email,
  inviteeRole: TeamMemberRole,
  teamID: string
) => {
  return pipe(
    platform.backend.createTeamInvitation<CreateTeamInvitationErrors>(
      inviteeEmail,
      inviteeRole,
      teamID
    ),
    TE.map((x) => x.createTeamInvitation)
  )
}

export const revokeTeamInvitation = (inviteID: string) =>
  runMutation<
    RevokeTeamInvitationMutation,
    RevokeTeamInvitationMutationVariables,
    RevokeTeamInvitationErrors
  >(RevokeTeamInvitationDocument, {
    inviteID,
  })

export const acceptTeamInvitation = (inviteID: string) =>
  platform.backend.acceptTeamInvitation<AcceptTeamInvitationErrors>(inviteID)
