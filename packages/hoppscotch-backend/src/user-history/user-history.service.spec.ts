import { UserHistoryService } from './user-history.service';
import { PrismaService } from '../prisma/prisma.service';
import { PubSubService } from '../pubsub/pubsub.service';
import { mockDeep, mockReset } from 'jest-mock-extended';
import { UserHistory } from './user-history.model';
import { ReqType } from 'src/types/RequestTypes';
import {
  USER_HISTORY_INVALID_REQ_TYPE,
  USER_HISTORY_NOT_FOUND,
} from '../errors';

const mockPrisma = mockDeep<PrismaService>();
const mockPubSub = mockDeep<PubSubService>();

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
const userHistoryService = new UserHistoryService(
  mockPrisma,
  mockPubSub as any,
);

beforeEach(() => {
  mockReset(mockPrisma);
  mockPubSub.publish.mockClear();
});

const date = new Date();

describe('UserHistoryService', () => {
  describe('fetchUserHistory', () => {
    test('Should return a list of users REST history if exists', async () => {
      const executedOn = new Date();
      mockPrisma.userHistory.findMany.mockResolvedValueOnce([
        {
          userUid: 'abc',
          id: '1',
          request: [{}],
          responseMetadata: [{}],
          reqType: ReqType.REST,
          executedOn: executedOn,
          isStarred: false,
        },
        {
          userUid: 'abc',
          id: '2',
          request: [{}],
          responseMetadata: [{}],
          reqType: ReqType.REST,
          executedOn: executedOn,
          isStarred: true,
        },
      ]);

      const userHistory: UserHistory[] = [
        {
          userUid: 'abc',
          id: '1',
          request: JSON.stringify([{}]),
          responseMetadata: JSON.stringify([{}]),
          reqType: ReqType.REST,
          executedOn: executedOn,
          isStarred: false,
        },
        {
          userUid: 'abc',
          id: '2',
          request: JSON.stringify([{}]),
          responseMetadata: JSON.stringify([{}]),
          reqType: ReqType.REST,
          executedOn: executedOn,
          isStarred: true,
        },
      ];

      return expect(
        await userHistoryService.fetchUserHistory('abc', 2, ReqType.REST),
      ).toEqual(userHistory);
    });
    test('Should return a list of users GQL history if exists', async () => {
      const executedOn = new Date();
      mockPrisma.userHistory.findMany.mockResolvedValueOnce([
        {
          userUid: 'abc',
          id: '1',
          request: [{}],
          responseMetadata: [{}],
          reqType: ReqType.GQL,
          executedOn: executedOn,
          isStarred: false,
        },
        {
          userUid: 'abc',
          id: '2',
          request: [{}],
          responseMetadata: [{}],
          reqType: ReqType.GQL,
          executedOn: executedOn,
          isStarred: true,
        },
      ]);

      const userHistory: UserHistory[] = [
        {
          userUid: 'abc',
          id: '1',
          request: JSON.stringify([{}]),
          responseMetadata: JSON.stringify([{}]),
          reqType: ReqType.GQL,
          executedOn: executedOn,
          isStarred: false,
        },
        {
          userUid: 'abc',
          id: '2',
          request: JSON.stringify([{}]),
          responseMetadata: JSON.stringify([{}]),
          reqType: ReqType.GQL,
          executedOn: executedOn,
          isStarred: true,
        },
      ];
      return expect(
        await userHistoryService.fetchUserHistory('abc', 2, ReqType.GQL),
      ).toEqual(userHistory);
    });
    test('Should return an empty list of users REST history if doesnt exists', async () => {
      mockPrisma.userHistory.findMany.mockResolvedValueOnce([]);

      const userHistory: UserHistory[] = [];
      return expect(
        await userHistoryService.fetchUserHistory('abc', 2, ReqType.REST),
      ).toEqual(userHistory);
    });
    test('Should return an empty list of users GQL history if doesnt exists', async () => {
      mockPrisma.userHistory.findMany.mockResolvedValueOnce([]);

      const userHistory: UserHistory[] = [];
      return expect(
        await userHistoryService.fetchUserHistory('abc', 2, ReqType.GQL),
      ).toEqual(userHistory);
    });
  });
  describe('createUserHistory', () => {
    test('Should resolve right and create a REST request to users history and return a `UserHistory` object', async () => {
      const executedOn = new Date();

      mockPrisma.userHistory.create.mockResolvedValueOnce({
        userUid: 'abc',
        id: '1',
        request: [{}],
        responseMetadata: [{}],
        reqType: ReqType.REST,
        executedOn,
        isStarred: false,
      });

      const userHistory: UserHistory = <UserHistory>{
        userUid: 'abc',
        id: '1',
        request: JSON.stringify([{}]),
        responseMetadata: JSON.stringify([{}]),
        reqType: ReqType.REST,
        executedOn,
        isStarred: false,
      };

      return expect(
        await userHistoryService.createUserHistory(
          'abc',
          JSON.stringify([{}]),
          JSON.stringify([{}]),
          'REST',
        ),
      ).toEqualRight(userHistory);
    });
    test('Should resolve right and create a GQL request to users history and return a `UserHistory` object', async () => {
      const executedOn = new Date();

      mockPrisma.userHistory.create.mockResolvedValueOnce({
        userUid: 'abc',
        id: '1',
        request: [{}],
        responseMetadata: [{}],
        reqType: ReqType.GQL,
        executedOn,
        isStarred: false,
      });

      const userHistory: UserHistory = <UserHistory>{
        userUid: 'abc',
        id: '1',
        request: JSON.stringify([{}]),
        responseMetadata: JSON.stringify([{}]),
        reqType: ReqType.GQL,
        executedOn,
        isStarred: false,
      };

      return expect(
        await userHistoryService.createUserHistory(
          'abc',
          JSON.stringify([{}]),
          JSON.stringify([{}]),
          'GQL',
        ),
      ).toEqualRight(userHistory);
    });
    test('Should resolve left when invalid ReqType is passed', async () => {
      return expect(
        await userHistoryService.createUserHistory(
          'abc',
          JSON.stringify([{}]),
          JSON.stringify([{}]),
          'INVALID',
        ),
      ).toEqualLeft(USER_HISTORY_INVALID_REQ_TYPE);
    });
    test('Should create a GQL request to users history and publish a created subscription', async () => {
      const executedOn = new Date();

      mockPrisma.userHistory.create.mockResolvedValueOnce({
        userUid: 'abc',
        id: '1',
        request: [{}],
        responseMetadata: [{}],
        reqType: ReqType.GQL,
        executedOn,
        isStarred: false,
      });

      const userHistory: UserHistory = <UserHistory>{
        userUid: 'abc',
        id: '1',
        request: JSON.stringify([{}]),
        responseMetadata: JSON.stringify([{}]),
        reqType: ReqType.GQL,
        executedOn,
        isStarred: false,
      };

      await userHistoryService.createUserHistory(
        'abc',
        JSON.stringify([{}]),
        JSON.stringify([{}]),
        'GQL',
      );

      return expect(await mockPubSub.publish).toHaveBeenCalledWith(
        `user_history/${userHistory.userUid}/created`,
        userHistory,
      );
    });
    test('Should create a REST request to users history and publish a created subscription', async () => {
      const executedOn = new Date();

      mockPrisma.userHistory.create.mockResolvedValueOnce({
        userUid: 'abc',
        id: '1',
        request: [{}],
        responseMetadata: [{}],
        reqType: ReqType.REST,
        executedOn,
        isStarred: false,
      });

      const userHistory: UserHistory = <UserHistory>{
        userUid: 'abc',
        id: '1',
        request: JSON.stringify([{}]),
        responseMetadata: JSON.stringify([{}]),
        reqType: ReqType.REST,
        executedOn,
        isStarred: false,
      };

      await userHistoryService.createUserHistory(
        'abc',
        JSON.stringify([{}]),
        JSON.stringify([{}]),
        'REST',
      );

      return expect(await mockPubSub.publish).toHaveBeenCalledWith(
        `user_history/${userHistory.userUid}/created`,
        userHistory,
      );
    });
  });
  describe('toggleHistoryStarStatus', () => {
    test('Should resolve right and star/unstar a request in the history', async () => {
      const createdOnDate = new Date();
      mockPrisma.userHistory.findFirst.mockResolvedValueOnce({
        userUid: 'abc',
        id: '1',
        request: [{}],
        responseMetadata: [{}],
        reqType: ReqType.REST,
        executedOn: createdOnDate,
        isStarred: false,
      });

      mockPrisma.userHistory.update.mockResolvedValueOnce({
        userUid: 'abc',
        id: '1',
        request: [{}],
        responseMetadata: [{}],
        reqType: ReqType.REST,
        executedOn: createdOnDate,
        isStarred: true,
      });

      const userHistory: UserHistory = <UserHistory>{
        userUid: 'abc',
        id: '1',
        request: JSON.stringify([{}]),
        responseMetadata: JSON.stringify([{}]),
        reqType: ReqType.REST,
        executedOn: createdOnDate,
        isStarred: true,
      };

      return expect(
        await userHistoryService.toggleHistoryStarStatus('abc', '1'),
      ).toEqualRight(userHistory);
    });
    test('Should resolve left and error out due to invalid user history request ID', async () => {
      mockPrisma.userHistory.findFirst.mockResolvedValueOnce(null);

      return expect(
        await userHistoryService.toggleHistoryStarStatus('abc', '1'),
      ).toEqualLeft(USER_HISTORY_NOT_FOUND);
    });
    test('Should star/unstar a request in the history and publish a updated subscription', async () => {
      const executedOn = new Date();

      mockPrisma.userHistory.findFirst.mockResolvedValueOnce({
        userUid: 'abc',
        id: '1',
        request: [{}],
        responseMetadata: [{}],
        reqType: ReqType.REST,
        executedOn,
        isStarred: false,
      });

      mockPrisma.userHistory.update.mockResolvedValueOnce({
        userUid: 'abc',
        id: '1',
        request: [{}],
        responseMetadata: [{}],
        reqType: ReqType.REST,
        executedOn,
        isStarred: true,
      });

      const userHistory: UserHistory = <UserHistory>{
        userUid: 'abc',
        id: '1',
        request: JSON.stringify([{}]),
        responseMetadata: JSON.stringify([{}]),
        reqType: ReqType.REST,
        executedOn,
        isStarred: true,
      };

      await userHistoryService.toggleHistoryStarStatus('abc', '1');
      return expect(mockPubSub.publish).toHaveBeenCalledWith(
        `user_history/${userHistory.userUid}/updated`,
        userHistory,
      );
    });
  });
  describe('removeRequestFromHistory', () => {
    test('Should resolve right and delete request from users history', async () => {
      const executedOn = new Date();

      mockPrisma.userHistory.delete.mockResolvedValueOnce({
        userUid: 'abc',
        id: '1',
        request: [{}],
        responseMetadata: [{}],
        reqType: ReqType.REST,
        executedOn: executedOn,
        isStarred: false,
      });

      const userHistory: UserHistory = <UserHistory>{
        userUid: 'abc',
        id: '1',
        request: JSON.stringify([{}]),
        responseMetadata: JSON.stringify([{}]),
        reqType: ReqType.REST,
        executedOn: executedOn,
        isStarred: false,
      };

      return expect(
        await userHistoryService.removeRequestFromHistory('abc', '1'),
      ).toEqualRight(userHistory);
    });
    test('Should resolve left and error out when req id is invalid', async () => {
      mockPrisma.userHistory.delete.mockResolvedValueOnce(null);

      return expect(
        await userHistoryService.removeRequestFromHistory('abc', '1'),
      ).toEqualLeft(USER_HISTORY_NOT_FOUND);
    });
    test('Should delete request from users history and publish deleted subscription', async () => {
      mockPrisma.userHistory.delete.mockResolvedValueOnce({
        userUid: 'abc',
        id: '1',
        request: [{}],
        responseMetadata: [{}],
        reqType: ReqType.REST,
        executedOn: date,
        isStarred: false,
      });

      const userHistory: UserHistory = <UserHistory>{
        userUid: 'abc',
        id: '1',
        request: JSON.stringify([{}]),
        responseMetadata: JSON.stringify([{}]),
        reqType: ReqType.REST,
        executedOn: date,
        isStarred: false,
      };

      await userHistoryService.removeRequestFromHistory('abc', '1');

      return expect(mockPubSub.publish).toHaveBeenCalledWith(
        `user_history/${userHistory.userUid}/deleted`,
        userHistory,
      );
    });
  });
  describe('deleteAllUserHistory', () => {
    test('Should resolve right and delete all user REST history for a request type', async () => {
      mockPrisma.userHistory.deleteMany.mockResolvedValueOnce({
        count: 2,
      });

      return expect(
        await userHistoryService.deleteAllUserHistory('abc', 'REST'),
      ).toEqualRight({
        count: 2,
        reqType: ReqType.REST,
      });
    });
    test('Should resolve right and delete all user GQL history for a request type', async () => {
      mockPrisma.userHistory.deleteMany.mockResolvedValueOnce({
        count: 2,
      });

      return expect(
        await userHistoryService.deleteAllUserHistory('abc', 'GQL'),
      ).toEqualRight({
        count: 2,
        reqType: ReqType.GQL,
      });
    });
    test('Should resolve left and error when ReqType is invalid', async () => {
      return expect(
        await userHistoryService.deleteAllUserHistory('abc', 'INVALID'),
      ).toEqualLeft(USER_HISTORY_INVALID_REQ_TYPE);
    });
    test('Should delete all user REST history for a request type and publish deleted many subscription', async () => {
      mockPrisma.userHistory.deleteMany.mockResolvedValueOnce({
        count: 2,
      });

      await userHistoryService.deleteAllUserHistory('abc', 'REST');
      return expect(mockPubSub.publish).toHaveBeenCalledWith(
        `user_history/abc/deleted_many`,
        {
          count: 2,
          reqType: ReqType.REST,
        },
      );
    });
    test('Should delete all user GQL history for a request type and publish deleted many subscription', async () => {
      mockPrisma.userHistory.deleteMany.mockResolvedValueOnce({
        count: 2,
      });

      await userHistoryService.deleteAllUserHistory('abc', 'GQL');
      return expect(mockPubSub.publish).toHaveBeenCalledWith(
        `user_history/abc/deleted_many`,
        {
          count: 2,
          reqType: ReqType.GQL,
        },
      );
    });
  });
  describe('deleteAllHistories', () => {
    test('Should resolve right and delete all user history', async () => {
      mockPrisma.userHistory.deleteMany.mockResolvedValueOnce({
        count: 2,
      });

      return expect(await userHistoryService.deleteAllHistories()).toEqualRight(
        true,
      );
    });
    test('Should publish all user history delete event', async () => {
      mockPrisma.userHistory.deleteMany.mockResolvedValueOnce({
        count: 2,
      });

      await userHistoryService.deleteAllHistories();

      expect(mockPubSub.publish).toHaveBeenCalledTimes(1);
      return expect(mockPubSub.publish).toHaveBeenCalledWith(
        `user_history/all/deleted`,
        true,
      );
    });
  });
  describe('validateReqType', () => {
    test('Should resolve right when a valid REST ReqType is provided', async () => {
      return expect(userHistoryService.validateReqType('REST')).toEqualRight(
        ReqType.REST,
      );
    });
    test('Should resolve right when a valid GQL ReqType is provided', async () => {
      return expect(userHistoryService.validateReqType('GQL')).toEqualRight(
        ReqType.GQL,
      );
    });
    test('Should resolve left and error out when a invalid ReqType is provided', async () => {
      return expect(userHistoryService.validateReqType('INVALID')).toEqualLeft(
        USER_HISTORY_INVALID_REQ_TYPE,
      );
    });
  });
});
