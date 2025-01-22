import { UseGuards } from '@nestjs/common';
import {
  Resolver,
  Mutation,
  Args,
  ID,
  Query,
  ResolveField,
  Parent,
  Subscription,
} from '@nestjs/graphql';
import { GqlUser } from 'src/decorators/gql-user.decorator';
import { GqlAuthGuard } from 'src/guards/gql-auth.guard';
import { PubSubService } from 'src/pubsub/pubsub.service';
import { AuthUser } from 'src/types/AuthUser';
import { UserCollectionService } from './user-collection.service';
import {
  UserCollection,
  UserCollectionDuplicatedData,
  UserCollectionExportJSONData,
  UserCollectionRemovedData,
  UserCollectionReorderData,
} from './user-collections.model';
import { throwErr } from 'src/utils';
import { User } from 'src/user/user.model';
import { PaginationArgs } from 'src/types/input-types.args';
import {
  CreateChildUserCollectionArgs,
  CreateRootUserCollectionArgs,
  ImportUserCollectionsFromJSONArgs,
  MoveUserCollectionArgs,
  RenameUserCollectionsArgs,
  UpdateUserCollectionArgs,
  UpdateUserCollectionsArgs,
} from './input-type.args';
import { ReqType } from 'src/types/RequestTypes';
import * as E from 'fp-ts/Either';
import { GqlThrottlerGuard } from 'src/guards/gql-throttler.guard';
import { SkipThrottle } from '@nestjs/throttler';

@UseGuards(GqlThrottlerGuard)
@Resolver(() => UserCollection)
export class UserCollectionResolver {
  constructor(
    private readonly userCollectionService: UserCollectionService,
    private readonly pubSub: PubSubService,
  ) {}

  // Field Resolvers
  @ResolveField(() => User, {
    description: 'User the collection belongs to',
  })
  async user(@GqlUser() user: AuthUser) {
    return user;
  }

  @ResolveField(() => UserCollection, {
    description: 'Parent user collection (null if root)',
    nullable: true,
  })
  async parent(@Parent() collection: UserCollection) {
    return this.userCollectionService.getParentOfUserCollection(collection.id);
  }

  @ResolveField(() => [UserCollection], {
    description: 'List of children REST user collection',
    complexity: 3,
  })
  childrenREST(
    @Parent() collection: UserCollection,
    @Args() args: PaginationArgs,
  ) {
    return this.userCollectionService.getChildrenOfUserCollection(
      collection.id,
      args.cursor,
      args.take,
      ReqType.REST,
    );
  }

  @ResolveField(() => [UserCollection], {
    description: 'List of children GraphQL user collection',
    complexity: 3,
  })
  childrenGQL(
    @Parent() collection: UserCollection,
    @Args() args: PaginationArgs,
  ) {
    return this.userCollectionService.getChildrenOfUserCollection(
      collection.id,
      args.cursor,
      args.take,
      ReqType.GQL,
    );
  }

  // Queries
  @Query(() => [UserCollection], {
    description: 'Get the root REST user collections for a user',
  })
  @UseGuards(GqlAuthGuard)
  rootRESTUserCollections(
    @GqlUser() user: AuthUser,
    @Args() args: PaginationArgs,
  ) {
    return this.userCollectionService.getUserRootCollections(
      user,
      args.cursor,
      args.take,
      ReqType.REST,
    );
  }

  @Query(() => [UserCollection], {
    description: 'Get the root GraphQL user collections for a user',
  })
  @UseGuards(GqlAuthGuard)
  rootGQLUserCollections(
    @GqlUser() user: AuthUser,
    @Args() args: PaginationArgs,
  ) {
    return this.userCollectionService.getUserRootCollections(
      user,
      args.cursor,
      args.take,
      ReqType.GQL,
    );
  }

  @Query(() => UserCollection, {
    description: 'Get user collection with ID',
  })
  @UseGuards(GqlAuthGuard)
  async userCollection(
    @Args({
      type: () => ID,
      name: 'userCollectionID',
      description: 'ID of the user collection',
    })
    userCollectionID: string,
  ) {
    const userCollection = await this.userCollectionService.getUserCollection(
      userCollectionID,
    );

    if (E.isLeft(userCollection)) throwErr(userCollection.left);
    return <UserCollection>{
      ...userCollection.right,
      userID: userCollection.right.userUid,
      data: !userCollection.right.data
        ? null
        : JSON.stringify(userCollection.right.data),
    };
  }

  @Query(() => UserCollectionExportJSONData, {
    description:
      'Returns the JSON string giving the collections and their contents of a user',
  })
  @UseGuards(GqlAuthGuard)
  async exportUserCollectionsToJSON(
    @GqlUser() user: AuthUser,
    @Args({
      type: () => ID,
      name: 'collectionID',
      description: 'ID of the user collection',
      nullable: true,
      defaultValue: null,
    })
    collectionID: string,
    @Args({
      type: () => ReqType,
      name: 'collectionType',
      description: 'Type of the user collection',
    })
    collectionType: ReqType,
  ) {
    const jsonString =
      await this.userCollectionService.exportUserCollectionsToJSON(
        user.uid,
        collectionID,
        collectionType,
      );

    if (E.isLeft(jsonString)) throwErr(jsonString.left as string);
    return jsonString.right;
  }

  @Query(() => String, {
    description:
      'Returns a JSON string of all the contents of a User Collection',
  })
  @UseGuards(GqlAuthGuard)
  async exportUserCollectionToJSON(
    @GqlUser() user: AuthUser,
    @Args({
      type: () => ID,
      name: 'collectionID',
      description: 'ID of the user collection',
    })
    collectionID: string,
  ) {
    const jsonString =
      await this.userCollectionService.exportUserCollectionToJSONObject(
        user.uid,
        collectionID,
      );

    if (E.isLeft(jsonString)) throwErr(jsonString.left as string);
    return JSON.stringify(jsonString.right);
  }

  // Mutations
  @Mutation(() => UserCollection, {
    description: 'Creates root REST user collection(no parent user collection)',
  })
  @UseGuards(GqlAuthGuard)
  async createRESTRootUserCollection(
    @GqlUser() user: AuthUser,
    @Args() args: CreateRootUserCollectionArgs,
  ) {
    const userCollection =
      await this.userCollectionService.createUserCollection(
        user,
        args.title,
        args.data,
        null,
        ReqType.REST,
      );

    if (E.isLeft(userCollection)) throwErr(userCollection.left);
    return userCollection.right;
  }

  @Mutation(() => UserCollection, {
    description:
      'Creates root GraphQL user collection(no parent user collection)',
  })
  @UseGuards(GqlAuthGuard)
  async createGQLRootUserCollection(
    @GqlUser() user: AuthUser,
    @Args() args: CreateRootUserCollectionArgs,
  ) {
    const userCollection =
      await this.userCollectionService.createUserCollection(
        user,
        args.title,
        args.data,
        null,
        ReqType.GQL,
      );

    if (E.isLeft(userCollection)) throwErr(userCollection.left);
    return userCollection.right;
  }

  @Mutation(() => UserCollection, {
    description: 'Creates a new child GraphQL user collection',
  })
  @UseGuards(GqlAuthGuard)
  async createGQLChildUserCollection(
    @GqlUser() user: AuthUser,
    @Args() args: CreateChildUserCollectionArgs,
  ) {
    const userCollection =
      await this.userCollectionService.createUserCollection(
        user,
        args.title,
        args.data,
        args.parentUserCollectionID,
        ReqType.GQL,
      );

    if (E.isLeft(userCollection)) throwErr(userCollection.left);
    return userCollection.right;
  }

  @Mutation(() => UserCollection, {
    description: 'Creates a new child REST user collection',
  })
  @UseGuards(GqlAuthGuard)
  async createRESTChildUserCollection(
    @GqlUser() user: AuthUser,
    @Args() args: CreateChildUserCollectionArgs,
  ) {
    const userCollection =
      await this.userCollectionService.createUserCollection(
        user,
        args.title,
        args.data,
        args.parentUserCollectionID,
        ReqType.REST,
      );

    if (E.isLeft(userCollection)) throwErr(userCollection.left);
    return userCollection.right;
  }

  @Mutation(() => UserCollection, {
    description: 'Rename a user collection',
  })
  @UseGuards(GqlAuthGuard)
  async renameUserCollection(
    @GqlUser() user: AuthUser,
    @Args() args: RenameUserCollectionsArgs,
  ) {
    const updatedUserCollection =
      await this.userCollectionService.renameUserCollection(
        args.newTitle,
        args.userCollectionID,
        user.uid,
      );

    if (E.isLeft(updatedUserCollection)) throwErr(updatedUserCollection.left);
    return updatedUserCollection.right;
  }

  @Mutation(() => Boolean, {
    description: 'Delete a user collection',
  })
  @UseGuards(GqlAuthGuard)
  async deleteUserCollection(
    @Args({
      name: 'userCollectionID',
      description: 'ID of the user collection',
      type: () => ID,
    })
    userCollectionID: string,
    @GqlUser() user: AuthUser,
  ) {
    const result = await this.userCollectionService.deleteUserCollection(
      userCollectionID,
      user.uid,
    );

    if (E.isLeft(result)) throwErr(result.left);
    return result.right;
  }

  @Mutation(() => UserCollection, {
    description: 'Move user collection into new parent or root',
  })
  @UseGuards(GqlAuthGuard)
  async moveUserCollection(
    @Args() args: MoveUserCollectionArgs,
    @GqlUser() user: AuthUser,
  ) {
    const res = await this.userCollectionService.moveUserCollection(
      args.userCollectionID,
      args.destCollectionID,
      user.uid,
    );
    if (E.isLeft(res)) {
      throwErr(res.left);
    }
    return res.right;
  }

  @Mutation(() => Boolean, {
    description:
      'Update the order of UserCollections inside parent collection or in root',
  })
  @UseGuards(GqlAuthGuard)
  async updateUserCollectionOrder(
    @Args() args: UpdateUserCollectionArgs,
    @GqlUser() user: AuthUser,
  ) {
    const res = await this.userCollectionService.updateUserCollectionOrder(
      args.collectionID,
      args.nextCollectionID,
      user.uid,
    );
    if (E.isLeft(res)) {
      throwErr(res.left);
    }
    return res.right;
  }

  @Mutation(() => Boolean, {
    description: 'Import collections from JSON string to the specified Team',
  })
  @UseGuards(GqlAuthGuard)
  async importUserCollectionsFromJSON(
    @Args() args: ImportUserCollectionsFromJSONArgs,
    @GqlUser() user: AuthUser,
  ) {
    const importedCollection =
      await this.userCollectionService.importCollectionsFromJSON(
        args.jsonString,
        user.uid,
        args.parentCollectionID,
        args.reqType,
      );
    if (E.isLeft(importedCollection)) throwErr(importedCollection.left);
    return importedCollection.right;
  }

  @Mutation(() => UserCollection, {
    description: 'Update a UserCollection',
  })
  @UseGuards(GqlAuthGuard)
  async updateUserCollection(
    @GqlUser() user: AuthUser,
    @Args() args: UpdateUserCollectionsArgs,
  ) {
    const updatedUserCollection =
      await this.userCollectionService.updateUserCollection(
        args.newTitle,
        args.data,
        args.userCollectionID,
        user.uid,
      );

    if (E.isLeft(updatedUserCollection)) throwErr(updatedUserCollection.left);
    return updatedUserCollection.right;
  }

  @Mutation(() => Boolean, {
    description: 'Duplicate a User Collection',
  })
  @UseGuards(GqlAuthGuard)
  async duplicateUserCollection(
    @GqlUser() user: AuthUser,
    @Args({
      name: 'collectionID',
      description: 'ID of the collection',
    })
    collectionID: string,
    @Args({
      name: 'reqType',
      description: 'Type of UserCollection',
      type: () => ReqType,
    })
    reqType: ReqType,
  ) {
    const duplicatedUserCollection =
      await this.userCollectionService.duplicateUserCollection(
        collectionID,
        user.uid,
        reqType,
      );

    if (E.isLeft(duplicatedUserCollection))
      throwErr(duplicatedUserCollection.left);
    return duplicatedUserCollection.right;
  }

  // Subscriptions
  @Subscription(() => UserCollection, {
    description: 'Listen for User Collection Creation',
    resolve: (value) => value,
  })
  @SkipThrottle()
  @UseGuards(GqlAuthGuard)
  userCollectionCreated(@GqlUser() user: AuthUser) {
    return this.pubSub.asyncIterator(`user_coll/${user.uid}/created`);
  }

  @Subscription(() => UserCollection, {
    description: 'Listen to when a User Collection has been updated.',
    resolve: (value) => value,
  })
  @SkipThrottle()
  @UseGuards(GqlAuthGuard)
  userCollectionUpdated(@GqlUser() user: AuthUser) {
    return this.pubSub.asyncIterator(`user_coll/${user.uid}/updated`);
  }

  @Subscription(() => UserCollectionRemovedData, {
    description: 'Listen to when a User Collection has been deleted',
    resolve: (value) => value,
  })
  @SkipThrottle()
  @UseGuards(GqlAuthGuard)
  userCollectionRemoved(@GqlUser() user: AuthUser) {
    return this.pubSub.asyncIterator(`user_coll/${user.uid}/deleted`);
  }

  @Subscription(() => UserCollection, {
    description: 'Listen to when a User Collection has been moved',
    resolve: (value) => value,
  })
  @SkipThrottle()
  @UseGuards(GqlAuthGuard)
  userCollectionMoved(@GqlUser() user: AuthUser) {
    return this.pubSub.asyncIterator(`user_coll/${user.uid}/moved`);
  }

  @Subscription(() => UserCollectionReorderData, {
    description: 'Listen to when a User Collections position has changed',
    resolve: (value) => value,
  })
  @SkipThrottle()
  @UseGuards(GqlAuthGuard)
  userCollectionOrderUpdated(@GqlUser() user: AuthUser) {
    return this.pubSub.asyncIterator(`user_coll/${user.uid}/order_updated`);
  }

  @Subscription(() => UserCollectionDuplicatedData, {
    description: 'Listen to when a User Collection has been duplicated',
    resolve: (value) => value,
  })
  @SkipThrottle()
  @UseGuards(GqlAuthGuard)
  userCollectionDuplicated(@GqlUser() user: AuthUser) {
    return this.pubSub.asyncIterator(`user_coll/${user.uid}/duplicated`);
  }
}
