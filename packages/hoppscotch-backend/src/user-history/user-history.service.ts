import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PubSubService } from '../pubsub/pubsub.service';
import { UserHistory } from './user-history.model';
import { ReqType } from 'src/types/RequestTypes';
import * as E from 'fp-ts/Either';
import * as O from 'fp-ts/Option';
import {
  USER_HISTORY_DELETION_FAILED,
  USER_HISTORY_INVALID_REQ_TYPE,
  USER_HISTORY_NOT_FOUND,
} from '../errors';

@Injectable()
export class UserHistoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pubsub: PubSubService,
  ) {}

  /**
   * Fetch users REST or GraphQL history based on ReqType param.
   * @param uid Users uid
   * @param take items to fetch
   * @param reqType request Type to fetch i.e. GraphQL or REST
   * @returns an array of user history
   */
  async fetchUserHistory(uid: string, take: number, reqType: ReqType) {
    const userHistory = await this.prisma.userHistory.findMany({
      where: {
        userUid: uid,
        reqType: reqType,
      },
      take: take,
      orderBy: {
        executedOn: 'desc',
      },
    });

    const userHistoryColl: UserHistory[] = userHistory.map(
      (history) =>
        <UserHistory>{
          ...history,
          request: JSON.stringify(history.request),
          responseMetadata: JSON.stringify(history.responseMetadata),
        },
    );

    return userHistoryColl;
  }

  /**
   * Creates a user history.
   * @param uid Users uid
   * @param reqData the request data
   * @param resMetadata the response metadata
   * @param reqType request Type to fetch i.e. GraphQL or REST
   * @returns a `UserHistory` object
   */
  async createUserHistory(
    uid: string,
    reqData: string,
    resMetadata: string,
    reqType: string,
  ) {
    const requestType = this.validateReqType(reqType);
    if (E.isLeft(requestType)) return E.left(requestType.left);

    const history = await this.prisma.userHistory.create({
      data: {
        userUid: uid,
        request: JSON.parse(reqData),
        responseMetadata: JSON.parse(resMetadata),
        reqType: requestType.right,
        isStarred: false,
      },
    });

    const userHistory = <UserHistory>{
      ...history,
      reqType: history.reqType,
      request: JSON.stringify(history.request),
      responseMetadata: JSON.stringify(history.responseMetadata),
    };

    // Publish created user history subscription
    await this.pubsub.publish(
      `user_history/${userHistory.userUid}/created`,
      userHistory,
    );

    return E.right(userHistory);
  }

  /**
   * Toggles star status of a user history
   * @param uid Users uid
   * @param id id of the request in the history
   * @returns an Either of updated `UserHistory` or Error
   */
  async toggleHistoryStarStatus(uid: string, id: string) {
    const userHistory = await this.fetchUserHistoryByID(id);
    if (O.isNone(userHistory)) {
      return E.left(USER_HISTORY_NOT_FOUND);
    }

    try {
      const updatedHistory = await this.prisma.userHistory.update({
        where: {
          id: id,
        },
        data: {
          isStarred: !userHistory.value.isStarred,
        },
      });

      const updatedUserHistory = <UserHistory>{
        ...updatedHistory,
        request: JSON.stringify(updatedHistory.request),
        responseMetadata: JSON.stringify(updatedHistory.responseMetadata),
      };

      // Publish updated user history subscription
      await this.pubsub.publish(
        `user_history/${updatedUserHistory.userUid}/updated`,
        updatedUserHistory,
      );
      return E.right(updatedUserHistory);
    } catch (e) {
      return E.left(USER_HISTORY_NOT_FOUND);
    }
  }

  /**
   * Removes a REST/GraphQL request from the history
   * @param uid Users uid
   * @param id id of the request
   * @returns an Either of deleted `UserHistory` or Error
   */
  async removeRequestFromHistory(uid: string, id: string) {
    try {
      const delUserHistory = await this.prisma.userHistory.delete({
        where: {
          id: id,
        },
      });

      const deletedUserHistory = <UserHistory>{
        ...delUserHistory,
        request: JSON.stringify(delUserHistory.request),
        responseMetadata: JSON.stringify(delUserHistory.responseMetadata),
      };

      // Publish deleted user history subscription
      await this.pubsub.publish(
        `user_history/${deletedUserHistory.userUid}/deleted`,
        deletedUserHistory,
      );
      return E.right(deletedUserHistory);
    } catch (e) {
      return E.left(USER_HISTORY_NOT_FOUND);
    }
  }

  /**
   * Delete all REST/GraphQl user history based on ReqType
   * @param uid Users uid
   * @param reqType request type to be deleted i.e. REST or GraphQL
   * @returns a count of deleted history
   */
  async deleteAllUserHistory(uid: string, reqType: string) {
    const requestType = this.validateReqType(reqType);
    if (E.isLeft(requestType)) return E.left(requestType.left);

    const deletedCount = await this.prisma.userHistory.deleteMany({
      where: {
        userUid: uid,
        reqType: requestType.right,
      },
    });

    const deletionInfo = {
      count: deletedCount.count,
      reqType: requestType.right,
    };

    // Publish multiple user history deleted subscription
    await this.pubsub.publish(`user_history/${uid}/deleted_many`, deletionInfo);
    return E.right(deletionInfo);
  }

  /**
   * Delete all user history from DB
   * @returns a boolean
   */
  async deleteAllHistories() {
    try {
      await this.prisma.userHistory.deleteMany();
    } catch (error) {
      return E.left(USER_HISTORY_DELETION_FAILED);
    }

    this.pubsub.publish('user_history/all/deleted', true);
    return E.right(true);
  }

  /**
   * Fetch a user history based on history ID.
   * @param id User History ID
   * @returns an `UserHistory` object
   */
  async fetchUserHistoryByID(id: string) {
    const userHistory = await this.prisma.userHistory.findFirst({
      where: {
        id: id,
      },
    });
    if (userHistory == null) return O.none;

    return O.some(userHistory);
  }

  /**
   * Takes a request type argument as string and validates against `ReqType`
   * @param reqType request type to be validated i.e. REST or GraphQL
   * @returns an either of `ReqType` or error
   */
  validateReqType(reqType: string) {
    if (reqType == ReqType.REST) return E.right(ReqType.REST);
    else if (reqType == ReqType.GQL) return E.right(ReqType.GQL);
    return E.left(USER_HISTORY_INVALID_REQ_TYPE);
  }
}
