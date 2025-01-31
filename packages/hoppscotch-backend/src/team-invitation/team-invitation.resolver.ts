import {
  Args,
  ID,
  Mutation,
  Parent,
  Query,
  ResolveField,
  Resolver,
  Subscription,
} from '@nestjs/graphql';
import { TeamInvitation } from './team-invitation.model';
import { TeamInvitationService } from './team-invitation.service';
import { pipe } from 'fp-ts/function';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import * as O from 'fp-ts/Option';
import { Team, TeamMember, TeamMemberRole } from 'src/team/team.model';
import {
  TEAM_INVALID_ID,
  TEAM_INVITE_NO_INVITE_FOUND,
  USER_NOT_FOUND,
} from 'src/errors';
import { GqlUser } from 'src/decorators/gql-user.decorator';
import { User } from 'src/user/user.model';
import { UseGuards } from '@nestjs/common';
import { GqlAuthGuard } from '../guards/gql-auth.guard';
import { TeamService } from 'src/team/team.service';
import { throwErr } from 'src/utils';
import { TeamInviteeGuard } from './team-invitee.guard';
import { GqlTeamMemberGuard } from 'src/team/guards/gql-team-member.guard';
import { RequiresTeamRole } from 'src/team/decorators/requires-team-role.decorator';
import { TeamInviteViewerGuard } from './team-invite-viewer.guard';
import { TeamInviteTeamOwnerGuard } from './team-invite-team-owner.guard';
import { UserService } from 'src/user/user.service';
import { PubSubService } from 'src/pubsub/pubsub.service';
import { GqlThrottlerGuard } from 'src/guards/gql-throttler.guard';
import { SkipThrottle } from '@nestjs/throttler';
import { AuthUser } from 'src/types/AuthUser';
import { CreateTeamInvitationArgs } from './input-type.args';

@UseGuards(GqlThrottlerGuard)
@Resolver(() => TeamInvitation)
export class TeamInvitationResolver {
  constructor(
    private readonly userService: UserService,
    private readonly teamService: TeamService,
    private readonly teamInvitationService: TeamInvitationService,

    private readonly pubsub: PubSubService,
  ) {}

  @ResolveField(() => Team, {
    complexity: 5,
    description: 'Get the team associated to the invite',
  })
  async team(@Parent() teamInvitation: TeamInvitation): Promise<Team> {
    const team = await this.teamService.getTeamWithID(teamInvitation.teamID);
    if (!team) throwErr(TEAM_INVALID_ID);
    return team;
  }

  @ResolveField(() => User, {
    complexity: 5,
    description: 'Get the creator of the invite',
  })
  async creator(@Parent() teamInvitation: TeamInvitation): Promise<User> {
    const user = await this.userService.findUserById(teamInvitation.creatorUid);
    if (O.isNone(user)) throwErr(USER_NOT_FOUND);

    return {
      ...user.value,
      currentGQLSession: JSON.stringify(user.value.currentGQLSession),
      currentRESTSession: JSON.stringify(user.value.currentRESTSession),
    };
  }

  @Query(() => TeamInvitation, {
    description:
      'Gets the Team Invitation with the given ID, or null if not exists',
  })
  @UseGuards(GqlAuthGuard, TeamInviteViewerGuard)
  async teamInvitation(
    @GqlUser() user: AuthUser,
    @Args({
      name: 'inviteID',
      description: 'ID of the Team Invitation to lookup',
      type: () => ID,
    })
    inviteID: string,
  ): Promise<TeamInvitation> {
    const teamInvitation = await this.teamInvitationService.getInvitation(
      inviteID,
    );
    if (O.isNone(teamInvitation)) throwErr(TEAM_INVITE_NO_INVITE_FOUND);
    return teamInvitation.value;
  }

  @Mutation(() => TeamInvitation, {
    description: 'Creates a Team Invitation',
  })
  @UseGuards(GqlAuthGuard, GqlTeamMemberGuard)
  @RequiresTeamRole(TeamMemberRole.OWNER)
  async createTeamInvitation(
    @GqlUser() user: AuthUser,
    @Args() args: CreateTeamInvitationArgs,
  ): Promise<TeamInvitation> {
    const teamInvitation = await this.teamInvitationService.createInvitation(
      user,
      args.teamID,
      args.inviteeEmail,
      args.inviteeRole,
    );

    if (E.isLeft(teamInvitation)) throwErr(teamInvitation.left);
    return teamInvitation.right;
  }

  @Mutation(() => Boolean, {
    description: 'Revokes an invitation and deletes it',
  })
  @UseGuards(GqlAuthGuard, TeamInviteTeamOwnerGuard)
  @RequiresTeamRole(TeamMemberRole.OWNER)
  async revokeTeamInvitation(
    @Args({
      name: 'inviteID',
      type: () => ID,
      description: 'ID of the invite to revoke',
    })
    inviteID: string,
  ): Promise<true> {
    const isRevoked = await this.teamInvitationService.revokeInvitation(
      inviteID,
    );
    if (E.isLeft(isRevoked)) throwErr(isRevoked.left);
    return true;
  }

  @Mutation(() => TeamMember, {
    description: 'Accept an Invitation',
  })
  @UseGuards(GqlAuthGuard, TeamInviteeGuard)
  async acceptTeamInvitation(
    @GqlUser() user: AuthUser,
    @Args({
      name: 'inviteID',
      type: () => ID,
      description: 'ID of the Invite to accept',
    })
    inviteID: string,
  ): Promise<TeamMember> {
    const teamMember = await this.teamInvitationService.acceptInvitation(
      inviteID,
      user,
    );
    if (E.isLeft(teamMember)) throwErr(teamMember.left);
    return teamMember.right;
  }

  // Subscriptions
  @Subscription(() => TeamInvitation, {
    description: 'Listens to when a Team Invitation is added',
    resolve: (value) => value,
  })
  @SkipThrottle()
  @UseGuards(GqlAuthGuard, GqlTeamMemberGuard)
  @RequiresTeamRole(
    TeamMemberRole.OWNER,
    TeamMemberRole.EDITOR,
    TeamMemberRole.VIEWER,
  )
  teamInvitationAdded(
    @Args({
      name: 'teamID',
      type: () => ID,
      description: 'ID of the Team to listen to',
    })
    teamID: string,
  ): AsyncIterator<TeamInvitation> {
    return this.pubsub.asyncIterator(`team/${teamID}/invite_added`);
  }

  @Subscription(() => ID, {
    description: 'Listens to when a Team Invitation is removed',
    resolve: (value) => value,
  })
  @SkipThrottle()
  @UseGuards(GqlAuthGuard, GqlTeamMemberGuard)
  @RequiresTeamRole(
    TeamMemberRole.OWNER,
    TeamMemberRole.EDITOR,
    TeamMemberRole.VIEWER,
  )
  teamInvitationRemoved(
    @Args({
      name: 'teamID',
      type: () => ID,
      description: 'ID of the Team to listen to',
    })
    teamID: string,
  ): AsyncIterator<string> {
    return this.pubsub.asyncIterator(`team/${teamID}/invite_removed`);
  }
}
