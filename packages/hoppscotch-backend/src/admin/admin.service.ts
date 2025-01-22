import { Injectable } from '@nestjs/common';
import { UserService } from '../user/user.service';
import { PubSubService } from '../pubsub/pubsub.service';
import { PrismaService } from '../prisma/prisma.service';
import * as E from 'fp-ts/Either';
import * as O from 'fp-ts/Option';
import { validateEmail } from '../utils';
import {
  ADMIN_CAN_NOT_BE_DELETED,
  DUPLICATE_EMAIL,
  EMAIL_FAILED,
  INVALID_EMAIL,
  ONLY_ONE_ADMIN_ACCOUNT,
  TEAM_INVITE_ALREADY_MEMBER,
  TEAM_INVITE_NO_INVITE_FOUND,
  USERS_NOT_FOUND,
  USER_ALREADY_INVITED,
  USER_INVITATION_DELETION_FAILED,
  USER_IS_ADMIN,
  USER_NOT_FOUND,
} from '../errors';
import { MailerService } from '../mailer/mailer.service';
import { InvitedUser } from './invited-user.model';
import { TeamService } from '../team/team.service';
import { TeamCollectionService } from '../team-collection/team-collection.service';
import { TeamRequestService } from '../team-request/team-request.service';
import { TeamEnvironmentsService } from '../team-environments/team-environments.service';
import { TeamInvitationService } from '../team-invitation/team-invitation.service';
import { TeamMemberRole } from '../team/team.model';
import { ShortcodeService } from 'src/shortcode/shortcode.service';
import { ConfigService } from '@nestjs/config';
import { OffsetPaginationArgs } from 'src/types/input-types.args';
import { UserDeletionResult } from 'src/user/user.model';
import { UserHistoryService } from 'src/user-history/user-history.service';

@Injectable()
export class AdminService {
  constructor(
    private readonly userService: UserService,
    private readonly teamService: TeamService,
    private readonly teamCollectionService: TeamCollectionService,
    private readonly teamRequestService: TeamRequestService,
    private readonly teamEnvironmentsService: TeamEnvironmentsService,
    private readonly teamInvitationService: TeamInvitationService,
    private readonly pubsub: PubSubService,
    private readonly prisma: PrismaService,
    private readonly mailerService: MailerService,
    private readonly shortcodeService: ShortcodeService,
    private readonly configService: ConfigService,
    private readonly userHistoryService: UserHistoryService,
  ) {}

  /**
   * Fetch all the users in the infra.
   * @param cursorID Users uid
   * @param take number of users to fetch
   * @returns an Either of array of user or error
   * @deprecated use fetchUsersV2 instead
   */
  async fetchUsers(cursorID: string, take: number) {
    const allUsers = await this.userService.fetchAllUsers(cursorID, take);
    return allUsers;
  }

  /**
   * Fetch all the users in the infra.
   * @param searchString search on users displayName or email
   * @param paginationOption pagination options
   * @returns an Either of array of user or error
   */
  async fetchUsersV2(
    searchString: string,
    paginationOption: OffsetPaginationArgs,
  ) {
    const allUsers = await this.userService.fetchAllUsersV2(
      searchString,
      paginationOption,
    );
    return allUsers;
  }

  /**
   * Invite a user to join the infra.
   * @param adminUID Admin's UID
   * @param adminEmail Admin's email
   * @param inviteeEmail Invitee's email
   * @returns an Either of `InvitedUser` object or error
   */
  async inviteUserToSignInViaEmail(
    adminUID: string,
    adminEmail: string,
    inviteeEmail: string,
  ) {
    if (inviteeEmail.toLowerCase() == adminEmail.toLowerCase()) {
      return E.left(DUPLICATE_EMAIL);
    }
    if (!validateEmail(inviteeEmail)) return E.left(INVALID_EMAIL);

    const alreadyInvitedUser = await this.prisma.invitedUsers.findFirst({
      where: {
        inviteeEmail: {
          equals: inviteeEmail,
          mode: 'insensitive',
        },
      },
    });
    if (alreadyInvitedUser != null) return E.left(USER_ALREADY_INVITED);

    try {
      await this.mailerService.sendUserInvitationEmail(inviteeEmail, {
        template: 'user-invitation',
        variables: {
          inviteeEmail: inviteeEmail,
          magicLink: `${this.configService.get('VITE_BASE_URL')}`,
        },
      });
    } catch (e) {
      return E.left(EMAIL_FAILED);
    }

    // Add invitee email to the list of invited users by admin
    const dbInvitedUser = await this.prisma.invitedUsers.create({
      data: {
        adminUid: adminUID,
        adminEmail: adminEmail,
        inviteeEmail: inviteeEmail,
      },
    });

    const invitedUser = <InvitedUser>{
      adminEmail: dbInvitedUser.adminEmail,
      adminUid: dbInvitedUser.adminUid,
      inviteeEmail: dbInvitedUser.inviteeEmail,
      invitedOn: dbInvitedUser.invitedOn,
    };

    // Publish invited user subscription
    await this.pubsub.publish(`admin/${adminUID}/invited`, invitedUser);

    return E.right(invitedUser);
  }

  /**
   * Update the display name of a user
   * @param userUid Who's display name is being updated
   * @param displayName New display name of the user
   * @returns an Either of boolean or error
   */
  async updateUserDisplayName(userUid: string, displayName: string) {
    const updatedUser = await this.userService.updateUserDisplayName(
      userUid,
      displayName,
    );
    if (E.isLeft(updatedUser)) return E.left(updatedUser.left);

    return E.right(true);
  }

  /**
   * Revoke infra level user invitations
   * @param inviteeEmails Invitee's emails
   * @param adminUid Admin Uid
   * @returns an Either of boolean or error string
   */
  async revokeUserInvitations(inviteeEmails: string[]) {
    const areAllEmailsValid = inviteeEmails.every((email) =>
      validateEmail(email),
    );
    if (!areAllEmailsValid) {
      return E.left(INVALID_EMAIL);
    }

    try {
      await this.prisma.invitedUsers.deleteMany({
        where: {
          inviteeEmail: { in: inviteeEmails, mode: 'insensitive' },
        },
      });
      return E.right(true);
    } catch (error) {
      return E.left(USER_INVITATION_DELETION_FAILED);
    }
  }

  /**
   * Fetch the list of invited users by the admin.
   * @returns an Either of array of `InvitedUser` object or error
   */
  async fetchInvitedUsers(paginationOption: OffsetPaginationArgs) {
    const userEmailObjs = await this.prisma.user.findMany({
      select: {
        email: true,
      },
    });

    const pendingInvitedUsers = await this.prisma.invitedUsers.findMany({
      take: paginationOption.take,
      skip: paginationOption.skip,
      orderBy: {
        invitedOn: 'desc',
      },
      where: {
        NOT: {
          inviteeEmail: {
            in: userEmailObjs.map((user) => user.email),
            mode: 'insensitive',
          },
        },
      },
    });

    const users: InvitedUser[] = pendingInvitedUsers.map(
      (user) => <InvitedUser>{ ...user },
    );

    return users;
  }

  /**
   * Fetch all the teams in the infra.
   * @param cursorID team id
   * @param take number of items to fetch
   * @returns an array of teams
   */
  async fetchAllTeams(cursorID: string, take: number) {
    const allTeams = await this.teamService.fetchAllTeams(cursorID, take);
    return allTeams;
  }

  /**
   * Fetch the count of all the members in a team.
   * @param teamID team id
   * @returns a count of team members
   */
  async membersCountInTeam(teamID: string) {
    const teamMembersCount =
      await this.teamService.getCountOfMembersInTeam(teamID);
    return teamMembersCount;
  }

  /**
   * Fetch count of all the collections in a team.
   * @param teamID team id
   * @returns a of count of collections
   */
  async collectionCountInTeam(teamID: string) {
    const teamCollectionsCount =
      await this.teamCollectionService.totalCollectionsInTeam(teamID);
    return teamCollectionsCount;
  }

  /**
   * Fetch the count of all the requests in a team.
   * @param teamID team id
   * @returns a count of total requests in a team
   */
  async requestCountInTeam(teamID: string) {
    const teamRequestsCount =
      await this.teamRequestService.totalRequestsInATeam(teamID);

    return teamRequestsCount;
  }

  /**
   * Fetch the count of all the environments in a team.
   * @param teamID team id
   * @returns a count of environments in a team
   */
  async environmentCountInTeam(teamID: string) {
    const envCount = await this.teamEnvironmentsService.totalEnvsInTeam(teamID);
    return envCount;
  }

  /**
   * Fetch all the invitations for a given team.
   * @param teamID team id
   * @returns an array team invitations
   */
  async pendingInvitationCountInTeam(teamID: string) {
    const invitations =
      await this.teamInvitationService.getTeamInvitations(teamID);

    return invitations;
  }

  /**
   * Change the role of a user in a team
   * @param userUid users uid
   * @param teamID team id
   * @returns an Either of updated `TeamMember` object or error
   */
  async changeRoleOfUserTeam(
    userUid: string,
    teamID: string,
    newRole: TeamMemberRole,
  ) {
    const updatedTeamMember = await this.teamService.updateTeamMemberRole(
      teamID,
      userUid,
      newRole,
    );

    if (E.isLeft(updatedTeamMember)) return E.left(updatedTeamMember.left);

    return E.right(updatedTeamMember.right);
  }

  /**
   * Remove the user from a team
   * @param userUid users uid
   * @param teamID team id
   * @returns an Either of boolean or error
   */
  async removeUserFromTeam(userUid: string, teamID: string) {
    const removedUser = await this.teamService.leaveTeam(teamID, userUid);
    if (E.isLeft(removedUser)) return E.left(removedUser.left);

    return E.right(removedUser.right);
  }

  /**
   * Add the user to a team
   * @param teamID team id
   * @param userEmail users email
   * @param role team member role for the user
   * @returns an Either of boolean or error
   */
  async addUserToTeam(teamID: string, userEmail: string, role: TeamMemberRole) {
    if (!validateEmail(userEmail)) return E.left(INVALID_EMAIL);

    const user = await this.userService.findUserByEmail(userEmail);
    if (O.isNone(user)) return E.left(USER_NOT_FOUND);

    const teamMember = await this.teamService.getTeamMemberTE(
      teamID,
      user.value.uid,
    )();
    if (E.isLeft(teamMember)) {
      const addedUser = await this.teamService.addMemberToTeamWithEmail(
        teamID,
        userEmail,
        role,
      );
      if (E.isLeft(addedUser)) return E.left(addedUser.left);

      const userInvitation =
        await this.teamInvitationService.getTeamInviteByEmailAndTeamID(
          userEmail,
          teamID,
        );

      if (E.isRight(userInvitation)) {
        await this.teamInvitationService.revokeInvitation(
          userInvitation.right.id,
        );
      }

      return E.right(addedUser.right);
    }

    return E.left(TEAM_INVITE_ALREADY_MEMBER);
  }

  /**
   * Create a new team
   * @param userUid user uid
   * @param name team name
   * @returns an Either of `Team` object or error
   */
  async createATeam(userUid: string, name: string) {
    const validUser = await this.userService.findUserById(userUid);
    if (O.isNone(validUser)) return E.left(USER_NOT_FOUND);

    const createdTeam = await this.teamService.createTeam(name, userUid);
    if (E.isLeft(createdTeam)) return E.left(createdTeam.left);

    return E.right(createdTeam.right);
  }

  /**
   * Renames a team
   * @param teamID team ID
   * @param newName new team name
   * @returns an Either of `Team` object or error
   */
  async renameATeam(teamID: string, newName: string) {
    const renamedTeam = await this.teamService.renameTeam(teamID, newName);
    if (E.isLeft(renamedTeam)) return E.left(renamedTeam.left);

    return E.right(renamedTeam.right);
  }

  /**
   * Deletes a team
   * @param teamID team ID
   * @returns an Either of boolean or error
   */
  async deleteATeam(teamID: string) {
    const deleteTeam = await this.teamService.deleteTeam(teamID);
    if (E.isLeft(deleteTeam)) return E.left(deleteTeam.left);

    return E.right(deleteTeam.right);
  }

  /**
   * Fetch all admin accounts
   * @returns an array of admin users
   */
  async fetchAdmins() {
    const admins = this.userService.fetchAdminUsers();
    return admins;
  }

  /**
   * Fetch a user by UID
   * @param userUid User UID
   * @returns an Either of `User` obj or error
   */
  async fetchUserInfo(userUid: string) {
    const user = await this.userService.findUserById(userUid);
    if (O.isNone(user)) return E.left(USER_NOT_FOUND);

    return E.right(user.value);
  }

  /**
   * Remove a user account by UID
   * @param userUid User UID
   * @returns an Either of boolean or error
   *
   */
  async removeUserAccount(userUid: string) {
    const user = await this.userService.findUserById(userUid);
    if (O.isNone(user)) return E.left(USER_NOT_FOUND);

    if (user.value.isAdmin) return E.left(USER_IS_ADMIN);

    const delUser = await this.userService.deleteUserByUID(user.value)();
    if (E.isLeft(delUser)) return E.left(delUser.left);
    return E.right(delUser.right);
  }

  /**
   * Remove user (not Admin) accounts by UIDs
   * @param userUIDs User UIDs
   * @returns an Either of boolean or error
   */
  async removeUserAccounts(userUIDs: string[]) {
    const userDeleteResult: UserDeletionResult[] = [];

    // step 1: fetch all users
    const allUsersList = await this.userService.findUsersByIds(userUIDs);
    if (allUsersList.length === 0) return E.left(USERS_NOT_FOUND);

    // step 2: admin user can not be deleted without removing admin status/role
    allUsersList.forEach((user) => {
      if (user.isAdmin) {
        userDeleteResult.push({
          userUID: user.uid,
          isDeleted: false,
          errorMessage: ADMIN_CAN_NOT_BE_DELETED,
        });
      }
    });

    const nonAdminUsers = allUsersList.filter((user) => !user.isAdmin);
    let deletedUserEmails: string[] = [];

    // step 3: delete non-admin users
    const deletionPromises = nonAdminUsers.map((user) => {
      return this.userService
        .deleteUserByUID(user)()
        .then((res) => {
          if (E.isLeft(res)) {
            return {
              userUID: user.uid,
              isDeleted: false,
              errorMessage: res.left,
            } as UserDeletionResult;
          }

          deletedUserEmails.push(user.email);
          return {
            userUID: user.uid,
            isDeleted: true,
            errorMessage: null,
          } as UserDeletionResult;
        });
    });
    const promiseResult = await Promise.allSettled(deletionPromises);

    // step 4: revoke all the invites sent to the deleted users
    await this.revokeUserInvitations(deletedUserEmails);

    // step 5: return the result
    promiseResult.forEach((result) => {
      if (result.status === 'fulfilled') {
        userDeleteResult.push(result.value);
      }
    });

    return E.right(userDeleteResult);
  }

  /**
   * Make a user an admin
   * @param userUid User UID
   * @returns an Either of boolean or error
   * @deprecated use makeUsersAdmin instead
   */
  async makeUserAdmin(userUID: string) {
    const admin = await this.userService.makeAdmin(userUID);
    if (E.isLeft(admin)) return E.left(admin.left);
    return E.right(true);
  }

  /**
   * Make users to admin
   * @param userUid User UIDs
   * @returns an Either of boolean or error
   */
  async makeUsersAdmin(userUIDs: string[]) {
    const isUpdated = await this.userService.makeAdmins(userUIDs);
    if (E.isLeft(isUpdated)) return E.left(isUpdated.left);
    return E.right(true);
  }

  /**
   * Remove user as admin
   * @param userUid User UID
   * @returns an Either of boolean or error
   * @deprecated use demoteUsersByAdmin instead
   */
  async removeUserAsAdmin(userUID: string) {
    const adminUsers = await this.userService.fetchAdminUsers();
    if (adminUsers.length === 1) return E.left(ONLY_ONE_ADMIN_ACCOUNT);

    const admin = await this.userService.removeUserAsAdmin(userUID);
    if (E.isLeft(admin)) return E.left(admin.left);
    return E.right(true);
  }

  /**
   * Remove users as admin
   * @param userUIDs User UIDs
   * @returns an Either of boolean or error
   */
  async demoteUsersByAdmin(userUIDs: string[]) {
    const adminUsers = await this.userService.fetchAdminUsers();

    const remainingAdmins = adminUsers.filter(
      (adminUser) => !userUIDs.includes(adminUser.uid),
    );
    if (remainingAdmins.length < 1) {
      return E.left(ONLY_ONE_ADMIN_ACCOUNT);
    }

    const isUpdated = await this.userService.removeUsersAsAdmin(userUIDs);
    if (E.isLeft(isUpdated)) return E.left(isUpdated.left);
    return E.right(isUpdated.right);
  }

  /**
   * Fetch list of all the Users in org
   * @returns number of users in the org
   */
  async getUsersCount() {
    const usersCount = this.userService.getUsersCount();
    return usersCount;
  }

  /**
   * Fetch list of all the Teams in org
   * @returns number of users in the org
   */
  async getTeamsCount() {
    const teamsCount = this.teamService.getTeamsCount();
    return teamsCount;
  }

  /**
   * Fetch list of all the Team Collections in org
   * @returns number of users in the org
   */
  async getTeamCollectionsCount() {
    const teamCollectionCount =
      this.teamCollectionService.getTeamCollectionsCount();
    return teamCollectionCount;
  }

  /**
   * Fetch list of all the Team Requests in org
   * @returns number of users in the org
   */
  async getTeamRequestsCount() {
    const teamRequestCount = this.teamRequestService.getTeamRequestsCount();
    return teamRequestCount;
  }

  /**
   * Get team info by ID
   * @param teamID Team ID
   * @returns an Either of `Team` or error
   */
  async getTeamInfo(teamID: string) {
    const team = await this.teamService.getTeamWithIDTE(teamID)();
    if (E.isLeft(team)) return E.left(team.left);
    return E.right(team.right);
  }

  /**
   * Revoke a team invite by ID
   * @param inviteID Team Invite ID
   * @returns an Either of boolean or error
   */
  async revokeTeamInviteByID(inviteID: string) {
    const teamInvite =
      await this.teamInvitationService.revokeInvitation(inviteID);

    if (E.isLeft(teamInvite)) return E.left(teamInvite.left);

    return E.right(teamInvite.right);
  }

  /**
   * Fetch all created ShortCodes
   *
   * @param args Pagination arguments
   * @param userEmail User email
   * @returns ShortcodeWithUserEmail
   */
  async fetchAllShortcodes(
    cursorID: string,
    take: number,
    userEmail: string = null,
  ) {
    return this.shortcodeService.fetchAllShortcodes(
      { cursor: cursorID, take },
      userEmail,
    );
  }

  /**
   * Delete a Shortcode
   *
   * @param shortcodeID ID of Shortcode being deleted
   * @returns Boolean on successful deletion
   */
  async deleteShortcode(shortcodeID: string) {
    const result = await this.shortcodeService.deleteShortcode(shortcodeID);

    if (E.isLeft(result)) return E.left(result.left);
    return E.right(result.right);
  }

  /**
   * Delete all user history
   * @returns Boolean on successful deletion
   */
  async deleteAllUserHistory() {
    const result = await this.userHistoryService.deleteAllHistories();

    if (E.isLeft(result)) return E.left(result.left);
    return E.right(result.right);
  }
}
