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
import { Admin } from './admin.model';
import { UseGuards } from '@nestjs/common';
import { GqlAuthGuard } from '../guards/gql-auth.guard';
import { GqlAdminGuard } from './guards/gql-admin.guard';
import { GqlAdmin } from './decorators/gql-admin.decorator';
import { AdminService } from './admin.service';
import * as E from 'fp-ts/Either';
import { throwErr } from '../utils';
import { AuthUser } from '../types/AuthUser';
import { InvitedUser } from './invited-user.model';
import { GqlUser } from '../decorators/gql-user.decorator';
import { PubSubService } from '../pubsub/pubsub.service';
import { Team, TeamMember } from '../team/team.model';
import {
  AddUserToTeamArgs,
  ChangeUserRoleInTeamArgs,
} from './input-types.args';
import { GqlThrottlerGuard } from 'src/guards/gql-throttler.guard';
import { SkipThrottle } from '@nestjs/throttler';
import { UserDeletionResult } from 'src/user/user.model';

@UseGuards(GqlThrottlerGuard)
@Resolver(() => Admin)
export class AdminResolver {
  constructor(
    private adminService: AdminService,
    private readonly pubsub: PubSubService,
  ) {}

  /* Query */

  @Query(() => Admin, {
    description: 'Gives details of the admin executing this query',
  })
  @UseGuards(GqlAuthGuard, GqlAdminGuard)
  admin(@GqlAdmin() admin: Admin) {
    return admin;
  }

  /* Mutations */

  @Mutation(() => InvitedUser, {
    description: 'Invite a user to the infra using email',
  })
  @UseGuards(GqlAuthGuard, GqlAdminGuard)
  async inviteNewUser(
    @GqlUser() adminUser: AuthUser,
    @Args({
      name: 'inviteeEmail',
      description: 'invitee email',
    })
    inviteeEmail: string,
  ): Promise<InvitedUser> {
    const invitedUser = await this.adminService.inviteUserToSignInViaEmail(
      adminUser.uid,
      adminUser.email,
      inviteeEmail,
    );
    if (E.isLeft(invitedUser)) throwErr(invitedUser.left);
    return invitedUser.right;
  }

  @Mutation(() => Boolean, {
    description: 'Revoke a user invites by invitee emails',
  })
  @UseGuards(GqlAuthGuard, GqlAdminGuard)
  async revokeUserInvitationsByAdmin(
    @Args({
      name: 'inviteeEmails',
      description: 'Invitee Emails',
      type: () => [String],
    })
    inviteeEmails: string[],
  ): Promise<boolean> {
    const invite = await this.adminService.revokeUserInvitations(inviteeEmails);
    if (E.isLeft(invite)) throwErr(invite.left);
    return invite.right;
  }

  @Mutation(() => Boolean, {
    description: 'Delete an user account from infra',
    deprecationReason: 'Use removeUsersByAdmin instead',
  })
  @UseGuards(GqlAuthGuard, GqlAdminGuard)
  async removeUserByAdmin(
    @Args({
      name: 'userUID',
      description: 'users UID',
      type: () => ID,
    })
    userUID: string,
  ): Promise<boolean> {
    const removedUser = await this.adminService.removeUserAccount(userUID);
    if (E.isLeft(removedUser)) throwErr(removedUser.left);
    return removedUser.right;
  }

  @Mutation(() => [UserDeletionResult], {
    description: 'Delete user accounts from infra',
  })
  @UseGuards(GqlAuthGuard, GqlAdminGuard)
  async removeUsersByAdmin(
    @Args({
      name: 'userUIDs',
      description: 'users UID',
      type: () => [ID],
    })
    userUIDs: string[],
  ): Promise<UserDeletionResult[]> {
    const deletionResults =
      await this.adminService.removeUserAccounts(userUIDs);
    if (E.isLeft(deletionResults)) throwErr(deletionResults.left);
    return deletionResults.right;
  }

  @Mutation(() => Boolean, {
    description: 'Make user an admin',
    deprecationReason: 'Use makeUsersAdmin instead',
  })
  @UseGuards(GqlAuthGuard, GqlAdminGuard)
  async makeUserAdmin(
    @Args({
      name: 'userUID',
      description: 'users UID',
      type: () => ID,
    })
    userUID: string,
  ): Promise<boolean> {
    const admin = await this.adminService.makeUserAdmin(userUID);
    if (E.isLeft(admin)) throwErr(admin.left);
    return admin.right;
  }

  @Mutation(() => Boolean, {
    description: 'Make users an admin',
  })
  @UseGuards(GqlAuthGuard, GqlAdminGuard)
  async makeUsersAdmin(
    @Args({
      name: 'userUIDs',
      description: 'users UID',
      type: () => [ID],
    })
    userUIDs: string[],
  ): Promise<boolean> {
    const isUpdated = await this.adminService.makeUsersAdmin(userUIDs);
    if (E.isLeft(isUpdated)) throwErr(isUpdated.left);
    return isUpdated.right;
  }

  @Mutation(() => Boolean, {
    description: 'Update user display name',
  })
  @UseGuards(GqlAuthGuard, GqlAdminGuard)
  async updateUserDisplayNameByAdmin(
    @Args({
      name: 'userUID',
      description: 'users UID',
      type: () => ID,
    })
    userUID: string,
    @Args({
      name: 'displayName',
      description: 'users display name',
    })
    displayName: string,
  ): Promise<boolean> {
    const isUpdated = await this.adminService.updateUserDisplayName(
      userUID,
      displayName,
    );
    if (E.isLeft(isUpdated)) throwErr(isUpdated.left);
    return isUpdated.right;
  }

  @Mutation(() => Boolean, {
    description: 'Remove user as admin',
    deprecationReason: 'Use demoteUsersByAdmin instead',
  })
  @UseGuards(GqlAuthGuard, GqlAdminGuard)
  async removeUserAsAdmin(
    @Args({
      name: 'userUID',
      description: 'users UID',
      type: () => ID,
    })
    userUID: string,
  ): Promise<boolean> {
    const admin = await this.adminService.removeUserAsAdmin(userUID);
    if (E.isLeft(admin)) throwErr(admin.left);
    return admin.right;
  }

  @Mutation(() => Boolean, {
    description: 'Remove users as admin',
  })
  @UseGuards(GqlAuthGuard, GqlAdminGuard)
  async demoteUsersByAdmin(
    @Args({
      name: 'userUIDs',
      description: 'users UID',
      type: () => [ID],
    })
    userUIDs: string[],
  ): Promise<boolean> {
    const isUpdated = await this.adminService.demoteUsersByAdmin(userUIDs);
    if (E.isLeft(isUpdated)) throwErr(isUpdated.left);
    return isUpdated.right;
  }

  @Mutation(() => Team, {
    description:
      'Create a new team by providing the user uid to nominate as Team owner',
  })
  @UseGuards(GqlAuthGuard, GqlAdminGuard)
  async createTeamByAdmin(
    @GqlAdmin() adminUser: Admin,
    @Args({
      name: 'userUid',
      description: 'users uid to make team owner',
      type: () => ID,
    })
    userUid: string,
    @Args({ name: 'name', description: 'Displayed name of the team' })
    name: string,
  ): Promise<Team> {
    const createdTeam = await this.adminService.createATeam(userUid, name);
    if (E.isLeft(createdTeam)) throwErr(createdTeam.left);
    return createdTeam.right;
  }
  @Mutation(() => TeamMember, {
    description: 'Change the role of a user in a team',
  })
  @UseGuards(GqlAuthGuard, GqlAdminGuard)
  async changeUserRoleInTeamByAdmin(
    @GqlAdmin() adminUser: Admin,
    @Args() args: ChangeUserRoleInTeamArgs,
  ): Promise<TeamMember> {
    const updatedRole = await this.adminService.changeRoleOfUserTeam(
      args.userUID,
      args.teamID,
      args.newRole,
    );
    if (E.isLeft(updatedRole)) throwErr(updatedRole.left);
    return updatedRole.right;
  }
  @Mutation(() => Boolean, {
    description: 'Remove the user from a team',
  })
  @UseGuards(GqlAuthGuard, GqlAdminGuard)
  async removeUserFromTeamByAdmin(
    @GqlAdmin() adminUser: Admin,
    @Args({
      name: 'userUid',
      description: 'users UID',
      type: () => ID,
    })
    userUid: string,
    @Args({
      name: 'teamID',
      description: 'team ID',
      type: () => ID,
    })
    teamID: string,
  ): Promise<boolean> {
    const removedUser = await this.adminService.removeUserFromTeam(
      userUid,
      teamID,
    );
    if (E.isLeft(removedUser)) throwErr(removedUser.left);
    return removedUser.right;
  }
  @Mutation(() => TeamMember, {
    description: 'Add a user to a team with email and team member role',
  })
  @UseGuards(GqlAuthGuard, GqlAdminGuard)
  async addUserToTeamByAdmin(
    @GqlAdmin() adminUser: Admin,
    @Args() args: AddUserToTeamArgs,
  ): Promise<TeamMember> {
    const addedUser = await this.adminService.addUserToTeam(
      args.teamID,
      args.userEmail,
      args.role,
    );
    if (E.isLeft(addedUser)) throwErr(addedUser.left);
    return addedUser.right;
  }

  @Mutation(() => Team, {
    description: 'Change a team name',
  })
  @UseGuards(GqlAuthGuard, GqlAdminGuard)
  async renameTeamByAdmin(
    @GqlAdmin() adminUser: Admin,
    @Args({ name: 'teamID', description: 'ID of the team', type: () => ID })
    teamID: string,
    @Args({ name: 'newName', description: 'The updated name of the team' })
    newName: string,
  ): Promise<Team> {
    const renamedTeam = await this.adminService.renameATeam(teamID, newName);
    if (E.isLeft(renamedTeam)) throwErr(renamedTeam.left);
    return renamedTeam.right;
  }
  @Mutation(() => Boolean, {
    description: 'Delete a team',
  })
  @UseGuards(GqlAuthGuard, GqlAdminGuard)
  async deleteTeamByAdmin(
    @Args({ name: 'teamID', description: 'ID of the team', type: () => ID })
    teamID: string,
  ): Promise<boolean> {
    const deletedTeam = await this.adminService.deleteATeam(teamID);
    if (E.isLeft(deletedTeam)) throwErr(deletedTeam.left);
    return deletedTeam.right;
  }

  @Mutation(() => Boolean, {
    description: 'Revoke a team Invite by Invite ID',
  })
  @UseGuards(GqlAuthGuard, GqlAdminGuard)
  async revokeTeamInviteByAdmin(
    @Args({
      name: 'inviteID',
      description: 'Team Invite ID',
      type: () => ID,
    })
    inviteID: string,
  ): Promise<boolean> {
    const invite = await this.adminService.revokeTeamInviteByID(inviteID);
    if (E.isLeft(invite)) throwErr(invite.left);
    return true;
  }

  @Mutation(() => Boolean, {
    description: 'Revoke Shortcode by ID',
  })
  @UseGuards(GqlAuthGuard, GqlAdminGuard)
  async revokeShortcodeByAdmin(
    @Args({
      name: 'code',
      description: 'The shortcode to delete',
      type: () => ID,
    })
    code: string,
  ): Promise<boolean> {
    const res = await this.adminService.deleteShortcode(code);
    if (E.isLeft(res)) throwErr(res.left);
    return true;
  }

  @Mutation(() => Boolean, {
    description: 'Revoke all User History',
  })
  @UseGuards(GqlAuthGuard, GqlAdminGuard)
  async revokeAllUserHistoryByAdmin(): Promise<boolean> {
    const isDeleted = await this.adminService.deleteAllUserHistory();
    if (E.isLeft(isDeleted)) throwErr(isDeleted.left);
    return true;
  }

  /* Subscriptions */

  @Subscription(() => InvitedUser, {
    description: 'Listen for User Invitation',
    resolve: (value) => value,
  })
  @SkipThrottle()
  @UseGuards(GqlAuthGuard, GqlAdminGuard)
  userInvited(@GqlUser() admin: AuthUser) {
    return this.pubsub.asyncIterator(`admin/${admin.uid}/invited`);
  }
}
