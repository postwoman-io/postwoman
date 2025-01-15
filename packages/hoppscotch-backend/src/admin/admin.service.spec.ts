import { AdminService } from './admin.service';
import { PubSubService } from '../pubsub/pubsub.service';
import { mockDeep } from 'jest-mock-extended';
import { InvitedUsers, User as DbUser } from '@prisma/client';
import { UserService } from '../user/user.service';
import { TeamService } from '../team/team.service';
import { TeamEnvironmentsService } from '../team-environments/team-environments.service';
import { TeamRequestService } from '../team-request/team-request.service';
import { TeamInvitationService } from '../team-invitation/team-invitation.service';
import { TeamCollectionService } from '../team-collection/team-collection.service';
import { MailerService } from '../mailer/mailer.service';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  DUPLICATE_EMAIL,
  INVALID_EMAIL,
  ONLY_ONE_ADMIN_ACCOUNT,
  USER_ALREADY_INVITED,
  USER_INVITATION_DELETION_FAILED,
  USER_NOT_FOUND,
} from '../errors';
import { ShortcodeService } from 'src/shortcode/shortcode.service';
import { ConfigService } from '@nestjs/config';
import { OffsetPaginationArgs } from 'src/types/input-types.args';
import * as E from 'fp-ts/Either';
import { UserHistoryService } from 'src/user-history/user-history.service';

const mockPrisma = mockDeep<PrismaService>();
const mockPubSub = mockDeep<PubSubService>();
const mockUserService = mockDeep<UserService>();
const mockTeamService = mockDeep<TeamService>();
const mockTeamEnvironmentsService = mockDeep<TeamEnvironmentsService>();
const mockTeamRequestService = mockDeep<TeamRequestService>();
const mockTeamInvitationService = mockDeep<TeamInvitationService>();
const mockTeamCollectionService = mockDeep<TeamCollectionService>();
const mockMailerService = mockDeep<MailerService>();
const mockShortcodeService = mockDeep<ShortcodeService>();
const mockConfigService = mockDeep<ConfigService>();
const mockUserHistoryService = mockDeep<UserHistoryService>();

const adminService = new AdminService(
  mockUserService,
  mockTeamService,
  mockTeamCollectionService,
  mockTeamRequestService,
  mockTeamEnvironmentsService,
  mockTeamInvitationService,
  mockPubSub as any,
  mockPrisma as any,
  mockMailerService,
  mockShortcodeService,
  mockConfigService,
  mockUserHistoryService,
);

const invitedUsers: InvitedUsers[] = [
  {
    adminUid: 'uid1',
    adminEmail: 'admin1@example.com',
    inviteeEmail: 'i@example.com',
    invitedOn: new Date(),
  },
  {
    adminUid: 'uid2',
    adminEmail: 'admin2@example.com',
    inviteeEmail: 'u@example.com',
    invitedOn: new Date(),
  },
];

const dbAdminUsers: DbUser[] = [
  {
    uid: 'uid 1',
    displayName: 'displayName',
    email: 'email@email.com',
    photoURL: 'photoURL',
    isAdmin: true,
    refreshToken: 'refreshToken',
    currentRESTSession: '',
    currentGQLSession: '',
    lastLoggedOn: new Date(),
    lastActiveOn: new Date(),
    createdOn: new Date(),
  },
  {
    uid: 'uid 2',
    displayName: 'displayName',
    email: 'email@email.com',
    photoURL: 'photoURL',
    isAdmin: true,
    refreshToken: 'refreshToken',
    currentRESTSession: '',
    currentGQLSession: '',
    lastLoggedOn: new Date(),
    lastActiveOn: new Date(),
    createdOn: new Date(),
  },
];

describe('AdminService', () => {
  describe('fetchInvitedUsers', () => {
    test('should resolve right and apply pagination correctly', async () => {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      mockPrisma.user.findMany.mockResolvedValue([dbAdminUsers[0]]);
      // @ts-ignore
      mockPrisma.invitedUsers.findMany.mockResolvedValue(invitedUsers);

      const paginationArgs: OffsetPaginationArgs = { take: 5, skip: 2 };
      const results = await adminService.fetchInvitedUsers(paginationArgs);

      expect(mockPrisma.invitedUsers.findMany).toHaveBeenCalledWith({
        ...paginationArgs,
        orderBy: {
          invitedOn: 'desc',
        },
        where: {
          NOT: {
            inviteeEmail: {
              in: [dbAdminUsers[0].email],
              mode: 'insensitive',
            },
          },
        },
      });
    });
    test('should resolve right and return an array of invited users', async () => {
      const paginationArgs: OffsetPaginationArgs = { take: 10, skip: 0 };

      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      mockPrisma.user.findMany.mockResolvedValue([dbAdminUsers[0]]);
      // @ts-ignore
      mockPrisma.invitedUsers.findMany.mockResolvedValue(invitedUsers);

      const results = await adminService.fetchInvitedUsers(paginationArgs);
      expect(results).toEqual(invitedUsers);
    });
    test('should resolve left and return an empty array if invited users not found', async () => {
      const paginationArgs: OffsetPaginationArgs = { take: 10, skip: 0 };

      mockPrisma.invitedUsers.findMany.mockResolvedValue([]);

      const results = await adminService.fetchInvitedUsers(paginationArgs);
      expect(results).toEqual([]);
    });
  });

  describe('inviteUserToSignInViaEmail', () => {
    test('should resolve right and create a invited user', async () => {
      mockPrisma.invitedUsers.findFirst.mockResolvedValueOnce(null);
      mockPrisma.invitedUsers.create.mockResolvedValueOnce(invitedUsers[0]);
      const result = await adminService.inviteUserToSignInViaEmail(
        invitedUsers[0].adminUid,
        invitedUsers[0].adminEmail,
        invitedUsers[0].inviteeEmail,
      );
      expect(mockPrisma.invitedUsers.create).toHaveBeenCalledWith({
        data: {
          adminUid: invitedUsers[0].adminUid,
          adminEmail: invitedUsers[0].adminEmail,
          inviteeEmail: invitedUsers[0].inviteeEmail,
        },
      });
      return expect(result).toEqualRight(invitedUsers[0]);
    });
    test('should resolve right, create a invited user and publish a subscription', async () => {
      mockPrisma.invitedUsers.findFirst.mockResolvedValueOnce(null);
      mockPrisma.invitedUsers.create.mockResolvedValueOnce(invitedUsers[0]);
      await adminService.inviteUserToSignInViaEmail(
        invitedUsers[0].adminUid,
        invitedUsers[0].adminEmail,
        invitedUsers[0].inviteeEmail,
      );
      return expect(mockPubSub.publish).toHaveBeenCalledWith(
        `admin/${invitedUsers[0].adminUid}/invited`,
        invitedUsers[0],
      );
    });
    test('should resolve left and return an error when invalid invitee email is passed', async () => {
      const result = await adminService.inviteUserToSignInViaEmail(
        invitedUsers[0].adminUid,
        invitedUsers[0].adminEmail,
        'invalidemail',
      );
      return expect(result).toEqualLeft(INVALID_EMAIL);
    });
    test('should resolve left and return an error when user already invited', async () => {
      mockPrisma.invitedUsers.findFirst.mockResolvedValueOnce(invitedUsers[0]);
      const result = await adminService.inviteUserToSignInViaEmail(
        invitedUsers[0].adminUid,
        invitedUsers[0].adminEmail,
        invitedUsers[0].inviteeEmail,
      );
      return expect(result).toEqualLeft(USER_ALREADY_INVITED);
    });
    test('should resolve left and return an error when invitee and admin email is same', async () => {
      const result = await adminService.inviteUserToSignInViaEmail(
        invitedUsers[0].adminUid,
        invitedUsers[0].inviteeEmail,
        invitedUsers[0].inviteeEmail,
      );
      return expect(result).toEqualLeft(DUPLICATE_EMAIL);
    });
  });

  describe('revokeUserInvitations', () => {
    test('should resolve left and return error if email not invited', async () => {
      mockPrisma.invitedUsers.deleteMany.mockRejectedValueOnce(
        'RecordNotFound',
      );

      const result = await adminService.revokeUserInvitations([
        'test@gmail.com',
      ]);

      expect(result).toEqualLeft(USER_INVITATION_DELETION_FAILED);
    });

    test('should resolve right and return deleted invitee email', async () => {
      const adminUid = 'adminUid';
      mockPrisma.invitedUsers.deleteMany.mockResolvedValueOnce({ count: 1 });

      const result = await adminService.revokeUserInvitations([
        invitedUsers[0].inviteeEmail,
      ]);

      expect(mockPrisma.invitedUsers.deleteMany).toHaveBeenCalledWith({
        where: {
          inviteeEmail: {
            in: [invitedUsers[0].inviteeEmail],
            mode: 'insensitive',
          },
        },
      });
      expect(result).toEqualRight(true);
    });
  });

  describe('removeUsersAsAdmin', () => {
    test('should resolve right and make admins to users', async () => {
      mockUserService.fetchAdminUsers.mockResolvedValueOnce(dbAdminUsers);
      mockUserService.removeUsersAsAdmin.mockResolvedValueOnce(E.right(true));

      return expect(
        await adminService.demoteUsersByAdmin([dbAdminUsers[0].uid]),
      ).toEqualRight(true);
    });

    test('should resolve left and return error if only one admin in the infra', async () => {
      mockUserService.fetchAdminUsers.mockResolvedValueOnce(dbAdminUsers);
      mockUserService.removeUsersAsAdmin.mockResolvedValueOnce(E.right(true));

      return expect(
        await adminService.demoteUsersByAdmin(
          dbAdminUsers.map((user) => user.uid),
        ),
      ).toEqualLeft(ONLY_ONE_ADMIN_ACCOUNT);
    });
  });

  describe('getUsersCount', () => {
    test('should return count of all users in the organization', async () => {
      mockUserService.getUsersCount.mockResolvedValueOnce(10);

      const result = await adminService.getUsersCount();
      expect(result).toEqual(10);
    });
  });

  describe('getTeamsCount', () => {
    test('should return count of all teams in the organization', async () => {
      mockTeamService.getTeamsCount.mockResolvedValueOnce(10);

      const result = await adminService.getTeamsCount();
      expect(result).toEqual(10);
    });
  });

  describe('getTeamCollectionsCount', () => {
    test('should return count of all Team Collections in the organization', async () => {
      mockTeamCollectionService.getTeamCollectionsCount.mockResolvedValueOnce(
        10,
      );

      const result = await adminService.getTeamCollectionsCount();
      expect(result).toEqual(10);
    });
  });

  describe('getTeamRequestsCount', () => {
    test('should return count of all Team Collections in the organization', async () => {
      mockTeamRequestService.getTeamRequestsCount.mockResolvedValueOnce(10);

      const result = await adminService.getTeamRequestsCount();
      expect(result).toEqual(10);
    });
  });

  describe('deleteAllUserHistory', () => {
    test('should resolve right and delete all user history', async () => {
      mockUserHistoryService.deleteAllHistories.mockResolvedValueOnce(
        E.right(true),
      );

      const result = await adminService.deleteAllUserHistory();
      expect(result).toEqualRight(true);
    });
  });
});
