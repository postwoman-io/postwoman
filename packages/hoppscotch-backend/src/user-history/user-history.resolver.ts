import { Args, ID, Mutation, Resolver, Subscription } from '@nestjs/graphql';
import { UserHistoryService } from './user-history.service';
import { PubSubService } from '../pubsub/pubsub.service';
import { UserHistory, UserHistoryDeletedManyData } from './user-history.model';
import { ReqType } from 'src/types/RequestTypes';
import { UseGuards } from '@nestjs/common';
import { GqlAuthGuard } from '../guards/gql-auth.guard';
import { GqlUser } from '../decorators/gql-user.decorator';
import { User } from '../user/user.model';
import { throwErr } from '../utils';
import * as E from 'fp-ts/Either';
import { GqlThrottlerGuard } from 'src/guards/gql-throttler.guard';
import { SkipThrottle } from '@nestjs/throttler';
import { UserHistoryFeatureFlagGuard } from './user-history-feature-flag.guard';

@UseGuards(GqlThrottlerGuard, UserHistoryFeatureFlagGuard)
@Resolver()
export class UserHistoryResolver {
  constructor(
    private readonly userHistoryService: UserHistoryService,
    private readonly pubsub: PubSubService,
  ) {}

  /* Mutations */

  @Mutation(() => UserHistory, {
    description: 'Adds a new REST/GQL request to user history',
  })
  @UseGuards(GqlAuthGuard)
  async createUserHistory(
    @GqlUser() user: User,
    @Args({
      name: 'reqData',
      description: 'JSON string of the request data',
    })
    reqData: string,
    @Args({
      name: 'resMetadata',
      description: 'JSON string of the response metadata',
    })
    resMetadata: string,
    @Args({
      name: 'reqType',
      description: 'Request type, REST or GQL',
      type: () => ReqType,
    })
    reqType: ReqType,
  ): Promise<UserHistory> {
    const createdHistory = await this.userHistoryService.createUserHistory(
      user.uid,
      reqData,
      resMetadata,
      reqType,
    );
    if (E.isLeft(createdHistory)) throwErr(createdHistory.left);
    return createdHistory.right;
  }

  @Mutation(() => UserHistory, {
    description: 'Stars/Unstars a REST/GQL request in user history',
  })
  @UseGuards(GqlAuthGuard)
  async toggleHistoryStarStatus(
    @GqlUser() user: User,
    @Args({
      name: 'id',
      description: 'ID of User History',
      type: () => ID,
    })
    id: string,
  ): Promise<UserHistory> {
    const updatedHistory =
      await this.userHistoryService.toggleHistoryStarStatus(user.uid, id);
    if (E.isLeft(updatedHistory)) throwErr(updatedHistory.left);
    return updatedHistory.right;
  }

  @Mutation(() => UserHistory, {
    description: 'Removes a REST/GQL request from user history',
  })
  @UseGuards(GqlAuthGuard)
  async removeRequestFromHistory(
    @GqlUser() user: User,
    @Args({
      name: 'id',
      description: 'ID of User History',
      type: () => ID,
    })
    id: string,
  ): Promise<UserHistory> {
    const deletedHistory =
      await this.userHistoryService.removeRequestFromHistory(user.uid, id);
    if (E.isLeft(deletedHistory)) throwErr(deletedHistory.left);
    return deletedHistory.right;
  }

  @Mutation(() => UserHistoryDeletedManyData, {
    description:
      'Deletes all REST/GQL history for a user based on Request type',
  })
  @UseGuards(GqlAuthGuard)
  async deleteAllUserHistory(
    @GqlUser() user: User,
    @Args({
      name: 'reqType',
      description: 'Request type, REST or GQL',
      type: () => ReqType,
    })
    reqType: ReqType,
  ): Promise<UserHistoryDeletedManyData> {
    const deletedHistory = await this.userHistoryService.deleteAllUserHistory(
      user.uid,
      reqType,
    );
    if (E.isLeft(deletedHistory)) throwErr(deletedHistory.left);
    return deletedHistory.right;
  }

  /* Subscriptions */

  @Subscription(() => UserHistory, {
    description: 'Listen for User History Creation',
    resolve: (value) => value,
  })
  @SkipThrottle()
  @UseGuards(GqlAuthGuard)
  userHistoryCreated(@GqlUser() user: User) {
    return this.pubsub.asyncIterator(`user_history/${user.uid}/created`);
  }

  @Subscription(() => UserHistory, {
    description: 'Listen for User History update',
    resolve: (value) => value,
  })
  @SkipThrottle()
  @UseGuards(GqlAuthGuard)
  userHistoryUpdated(@GqlUser() user: User) {
    return this.pubsub.asyncIterator(`user_history/${user.uid}/updated`);
  }

  @Subscription(() => UserHistory, {
    description: 'Listen for User History deletion',
    resolve: (value) => value,
  })
  @SkipThrottle()
  @UseGuards(GqlAuthGuard)
  userHistoryDeleted(@GqlUser() user: User) {
    return this.pubsub.asyncIterator(`user_history/${user.uid}/deleted`);
  }

  @Subscription(() => UserHistoryDeletedManyData, {
    description: 'Listen for User History deleted many',
    resolve: (value) => value,
  })
  @SkipThrottle()
  @UseGuards(GqlAuthGuard)
  userHistoryDeletedMany(@GqlUser() user: User) {
    return this.pubsub.asyncIterator(`user_history/${user.uid}/deleted_many`);
  }

  @Subscription(() => Boolean, {
    description: 'Listen for All User History deleted',
    resolve: (value) => value,
  })
  @SkipThrottle()
  @UseGuards(GqlAuthGuard)
  userHistoryAllDeleted() {
    return this.pubsub.asyncIterator(`user_history/all/deleted`);
  }
}
