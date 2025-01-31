import { Injectable, OnModuleInit } from '@nestjs/common';
import { TeamMember, TeamMemberRole, Team } from './team.model';
import { PrismaService } from '../prisma/prisma.service';
import { TeamMember as DbTeamMember } from '@prisma/client';
import { UserService } from '../user/user.service';
import { UserDataHandler } from 'src/user/user.data.handler';
import {
  TEAM_NAME_INVALID,
  TEAM_ONLY_ONE_OWNER,
  USER_NOT_FOUND,
  TEAM_INVALID_ID,
  TEAM_INVALID_ID_OR_USER,
  TEAM_MEMBER_NOT_FOUND,
  USER_IS_OWNER,
} from '../errors';
import { PubSubService } from '../pubsub/pubsub.service';
import { flow, pipe } from 'fp-ts/function';
import * as TO from 'fp-ts/TaskOption';
import * as O from 'fp-ts/Option';
import * as E from 'fp-ts/Either';
import * as T from 'fp-ts/Task';
import * as A from 'fp-ts/Array';
import { throwErr } from 'src/utils';
import { AuthUser } from '../types/AuthUser';

@Injectable()
export class TeamService implements UserDataHandler, OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    private readonly userService: UserService,
    private readonly pubsub: PubSubService,
  ) {}

  onModuleInit() {
    this.userService.registerUserDataHandler(this);
  }

  canAllowUserDeletion(user: AuthUser): TO.TaskOption<string> {
    return pipe(
      this.isUserSoleOwnerInAnyTeam(user.uid),
      TO.fromTask,
      TO.chain((isOwner) => (isOwner ? TO.some(USER_IS_OWNER) : TO.none)),
    );
  }

  onUserDelete(user: AuthUser): T.Task<void> {
    return this.deleteUserFromAllTeams(user.uid);
  }

  async getCountOfUsersWithRoleInTeam(
    teamID: string,
    role: TeamMemberRole,
  ): Promise<number> {
    return await this.prisma.teamMember.count({
      where: {
        teamID,
        role,
      },
    });
  }

  async addMemberToTeamWithEmail(
    teamID: string,
    email: string,
    role: TeamMemberRole,
  ): Promise<E.Left<string> | E.Right<TeamMember>> {
    const user = await this.userService.findUserByEmail(email);
    if (O.isNone(user)) return E.left(USER_NOT_FOUND);

    const teamMember = await this.addMemberToTeam(teamID, user.value.uid, role);
    return E.right(teamMember);
  }

  async addMemberToTeam(
    teamID: string,
    uid: string,
    role: TeamMemberRole,
  ): Promise<TeamMember> {
    const teamMember = await this.prisma.teamMember.create({
      data: {
        userUid: uid,
        team: {
          connect: {
            id: teamID,
          },
        },
        role: role,
      },
    });

    const member: TeamMember = {
      membershipID: teamMember.id,
      userUid: teamMember.userUid,
      role: TeamMemberRole[teamMember.role],
    };

    this.pubsub.publish(`team/${teamID}/member_added`, member);

    return member;
  }

  async deleteTeam(teamID: string): Promise<E.Left<string> | E.Right<boolean>> {
    const team = await this.prisma.team.findUnique({
      where: {
        id: teamID,
      },
    });
    if (!team) return E.left(TEAM_INVALID_ID);

    await this.prisma.teamMember.deleteMany({
      where: {
        teamID: teamID,
      },
    });

    await this.prisma.team.delete({
      where: {
        id: teamID,
      },
    });

    return E.right(true);
  }

  validateTeamName(title: string): E.Left<string> | E.Right<boolean> {
    if (!title || title.length < 6) return E.left(TEAM_NAME_INVALID);
    return E.right(true);
  }

  async renameTeam(
    teamID: string,
    newName: string,
  ): Promise<E.Left<string> | E.Right<Team>> {
    const isValidTitle = this.validateTeamName(newName);
    if (E.isLeft(isValidTitle)) return isValidTitle;

    try {
      const updatedTeam = await this.prisma.team.update({
        where: {
          id: teamID,
        },
        data: {
          name: newName,
        },
      });
      return E.right(updatedTeam);
    } catch (e) {
      // Prisma update errors out if it can't find the record
      return E.left(TEAM_INVALID_ID);
    }
  }

  async updateTeamMemberRole(
    teamID: string,
    userUid: string,
    newRole: TeamMemberRole,
  ): Promise<E.Left<string> | E.Right<TeamMember>> {
    const ownerCount = await this.prisma.teamMember.count({
      where: {
        teamID,
        role: TeamMemberRole.OWNER,
      },
    });

    const member = await this.prisma.teamMember.findUnique({
      where: {
        teamID_userUid: {
          teamID,
          userUid,
        },
      },
    });

    if (!member) return E.left(TEAM_MEMBER_NOT_FOUND);
    if (
      member.role === TeamMemberRole.OWNER &&
      newRole != TeamMemberRole.OWNER &&
      ownerCount === 1
    ) {
      return E.left(TEAM_ONLY_ONE_OWNER);
    }

    const result = await this.prisma.teamMember.update({
      where: {
        teamID_userUid: {
          teamID,
          userUid,
        },
      },
      data: {
        role: newRole,
      },
    });

    const updatedMember: TeamMember = {
      membershipID: result.id,
      userUid: result.userUid,
      role: TeamMemberRole[result.role],
    };

    this.pubsub.publish(`team/${teamID}/member_updated`, updatedMember);

    return E.right(updatedMember);
  }

  async leaveTeam(
    teamID: string,
    userUid: string,
  ): Promise<E.Left<string> | E.Right<boolean>> {
    const ownerCount = await this.prisma.teamMember.count({
      where: {
        teamID,
        role: TeamMemberRole.OWNER,
      },
    });

    const member = await this.getTeamMember(teamID, userUid);
    if (!member) return E.left(TEAM_INVALID_ID_OR_USER);

    if (ownerCount === 1 && member.role === TeamMemberRole.OWNER) {
      return E.left(TEAM_ONLY_ONE_OWNER);
    }

    try {
      await this.prisma.teamMember.delete({
        where: {
          teamID_userUid: {
            userUid,
            teamID,
          },
        },
      });
    } catch (e) {
      // Record not found
      return E.left(TEAM_INVALID_ID_OR_USER);
    }

    this.pubsub.publish(`team/${teamID}/member_removed`, userUid);

    return E.right(true);
  }

  async createTeam(
    name: string,
    creatorUid: string,
  ): Promise<E.Left<string> | E.Right<Team>> {
    const isValidName = this.validateTeamName(name);
    if (E.isLeft(isValidName)) return isValidName;

    const team = await this.prisma.team.create({
      data: {
        name: name,
        members: {
          create: {
            userUid: creatorUid,
            role: TeamMemberRole.OWNER,
          },
        },
      },
    });

    return E.right(team);
  }

  async getTeamsOfUser(uid: string, cursor: string | null): Promise<Team[]> {
    const entries = await this.prisma.teamMember.findMany({
      take: 10,
      skip: cursor ? 1 : 0,
      cursor: cursor
        ? {
            teamID_userUid: {
              teamID: cursor,
              userUid: uid,
            },
          }
        : undefined,
      where: {
        userUid: uid,
      },
      include: {
        team: true,
      },
    });
    return entries.map((entry) => entry.team);
  }

  async getTeamWithID(teamID: string): Promise<Team | null> {
    try {
      const team = await this.prisma.team.findUnique({
        where: {
          id: teamID,
        },
      });

      return team;
    } catch (_e) {
      return null;
    }
  }

  /**
   * Filters out team members that we weren't able to match
   * (also deletes the membership)
   * @param members Members to filter against
   */
  async filterMismatchedUsers(
    teamID: string,
    members: TeamMember[],
  ): Promise<TeamMember[]> {
    const memberUsers = await Promise.all(
      members.map(async (member) => {
        const user = await this.userService.findUserById(member.userUid);

        // // TODO:Investigate if a race condition exists that deletes user from teams.
        // // Delete the membership if the user doesnt exist
        // if (!user) this.leaveTeam(teamID, member.userUid);

        if (O.isSome(user)) return member;
        else return null;
      }),
    );

    return memberUsers.filter((x) => x !== null) as TeamMember[];
  }

  async getTeamMember(
    teamID: string,
    userUid: string,
  ): Promise<TeamMember | null> {
    try {
      const teamMember = await this.prisma.teamMember.findUnique({
        where: {
          teamID_userUid: {
            teamID,
            userUid,
          },
        },
      });

      if (!teamMember) return null;

      return <TeamMember>{
        membershipID: teamMember.id,
        userUid: userUid,
        role: TeamMemberRole[teamMember.role],
      };
    } catch (e) {
      return null;
    }
  }

  async getRoleOfUserInTeam(
    teamID: string,
    userUid: string,
  ): Promise<TeamMemberRole | null> {
    const teamMember = await this.getTeamMember(teamID, userUid);
    return teamMember ? teamMember.role : null;
  }

  isUserSoleOwnerInAnyTeam(uid: string): T.Task<boolean> {
    return async () => {
      // Find all teams where the user is an OWNER
      const userOwnedTeams = await this.prisma.teamMember.findMany({
        where: {
          userUid: uid,
          role: TeamMemberRole.OWNER,
        },
        select: {
          teamID: true,
        },
      });

      for (const userOwnedTeam of userOwnedTeams) {
        const ownerCount = await this.prisma.teamMember.count({
          where: {
            teamID: userOwnedTeam.teamID,
            role: TeamMemberRole.OWNER,
          },
        });

        // early return true if the user is the sole owner
        if (ownerCount === 1) return true;
      }

      // return false if the user is not the sole owner in any team
      return false;
    };
  }

  deleteUserFromAllTeams(uid: string) {
    return pipe(
      () =>
        this.prisma.teamMember.findMany({
          where: {
            userUid: uid,
          },
        }),
      T.chainFirst(
        flow(
          A.map((member) => async () => {
            const res = await this.leaveTeam(member.teamID, uid);
            if (E.isLeft(res)) throwErr(res.left);
            return E.right(res);
          }),
          T.sequenceArray,
        ),
      ),
      T.map(() => undefined),
    );
  }

  async getTeamMembers(teamID: string): Promise<TeamMember[]> {
    const dbTeamMembers = await this.prisma.teamMember.findMany({
      where: {
        teamID,
      },
    });

    const members = dbTeamMembers.map(
      (entry) =>
        <TeamMember>{
          membershipID: entry.id,
          userUid: entry.userUid,
          role: TeamMemberRole[entry.role],
        },
    );

    return this.filterMismatchedUsers(teamID, members);
  }

  /**
   * Get a count of members in a team
   * @param teamID Team ID
   * @returns a count of members in a team
   */
  async getCountOfMembersInTeam(teamID: string) {
    const memberCount = await this.prisma.teamMember.count({
      where: {
        teamID: teamID,
      },
    });

    return memberCount;
  }

  async getMembersOfTeam(
    teamID: string,
    cursor: string | null,
  ): Promise<TeamMember[]> {
    let teamMembers: DbTeamMember[];

    teamMembers = await this.prisma.teamMember.findMany({
      take: 10,
      skip: cursor ? 1 : 0,
      cursor: cursor ? { id: cursor } : undefined,
      where: { teamID },
    });

    const members = teamMembers.map(
      (entry) =>
        <TeamMember>{
          membershipID: entry.id,
          userUid: entry.userUid,
          role: TeamMemberRole[entry.role],
        },
    );

    return this.filterMismatchedUsers(teamID, members);
  }

  /**
   * Fetch all the teams in the `Team` table based on cursor
   * @param cursorID string of teamID or undefined
   * @param take number of items to query
   * @returns an array of `Team` object
   */
  async fetchAllTeams(cursorID: string, take: number) {
    const options = {
      skip: cursorID ? 1 : 0,
      take: take,
      cursor: cursorID ? { id: cursorID } : undefined,
    };

    const fetchedTeams = await this.prisma.team.findMany(options);
    return fetchedTeams;
  }

  /**
   * Fetch list of all the Teams in the DB
   *
   * @returns number of teams in the org
   */
  async getTeamsCount() {
    const teamsCount = await this.prisma.team.count();
    return teamsCount;
  }
}
