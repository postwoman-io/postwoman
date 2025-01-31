import { TeamService } from './team.service';
import { PrismaService } from '../prisma/prisma.service';
import { Team, TeamMember, TeamMemberRole } from './team.model';
import { TeamMember as DbTeamMember } from '@prisma/client';
import {
  USER_NOT_FOUND,
  TEAM_INVALID_ID,
  TEAM_NAME_INVALID,
  TEAM_ONLY_ONE_OWNER,
  TEAM_INVALID_ID_OR_USER,
} from '../errors';
import { mockDeep, mockReset } from 'jest-mock-extended';
import * as O from 'fp-ts/Option';
import { skip } from 'rxjs';

const mockPrisma = mockDeep<PrismaService>();

const mockUserService = {
  findUserByEmail: jest.fn(),
  getUserForUID: jest.fn(),
  authenticateWithIDToken: jest.fn(),
};

const mockPubSub = {
  publish: jest.fn().mockResolvedValue(null),
};

const teamService = new TeamService(
  mockPrisma as any,
  mockUserService as any,
  mockPubSub as any,
);

beforeEach(async () => {
  mockReset(mockPrisma);
});

const team: Team = {
  id: 'teamID',
  name: 'teamName',
};

const teams: Team[] = [
  {
    id: 'teamID',
    name: 'teamName',
  },
  {
    id: 'teamID2',
    name: 'teamName2',
  },
];
const dbTeamMember: DbTeamMember = {
  id: 'teamMemberID',
  role: TeamMemberRole.VIEWER,
  userUid: 'userUid',
  teamID: team.id,
};
const teamMember: TeamMember = {
  membershipID: dbTeamMember.id,
  role: TeamMemberRole[dbTeamMember.role],
  userUid: dbTeamMember.userUid,
};

describe('getCountOfUsersWithRoleInTeam', () => {
  test('resolves to the correct count of owners in a team', async () => {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    mockPrisma.teamMember.count.mockResolvedValue(2);

    await expect(
      teamService.getCountOfUsersWithRoleInTeam(
        dbTeamMember.teamID,
        TeamMemberRole.OWNER,
      ),
    ).resolves.toEqual(2);

    expect(mockPrisma.teamMember.count).toHaveBeenCalledWith({
      where: {
        teamID: dbTeamMember.teamID,
        role: TeamMemberRole.OWNER,
      },
    });
  });

  test('resolves to the correct count of viewers in a team', async () => {
    mockPrisma.teamMember.count.mockResolvedValue(2);

    await expect(
      teamService.getCountOfUsersWithRoleInTeam(
        dbTeamMember.teamID,
        TeamMemberRole.VIEWER,
      ),
    ).resolves.toEqual(2);

    expect(mockPrisma.teamMember.count).toHaveBeenCalledWith({
      where: {
        teamID: dbTeamMember.teamID,
        role: TeamMemberRole.VIEWER,
      },
    });
  });

  test('resolves to the correct count of editors in a team', async () => {
    mockPrisma.teamMember.count.mockResolvedValue(2);

    await expect(
      teamService.getCountOfUsersWithRoleInTeam(
        dbTeamMember.teamID,
        TeamMemberRole.EDITOR,
      ),
    ).resolves.toEqual(2);

    expect(mockPrisma.teamMember.count).toHaveBeenCalledWith({
      where: {
        teamID: dbTeamMember.teamID,
        role: TeamMemberRole.EDITOR,
      },
    });
  });
});

describe('addMemberToTeam', () => {
  test('resolves when proper team id is given', () => {
    mockPrisma.teamMember.create.mockResolvedValue(dbTeamMember);

    expect(
      teamService.addMemberToTeam(
        dbTeamMember.teamID,
        dbTeamMember.userUid,
        TeamMemberRole[dbTeamMember.role],
      ),
    ).resolves.toEqual(expect.objectContaining(teamMember));
  });

  test('makes the update in the database', async () => {
    mockPrisma.teamMember.create.mockResolvedValue(dbTeamMember);

    await teamService.addMemberToTeam(
      dbTeamMember.teamID,
      dbTeamMember.userUid,
      TeamMemberRole[dbTeamMember.role],
    );

    expect(mockPrisma.teamMember.create).toHaveBeenCalledWith({
      data: {
        userUid: dbTeamMember.userUid,
        team: {
          connect: {
            id: dbTeamMember.teamID,
          },
        },
        role: TeamMemberRole[dbTeamMember.role],
      },
    });
  });

  test('fires "team/<team_id>/member_added" pubsub message with correct payload', async () => {
    mockPrisma.teamMember.create.mockResolvedValue(dbTeamMember);

    const member = await teamService.addMemberToTeam(
      dbTeamMember.teamID,
      dbTeamMember.userUid,
      TeamMemberRole[dbTeamMember.role],
    );

    expect(mockPubSub.publish).toHaveBeenCalledWith(
      `team/${dbTeamMember.teamID}/member_added`,
      member,
    );
  });
});

describe('addMemberToTeamWithEmail', () => {
  afterEach(() => {
    mockUserService.findUserByEmail.mockClear();
    mockUserService.authenticateWithIDToken.mockClear();
    mockUserService.authenticateWithIDToken.mockClear();
  });

  test('resolves when user with email exists', () => {
    mockUserService.findUserByEmail.mockResolvedValueOnce(
      O.some({
        uid: dbTeamMember.userUid,
      }),
    );
    mockPrisma.teamMember.create.mockResolvedValue(dbTeamMember);

    const result = teamService.addMemberToTeamWithEmail(
      dbTeamMember.teamID,
      'test@hoppscotch.io',
      TeamMemberRole[dbTeamMember.role],
    );
    return expect(result).resolves.toBeDefined();
  });

  test("rejects with user with email doesn't exist with USER_NOT_FOUND", () => {
    mockUserService.findUserByEmail.mockResolvedValue(O.none);

    const result = teamService.addMemberToTeamWithEmail(
      dbTeamMember.teamID,
      'test@hoppscotch.io',
      TeamMemberRole[dbTeamMember.role],
    );
    return expect(result).resolves.toEqualLeft(USER_NOT_FOUND);
  });

  test('makes update in the database', async () => {
    mockUserService.findUserByEmail.mockResolvedValueOnce(
      O.some({
        uid: dbTeamMember.userUid,
      }),
    );
    mockPrisma.teamMember.create.mockResolvedValue(dbTeamMember);

    await teamService.addMemberToTeamWithEmail(
      dbTeamMember.teamID,
      'test@hoppscotch.io',
      TeamMemberRole[dbTeamMember.role],
    );

    expect(mockPrisma.teamMember.create).toHaveBeenCalledWith({
      data: {
        userUid: dbTeamMember.userUid,
        team: {
          connect: {
            id: dbTeamMember.teamID,
          },
        },
        role: TeamMemberRole[dbTeamMember.role],
      },
    });
  });

  test('fires "team/<team_id>/member_added" pubsub message with correct payload', async () => {
    mockUserService.findUserByEmail.mockResolvedValueOnce(
      O.some({
        uid: dbTeamMember.userUid,
      }),
    );
    mockPrisma.teamMember.create.mockResolvedValue(dbTeamMember);

    await teamService.addMemberToTeamWithEmail(
      dbTeamMember.teamID,
      'test@hoppscotch.io',
      TeamMemberRole[dbTeamMember.role],
    );

    expect(mockPubSub.publish).toHaveBeenCalledWith(
      `team/${dbTeamMember.teamID}/member_added`,
      teamMember,
    );
  });
});

describe('deleteTeam', () => {
  test('resolves for proper deletion', async () => {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    mockPrisma.team.findUnique.mockResolvedValue(team);
    mockPrisma.teamMember.deleteMany.mockResolvedValue({
      count: 10,
    });
    mockPrisma.team.delete.mockResolvedValue(team);

    const result = await teamService.deleteTeam(team.id);
    return expect(result).toEqualRight(true);
  });

  test('performs deletion on database', async () => {
    mockPrisma.team.findUnique.mockResolvedValue(team);
    mockPrisma.teamMember.deleteMany.mockResolvedValue({
      count: 10,
    });
    mockPrisma.team.delete.mockResolvedValue(team);

    await teamService.deleteTeam(team.id);

    expect(mockPrisma.team.delete).toHaveBeenCalledWith({
      where: {
        id: team.id,
      },
    });
  });

  test('rejects for invalid team id', async () => {
    mockPrisma.team.findUnique.mockResolvedValue(null);

    // If invalid team ID, team member deletes nothing (count 0)
    mockPrisma.teamMember.deleteMany.mockResolvedValue({
      count: 0,
    });

    // TODO: Confirm RecordNotFound works like this
    mockPrisma.team.delete.mockRejectedValue('RecordNotFound');

    // Team will not find and reject
    const result = await teamService.deleteTeam(team.id);
    return expect(result).toEqualLeft(TEAM_INVALID_ID);
  });
});

describe('renameTeam', () => {
  test('resolves for proper rename', () => {
    const newTeamName = 'Rename';

    mockPrisma.team.update.mockResolvedValue({
      ...team,
      name: newTeamName,
    });

    return expect(
      teamService.renameTeam(team.id, newTeamName),
    ).resolves.toBeDefined();
  });

  test('resolves with team structure', () => {
    const newTeamName = 'Rename';

    mockPrisma.team.update.mockResolvedValue({
      ...team,
      name: newTeamName,
    });

    return expect(
      teamService.renameTeam(team.id, newTeamName),
    ).resolves.toEqualRight(
      expect.objectContaining({
        ...team,
        name: newTeamName,
      }),
    );
  });

  test('performs rename on database', async () => {
    const newTeamName = 'Rename';

    mockPrisma.team.update.mockResolvedValue({
      ...team,
      name: newTeamName,
    });

    await teamService.renameTeam(team.id, newTeamName);

    expect(mockPrisma.team.update).toHaveBeenCalledWith({
      where: {
        id: team.id,
      },
      data: {
        name: newTeamName,
      },
    });
  });

  test('rejects for invalid team id with TEAM_INVALID_ID', () => {
    const newTeamName = 'Rename';
    // If invalid team id, update fails with RecordNotFound
    mockPrisma.team.update.mockRejectedValue('RecordNotFound');

    return expect(
      teamService.renameTeam(team.id, newTeamName),
    ).resolves.toEqualLeft(TEAM_INVALID_ID);
  });

  test('rejects for new team name length < 6 with TEAM_NAME_INVALID', () => {
    const newTeamName = 'smol';

    // Prisma doesn't care about the team name length, so it will resolve
    mockPrisma.team.update.mockResolvedValue({
      ...team,
      name: newTeamName,
    });

    return expect(
      teamService.renameTeam(team.id, newTeamName),
    ).resolves.toEqualLeft(TEAM_NAME_INVALID);
  });
});

describe('updateTeamMemberRole', () => {
  /**
   * Test Scenario:
   * 3 users (testuid1 thru 3) having each of the roles
   * (OWNER, VIEWER, EDITOR)
   * in Team with id 3170
   */

  test('updates the role', async () => {
    const newRole = TeamMemberRole.EDITOR;

    mockPrisma.teamMember.count.mockResolvedValue(1);
    mockPrisma.teamMember.findUnique.mockResolvedValue({
      ...dbTeamMember,
      role: TeamMemberRole[dbTeamMember.role],
    });
    mockPrisma.teamMember.update.mockResolvedValue({
      ...dbTeamMember,
      role: newRole,
    });

    await teamService.updateTeamMemberRole(
      dbTeamMember.teamID,
      dbTeamMember.userUid,
      newRole,
    );

    expect(mockPrisma.teamMember.update).toHaveBeenCalledWith({
      where: {
        teamID_userUid: {
          teamID: dbTeamMember.teamID,
          userUid: dbTeamMember.userUid,
        },
      },
      data: {
        role: newRole,
      },
    });
  });

  test('returns the updated details', () => {
    const newRole = TeamMemberRole.EDITOR;

    mockPrisma.teamMember.count.mockResolvedValue(1);
    mockPrisma.teamMember.findUnique.mockResolvedValue(dbTeamMember);
    mockPrisma.teamMember.update.mockResolvedValue({
      ...dbTeamMember,
      role: newRole,
    });

    return expect(
      teamService.updateTeamMemberRole(
        dbTeamMember.teamID,
        dbTeamMember.userUid,
        newRole,
      ),
    ).resolves.toEqualRight({ ...teamMember, role: newRole });
  });

  test('rejects if you change the status of the sole owner to non-owner status with TEAM_ONLY_ONE_OWNER', () => {
    mockPrisma.teamMember.count.mockResolvedValue(1);
    mockPrisma.teamMember.findUnique.mockResolvedValue({
      ...dbTeamMember,
      role: TeamMemberRole.OWNER,
    });

    // Prisma doesn't care if it goes through
    mockPrisma.teamMember.update.mockResolvedValue(dbTeamMember);

    return expect(
      teamService.updateTeamMemberRole(
        dbTeamMember.teamID,
        dbTeamMember.userUid,
        TeamMemberRole[dbTeamMember.role],
      ),
    ).resolves.toEqualLeft(TEAM_ONLY_ONE_OWNER);
  });

  test('resolves if you change the status of the sole owner to owner status (no change)', () => {
    mockPrisma.teamMember.count.mockResolvedValue(1);
    mockPrisma.teamMember.findUnique.mockResolvedValue({
      ...dbTeamMember,
      role: TeamMemberRole.OWNER,
    });
    mockPrisma.teamMember.update.mockResolvedValue({
      ...dbTeamMember,
      role: TeamMemberRole.OWNER,
    });

    return expect(
      teamService.updateTeamMemberRole(
        dbTeamMember.teamID,
        dbTeamMember.userUid,
        TeamMemberRole[TeamMemberRole.OWNER],
      ),
    ).resolves.toBeDefined();
  });

  test('resolves if you change the status of an owner but there are other owners', async () => {
    mockPrisma.teamMember.count.mockResolvedValue(2);
    mockPrisma.teamMember.findUnique.mockResolvedValue({
      ...dbTeamMember,
      role: TeamMemberRole.OWNER,
    });
    mockPrisma.teamMember.update.mockResolvedValue(dbTeamMember);

    // Set another user as the owner
    await teamService.updateTeamMemberRole(
      dbTeamMember.teamID,
      'testuid2',
      TeamMemberRole.OWNER,
    );

    await expect(
      teamService.updateTeamMemberRole(
        dbTeamMember.teamID,
        dbTeamMember.userUid,
        TeamMemberRole[dbTeamMember.role],
      ),
    ).resolves.toBeDefined();
  });

  test('fires "team/<team_id>/member_updated" pubsub message with correct payload', async () => {
    const newRole = TeamMemberRole.EDITOR;

    mockPrisma.teamMember.count.mockResolvedValue(2);
    mockPrisma.teamMember.findUnique.mockResolvedValue(dbTeamMember);
    mockPrisma.teamMember.update.mockResolvedValue({
      ...dbTeamMember,
      role: newRole,
    });

    await teamService.updateTeamMemberRole(
      dbTeamMember.teamID,
      dbTeamMember.userUid,
      newRole,
    );

    expect(mockPubSub.publish).toHaveBeenCalledWith(
      `team/${dbTeamMember.teamID}/member_updated`,
      {
        ...teamMember,
        role: newRole,
      },
    );
  });
});

describe('leaveTeam', () => {
  /*
    Same scenario as above:
      3 users (testuid1 thru 3) with respectively
      OWNER, VIEWER and EDITOR roles in team with id 3170
  */

  test('removes the user if valid credentials given', async () => {
    mockPrisma.teamMember.count.mockResolvedValue(2);
    mockPrisma.teamMember.findUnique.mockResolvedValue(dbTeamMember);
    mockPrisma.teamMember.delete.mockResolvedValue(dbTeamMember);

    await teamService.leaveTeam(dbTeamMember.teamID, dbTeamMember.userUid);

    expect(mockPrisma.teamMember.delete).toHaveBeenCalledWith({
      where: {
        teamID_userUid: {
          teamID: dbTeamMember.teamID,
          userUid: dbTeamMember.userUid,
        },
      },
    });
  });

  test('rejects if invalid teamId with TEAM_INVALID_ID_OR_USER', () => {
    // Invalid team id will return 0 count
    mockPrisma.teamMember.count.mockResolvedValue(0);

    // getTeamMember returns null if no match
    mockPrisma.teamMember.findUnique.mockResolvedValue(null);

    // Deletion rejects with RecordNotFound when no match
    mockPrisma.teamMember.delete.mockRejectedValue('RecordNotFound');

    return expect(
      teamService.leaveTeam('31700', dbTeamMember.userUid),
    ).resolves.toEqualLeft(TEAM_INVALID_ID_OR_USER);
  });

  test('rejects if invalid userUid with TEAM_INVALID_ID_OR_USER', () => {
    // Invalid team id will return proper count
    mockPrisma.teamMember.count.mockResolvedValue(1);

    // getTeamMember returns null if no match
    mockPrisma.teamMember.findUnique.mockResolvedValue(null);

    // Deletion rejects with RecordNotFound when no match
    mockPrisma.teamMember.delete.mockRejectedValue('RecordNotFound');

    return expect(
      teamService.leaveTeam(dbTeamMember.teamID, 'testuid3'),
    ).resolves.toEqualLeft(TEAM_INVALID_ID_OR_USER);
  });

  test('rejects if the removed user is the sole owner of the team with TEAM_ONLY_ONE_OWNER', () => {
    mockPrisma.teamMember.count.mockResolvedValue(1);
    mockPrisma.teamMember.findUnique.mockResolvedValue({
      ...dbTeamMember,
      role: TeamMemberRole.OWNER,
    });

    // Prisma does not care
    mockPrisma.teamMember.delete.mockResolvedValue({
      ...dbTeamMember,
      role: TeamMemberRole.OWNER,
    });

    return expect(
      teamService.leaveTeam(dbTeamMember.teamID, dbTeamMember.userUid),
    ).resolves.toEqualLeft(TEAM_ONLY_ONE_OWNER);
  });

  test('resolves if the removed user is an owner (but not the sole) of the team', async () => {
    mockPrisma.teamMember.count.mockResolvedValue(2);
    mockPrisma.teamMember.findUnique.mockResolvedValue({
      ...dbTeamMember,
      role: TeamMemberRole.OWNER,
    });
    mockPrisma.teamMember.delete.mockResolvedValue({
      ...dbTeamMember,
      role: TeamMemberRole.OWNER,
    });

    await expect(
      teamService.leaveTeam(dbTeamMember.teamID, dbTeamMember.userUid),
    ).resolves.toEqualRight(true);
  });

  test('fires "team/<team_id>/member_removed" pubsub message with correct payload', async () => {
    mockPrisma.teamMember.count.mockResolvedValue(2);
    mockPrisma.teamMember.findUnique.mockResolvedValue(dbTeamMember);
    mockPrisma.teamMember.delete.mockResolvedValue(dbTeamMember);

    await teamService.leaveTeam(dbTeamMember.teamID, dbTeamMember.userUid);

    expect(mockPubSub.publish).toHaveBeenCalledWith(
      `team/${dbTeamMember.teamID}/member_removed`,
      dbTeamMember.userUid,
    );
  });
});

describe('createTeam', () => {
  test('adds the new team to the db', async () => {
    mockPrisma.team.create.mockResolvedValue(team);

    await teamService.createTeam(team.name, dbTeamMember.userUid);

    expect(mockPrisma.team.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          name: team.name,
        }),
      }),
    );
  });

  test('adds the creator to team and set them as OWNER', async () => {
    mockPrisma.team.create.mockResolvedValue(team);

    await teamService.createTeam(team.name, dbTeamMember.userUid);

    expect(mockPrisma.team.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          members: {
            create: {
              userUid: dbTeamMember.userUid,
              role: TeamMemberRole.OWNER,
            },
          },
        }),
      }),
    );
  });

  test('resolves with the team info', () => {
    mockPrisma.team.create.mockResolvedValue(team);

    return expect(
      teamService.createTeam(team.name, dbTeamMember.userUid),
    ).resolves.toEqualRight(expect.objectContaining(team));
  });

  test('rejects for team name length < 6 with TEAM_NAME_INVALID', () => {
    const newName = 'smol';

    // Prisma doesn't care
    mockPrisma.team.create.mockResolvedValue({
      ...team,
      name: newName,
    });

    return expect(
      teamService.createTeam(newName, dbTeamMember.userUid),
    ).resolves.toEqualLeft(TEAM_NAME_INVALID);
  });
});

describe('getTeamWithID', () => {
  test('resolves for a proper team id with the proper details', () => {
    mockPrisma.team.findUnique.mockResolvedValue(team);

    return expect(teamService.getTeamWithID(team.id)).resolves.toEqual(
      expect.objectContaining(team),
    );
  });

  test('resolves for a invalid team id as null', () => {
    // Prisma would reject with RecordNotFound
    mockPrisma.team.findUnique.mockRejectedValue('RecordNotFound');

    return expect(teamService.getTeamWithID('3171')).resolves.toBeNull();
  });
});

describe('getTeamMember', () => {
  test('resolves for a proper team id and user uid and returns the info', () => {
    mockPrisma.teamMember.findUnique.mockResolvedValue(dbTeamMember);

    return expect(
      teamService.getTeamMember(dbTeamMember.teamID, dbTeamMember.userUid),
    ).resolves.toEqual(expect.objectContaining(teamMember));
  });

  test('resolves for a invalid team id and proper uid and returns null', () => {
    // If not found, prisma rejects with RecordNotFound
    mockPrisma.teamMember.findUnique.mockRejectedValue('RecordNotFound');

    return expect(
      teamService.getTeamMember(dbTeamMember.teamID, 'testuid'),
    ).resolves.toBeNull();
  });
});

describe('getRoleOfUserInTeam', () => {
  test('resolves with the correct role value', () => {
    mockPrisma.teamMember.findUnique.mockResolvedValue(dbTeamMember);

    return expect(
      teamService.getRoleOfUserInTeam(
        dbTeamMember.teamID,
        dbTeamMember.userUid,
      ),
    ).resolves.toEqual(dbTeamMember.role);
  });

  test('resolves with null if user is not found in team', () => {
    mockPrisma.teamMember.findUnique.mockRejectedValue('RecordNotFound');

    return expect(
      teamService.getRoleOfUserInTeam(dbTeamMember.teamID, 'nottestuid'),
    ).resolves.toBeNull();
  });

  test('resolves with null if team does not exist', () => {
    mockPrisma.teamMember.findUnique.mockRejectedValue('RecordNotFound');

    return expect(
      teamService.getRoleOfUserInTeam('invalidteam', dbTeamMember.userUid),
    ).resolves.toBeNull();
  });
});

describe('getMembersOfTeam', () => {
  test('resolves for the team id and null cursor with the first page', async () => {
    mockPrisma.teamMember.findMany.mockResolvedValue([]);
    await teamService.getMembersOfTeam(team.id, null);

    expect(mockPrisma.teamMember.findMany).toHaveBeenCalledWith({
      take: 10,
      skip: 0,
      cursor: undefined,
      where: {
        teamID: team.id,
      },
    });
  });

  test('resolves for the team id and proper cursor with pagination', async () => {
    const cursor = 'secondpage';

    mockPrisma.teamMember.findMany.mockResolvedValue([]);
    await teamService.getMembersOfTeam(team.id, cursor);

    expect(mockPrisma.teamMember.findMany).toHaveBeenCalledWith({
      take: 10,
      skip: 1,
      cursor: {
        id: cursor,
      },
      where: {
        teamID: team.id,
      },
    });
  });

  test('resolves with an empty array for invalid team id and null cursor', () => {
    // findMany returns an empty array if no matches are found
    mockPrisma.teamMember.findMany.mockResolvedValue([]);

    return expect(
      teamService.getMembersOfTeam('invalidteamid', null),
    ).resolves.toHaveLength(0);
  });

  test('resolves with an empty array for an invalid team id and invalid cursor', () => {
    // findMany returns an empty array if no matches are found
    mockPrisma.teamMember.findMany.mockResolvedValue([]);

    return expect(
      teamService.getMembersOfTeam('invalidteamid', 'invalidcursor'),
    ).resolves.toHaveLength(0);
  });
});

describe('getTeamsOfUser', () => {
  test('resolves with the first 10 elements when no cursor is given', async () => {
    mockPrisma.teamMember.findMany.mockResolvedValue([]);

    await teamService.getTeamsOfUser(dbTeamMember.userUid, null);

    expect(mockPrisma.teamMember.findMany).toHaveBeenCalledWith({
      take: 10,
      skip: 0,
      cursor: undefined,
      where: {
        userUid: dbTeamMember.userUid,
      },
      include: {
        team: true,
      },
    });
  });

  test('resolves as expected for paginated requests with cursor', async () => {
    const cursor = 'secondpage';

    mockPrisma.teamMember.findMany.mockResolvedValue([]);
    await teamService.getTeamsOfUser(dbTeamMember.userUid, cursor);

    expect(mockPrisma.teamMember.findMany).toHaveBeenCalledWith({
      take: 10,
      skip: 1,
      cursor: {
        teamID_userUid: {
          teamID: cursor,
          userUid: dbTeamMember.userUid,
        },
      },
      where: {
        userUid: dbTeamMember.userUid,
      },
      include: {
        team: true,
      },
    });
  });

  test('resolves with an empty array for an invalid cursor', () => {
    // Invalid cursors return an empty array
    mockPrisma.teamMember.findMany.mockResolvedValue([]);

    return expect(
      teamService.getTeamsOfUser(dbTeamMember.userUid, 'invalidcursor'),
    ).resolves.toHaveLength(0);
  });

  test('resolves with an empty array for invalid user id and null cursor', () => {
    mockPrisma.teamMember.findMany.mockResolvedValue([]);

    return expect(
      teamService.getTeamsOfUser('invalidid', null),
    ).resolves.toHaveLength(0);
  });

  test('resolves with an empty array for invalid user id and invalid cursor', () => {
    mockPrisma.teamMember.findMany.mockResolvedValue([]);

    return expect(
      teamService.getTeamsOfUser('invalidId', 'invalidCursor'),
    ).resolves.toHaveLength(0);
  });
});

describe('deleteUserFromAllTeams', () => {
  test('should return undefined when a valid uid is passed and user is deleted from all teams', async () => {
    mockPrisma.teamMember.findMany.mockResolvedValue([dbTeamMember]);
    mockPrisma.teamMember.count.mockResolvedValue(2);
    mockPrisma.teamMember.findUnique.mockResolvedValue(dbTeamMember);

    const result = await teamService.deleteUserFromAllTeams(
      dbTeamMember.userUid,
    )();

    expect(mockPrisma.teamMember.findMany).toHaveBeenCalledWith({
      where: {
        userUid: dbTeamMember.userUid,
      },
    });

    expect(result).toBeUndefined();
  });

  test('should return undefined when user has no data or the uid is invalid', async () => {
    mockPrisma.teamMember.findMany.mockResolvedValue([]);

    const result = await teamService.deleteUserFromAllTeams(
      dbTeamMember.userUid,
    )();

    expect(mockPrisma.teamMember.findMany).toHaveBeenCalledWith({
      where: {
        userUid: dbTeamMember.userUid,
      },
    });

    expect(result).toBeUndefined();
  });

  test('should reject when user is an OWNER in a team with only 1 member', async () => {
    mockPrisma.teamMember.findMany.mockResolvedValue([dbTeamMember]);
    mockPrisma.teamMember.count.mockResolvedValue(1);
    mockPrisma.teamMember.findUnique.mockResolvedValue({
      ...dbTeamMember,
      role: TeamMemberRole.OWNER,
    });

    const result = teamService.deleteUserFromAllTeams(dbTeamMember.userUid)();

    await expect(result).rejects.toThrowError(TEAM_ONLY_ONE_OWNER);
    expect(mockPrisma.teamMember.findMany).toHaveBeenCalledWith({
      where: {
        userUid: dbTeamMember.userUid,
      },
    });
  });

  test('should reject when a valid uid is passed but fetching teamMember details errors out', async () => {
    mockPrisma.teamMember.findMany.mockResolvedValue([
      {
        ...dbTeamMember,
        role: TeamMemberRole.OWNER,
      },
    ]);
    mockPrisma.teamMember.count.mockResolvedValue(2);

    // findUnique while getTeamMember() is called errors out
    mockPrisma.teamMember.findUnique.mockRejectedValueOnce('NotFoundError');

    const result = teamService.deleteUserFromAllTeams(dbTeamMember.userUid);

    await expect(result).rejects.toThrowError(TEAM_INVALID_ID_OR_USER);
    expect(mockPrisma.teamMember.findMany).toHaveBeenCalledWith({
      where: {
        userUid: dbTeamMember.userUid,
      },
    });
  });
});

describe('fetchAllTeams', () => {
  test('should resolve right and return 20 teams when cursor is null', async () => {
    mockPrisma.team.findMany.mockResolvedValueOnce(teams);

    const result = await teamService.fetchAllTeams(null, 20);
    expect(result).toEqual(teams);
  });
  test('should resolve right and return next 20 teams when cursor is provided', async () => {
    mockPrisma.team.findMany.mockResolvedValueOnce(teams);

    const result = await teamService.fetchAllTeams('teamID', 20);
    expect(result).toEqual(teams);
  });
  test('should resolve left and return an empty array when users not found', async () => {
    mockPrisma.team.findMany.mockResolvedValueOnce([]);

    const result = await teamService.fetchAllTeams(null, 20);
    expect(result).toEqual([]);
  });
});

describe('getCountOfMembersInTeam', () => {
  test('should resolve right and return a total team member count ', async () => {
    mockPrisma.teamMember.count.mockResolvedValueOnce(2);
    const result = await teamService.getCountOfMembersInTeam(team.id);
    expect(mockPrisma.teamMember.count).toHaveBeenCalledWith({
      where: {
        teamID: team.id,
      },
    });
    expect(result).toEqual(2);
  });
  test('should resolve left and return an error when no team members found', async () => {
    mockPrisma.teamMember.count.mockResolvedValueOnce(0);
    const result = await teamService.getCountOfMembersInTeam(team.id);
    expect(mockPrisma.teamMember.count).toHaveBeenCalledWith({
      where: {
        teamID: team.id,
      },
    });
    expect(result).toEqual(0);
  });

  describe('getTeamsCount', () => {
    test('should return count of all teams in the organization', async () => {
      mockPrisma.team.count.mockResolvedValueOnce(10);

      const result = await teamService.getTeamsCount();
      expect(result).toEqual(10);
    });
  });
});
