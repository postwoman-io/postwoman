import { Injectable } from '@nestjs/common';
import {
  USER_COLL_DEST_SAME,
  USER_COLL_IS_PARENT_COLL,
  USER_COLL_NOT_FOUND,
  USER_COLL_NOT_SAME_TYPE,
  USER_COLL_NOT_SAME_USER,
  USER_COLL_REORDERING_FAILED,
  USER_COLL_SAME_NEXT_COLL,
  USER_COLL_SHORT_TITLE,
  USER_COLL_ALREADY_ROOT,
  USER_NOT_FOUND,
  USER_NOT_OWNER,
  USER_COLL_INVALID_JSON,
  USER_COLL_DATA_INVALID,
} from 'src/errors';
import { PrismaService } from 'src/prisma/prisma.service';
import { AuthUser } from 'src/types/AuthUser';
import * as E from 'fp-ts/Either';
import * as O from 'fp-ts/Option';
import { PubSubService } from 'src/pubsub/pubsub.service';
import { Prisma, UserCollection, ReqType as DBReqType } from '@prisma/client';
import {
  UserCollection as UserCollectionModel,
  UserCollectionExportJSONData,
  UserCollectionDuplicatedData,
} from './user-collections.model';
import { ReqType } from 'src/types/RequestTypes';
import {
  isValidLength,
  stringToJson,
  transformCollectionData,
} from 'src/utils';
import { CollectionFolder } from 'src/types/CollectionFolder';

@Injectable()
export class UserCollectionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pubsub: PubSubService,
  ) {}

  TITLE_LENGTH = 1;

  /**
   * Typecast a database UserCollection to a UserCollection model
   * @param userCollection database UserCollection
   * @returns UserCollection model
   */
  private cast(collection: UserCollection) {
    const data = transformCollectionData(collection.data);

    return <UserCollectionModel>{
      id: collection.id,
      title: collection.title,
      type: collection.type,
      parentID: collection.parentID,
      userID: collection.userUid,
      data,
    };
  }

  /**
   * Returns the count of child collections present for a given collectionID
   * * The count returned is highest OrderIndex + 1
   *
   * @param collectionID The Collection ID
   * @returns Number of Child Collections
   */
  private async getChildCollectionsCount(collectionID: string) {
    const childCollectionCount = await this.prisma.userCollection.findMany({
      where: { parentID: collectionID },
      orderBy: {
        orderIndex: 'desc',
      },
    });
    if (!childCollectionCount.length) return 0;
    return childCollectionCount[0].orderIndex;
  }

  /**
   * Returns the count of root collections present for a given userUID
   * * The count returned is highest OrderIndex + 1
   *
   * @param userID The User UID
   * @returns Number of Root Collections
   */
  private async getRootCollectionsCount(userID: string) {
    const rootCollectionCount = await this.prisma.userCollection.findMany({
      where: { userUid: userID, parentID: null },
      orderBy: {
        orderIndex: 'desc',
      },
    });
    if (!rootCollectionCount.length) return 0;
    return rootCollectionCount[0].orderIndex;
  }

  /**
   * Check to see if Collection belongs to User
   *
   * @param collectionID The collection ID
   * @param userID The User ID
   * @returns An Option of a Boolean
   */
  private async isOwnerCheck(collectionID: string, userID: string) {
    try {
      await this.prisma.userCollection.findFirstOrThrow({
        where: {
          id: collectionID,
          userUid: userID,
        },
      });

      return O.some(true);
    } catch (error) {
      return O.none;
    }
  }

  /**
   * Get User of given Collection ID
   *
   * @param collectionID The collection ID
   * @returns User of given Collection ID
   */
  async getUserOfCollection(collectionID: string) {
    try {
      const userCollection = await this.prisma.userCollection.findUniqueOrThrow(
        {
          where: {
            id: collectionID,
          },
          include: {
            user: true,
          },
        },
      );
      return E.right(userCollection.user);
    } catch (error) {
      return E.left(USER_NOT_FOUND);
    }
  }

  /**
   * Get parent of given Collection ID
   *
   * @param collectionID The collection ID
   * @returns Parent UserCollection of given Collection ID
   */
  async getParentOfUserCollection(collectionID: string) {
    const { parent } = await this.prisma.userCollection.findUnique({
      where: {
        id: collectionID,
      },
      include: {
        parent: true,
      },
    });

    return !parent ? null : this.cast(parent);
  }

  /**
   * Get child collections of given Collection ID
   *
   * @param collectionID The collection ID
   * @param cursor collectionID for pagination
   * @param take Number of items we want returned
   * @param type Type of UserCollection
   * @returns A list of child collections
   */
  async getChildrenOfUserCollection(
    collectionID: string,
    cursor: string | null,
    take: number,
    type: ReqType,
  ) {
    const res = await this.prisma.userCollection.findMany({
      where: {
        parentID: collectionID,
        type: type,
      },
      orderBy: {
        orderIndex: 'asc',
      },
      take: take, // default: 10
      skip: cursor ? 1 : 0,
      cursor: cursor ? { id: cursor } : undefined,
    });

    const childCollections = res.map((childCollection) =>
      this.cast(childCollection),
    );

    return childCollections;
  }

  /**
   * Get collection details
   *
   * @param collectionID The collection ID
   * @returns An Either of the Collection details
   */
  async getUserCollection(collectionID: string) {
    try {
      const userCollection = await this.prisma.userCollection.findUniqueOrThrow(
        {
          where: {
            id: collectionID,
          },
        },
      );
      return E.right(userCollection);
    } catch (error) {
      return E.left(USER_COLL_NOT_FOUND);
    }
  }

  /**
   * Create a new UserCollection
   *
   * @param user The User object
   * @param title The title of new UserCollection
   * @param parentUserCollectionID The parent collectionID (null if root collection)
   * @param type Type of Collection we want to create (REST/GQL)
   * @returns
   */
  async createUserCollection(
    user: AuthUser,
    title: string,
    data: string | null = null,
    parentUserCollectionID: string | null,
    type: ReqType,
  ) {
    const isTitleValid = isValidLength(title, this.TITLE_LENGTH);
    if (!isTitleValid) return E.left(USER_COLL_SHORT_TITLE);

    if (data === '') return E.left(USER_COLL_DATA_INVALID);
    if (data) {
      const jsonReq = stringToJson(data);
      if (E.isLeft(jsonReq)) return E.left(USER_COLL_DATA_INVALID);
      data = jsonReq.right;
    }

    // If creating a child collection
    if (parentUserCollectionID !== null) {
      const parentCollection = await this.getUserCollection(
        parentUserCollectionID,
      );
      if (E.isLeft(parentCollection)) return E.left(parentCollection.left);

      // Check to see if parentUserCollectionID belongs to this User
      if (parentCollection.right.userUid !== user.uid)
        return E.left(USER_NOT_OWNER);

      // Check to see if parent collection is of the same type of new collection being created
      if (parentCollection.right.type !== type)
        return E.left(USER_COLL_NOT_SAME_TYPE);
    }

    const isParent = parentUserCollectionID
      ? {
          connect: {
            id: parentUserCollectionID,
          },
        }
      : undefined;

    const userCollection = await this.prisma.userCollection.create({
      data: {
        title: title,
        type: type,
        user: {
          connect: {
            uid: user.uid,
          },
        },
        parent: isParent,
        data: data ?? undefined,
        orderIndex: !parentUserCollectionID
          ? (await this.getRootCollectionsCount(user.uid)) + 1
          : (await this.getChildCollectionsCount(parentUserCollectionID)) + 1,
      },
    });

    await this.pubsub.publish(
      `user_coll/${user.uid}/created`,
      this.cast(userCollection),
    );

    return E.right(this.cast(userCollection));
  }

  /**
   *
   * @param user The User Object
   * @param cursor collectionID for pagination
   * @param take Number of items we want returned
   * @param type Type of UserCollection
   * @returns A list of root UserCollections
   */
  async getUserRootCollections(
    user: AuthUser,
    cursor: string | null,
    take: number,
    type: ReqType,
  ) {
    const res = await this.prisma.userCollection.findMany({
      where: {
        userUid: user.uid,
        parentID: null,
        type: type,
      },
      orderBy: {
        orderIndex: 'asc',
      },
      take: take, // default: 10
      skip: cursor ? 1 : 0,
      cursor: cursor ? { id: cursor } : undefined,
    });

    const userCollections = res.map((childCollection) =>
      this.cast(childCollection),
    );

    return userCollections;
  }

  /**
   *
   * @param user The User Object
   * @param userCollectionID The User UID
   * @param cursor collectionID for pagination
   * @param take Number of items we want returned
   * @param type Type of UserCollection
   * @returns A list of child UserCollections
   */
  async getUserChildCollections(
    user: AuthUser,
    userCollectionID: string,
    cursor: string | null,
    take: number,
    type: ReqType,
  ) {
    const res = await this.prisma.userCollection.findMany({
      where: {
        userUid: user.uid,
        parentID: userCollectionID,
        type: type,
      },
      take: take, // default: 10
      skip: cursor ? 1 : 0,
      cursor: cursor ? { id: cursor } : undefined,
    });

    const childCollections = res.map((childCollection) =>
      this.cast(childCollection),
    );

    return childCollections;
  }

  /**
   * @deprecated Use updateUserCollection method instead
   * Update the title of a UserCollection
   *
   * @param newTitle The new title of collection
   * @param userCollectionID The Collection Id
   * @param userID The User UID
   * @returns An Either of the updated UserCollection
   */
  async renameUserCollection(
    newTitle: string,
    userCollectionID: string,
    userID: string,
  ) {
    const isTitleValid = isValidLength(newTitle, this.TITLE_LENGTH);
    if (!isTitleValid) return E.left(USER_COLL_SHORT_TITLE);

    // Check to see is the collection belongs to the user
    const isOwner = await this.isOwnerCheck(userCollectionID, userID);
    if (O.isNone(isOwner)) return E.left(USER_NOT_OWNER);

    try {
      const updatedUserCollection = await this.prisma.userCollection.update({
        where: {
          id: userCollectionID,
        },
        data: {
          title: newTitle,
        },
      });

      this.pubsub.publish(
        `user_coll/${updatedUserCollection.userUid}/updated`,
        this.cast(updatedUserCollection),
      );

      return E.right(this.cast(updatedUserCollection));
    } catch (error) {
      return E.left(USER_COLL_NOT_FOUND);
    }
  }

  /**
   * Delete a UserCollection from the DB
   *
   * @param collectionID The Collection Id
   * @returns The deleted UserCollection
   */
  private async removeUserCollection(collectionID: string) {
    try {
      const deletedUserCollection = await this.prisma.userCollection.delete({
        where: {
          id: collectionID,
        },
      });

      return E.right(deletedUserCollection);
    } catch (error) {
      return E.left(USER_COLL_NOT_FOUND);
    }
  }

  /**
   * Delete child collection and requests of a UserCollection
   *
   * @param collectionID The Collection Id
   * @returns A Boolean of deletion status
   */
  private async deleteCollectionData(collection: UserCollection) {
    // Get all child collections in collectionID
    const childCollectionList = await this.prisma.userCollection.findMany({
      where: {
        parentID: collection.id,
      },
    });

    // Delete child collections
    await Promise.all(
      childCollectionList.map((coll) =>
        this.deleteUserCollection(coll.id, coll.userUid),
      ),
    );

    // Delete all requests in collectionID
    await this.prisma.userRequest.deleteMany({
      where: {
        collectionID: collection.id,
      },
    });

    // Update orderIndexes in userCollection table for user
    await this.updateOrderIndex(
      collection.parentID,
      { gt: collection.orderIndex },
      { decrement: 1 },
    );

    // Delete collection from UserCollection table
    const deletedUserCollection = await this.removeUserCollection(
      collection.id,
    );
    if (E.isLeft(deletedUserCollection))
      return E.left(deletedUserCollection.left);

    this.pubsub.publish(
      `user_coll/${deletedUserCollection.right.userUid}/deleted`,
      {
        id: deletedUserCollection.right.id,
        type: ReqType[deletedUserCollection.right.type],
      },
    );

    return E.right(true);
  }

  /**
   * Delete a UserCollection
   *
   * @param collectionID The Collection Id
   * @param userID The User UID
   * @returns An Either of Boolean of deletion status
   */
  async deleteUserCollection(collectionID: string, userID: string) {
    // Get collection details of collectionID
    const collection = await this.getUserCollection(collectionID);
    if (E.isLeft(collection)) return E.left(USER_COLL_NOT_FOUND);

    // Check to see is the collection belongs to the user
    if (collection.right.userUid !== userID) return E.left(USER_NOT_OWNER);

    // Delete all child collections and requests in the collection
    const collectionData = await this.deleteCollectionData(collection.right);
    if (E.isLeft(collectionData)) return E.left(collectionData.left);

    return E.right(true);
  }

  /**
   * Change parentID of UserCollection's
   *
   * @param collectionID The collection ID
   * @param parentCollectionID The new parent's collection ID or change to root collection
   * @returns  If successful return an Either of true
   */
  private async changeParent(
    collection: UserCollection,
    parentCollectionID: string | null,
  ) {
    try {
      let collectionCount: number;

      if (!parentCollectionID)
        collectionCount = await this.getRootCollectionsCount(
          collection.userUid,
        );
      collectionCount = await this.getChildCollectionsCount(parentCollectionID);

      const updatedCollection = await this.prisma.userCollection.update({
        where: {
          id: collection.id,
        },
        data: {
          // if parentCollectionID == null, collection becomes root collection
          // if parentCollectionID != null, collection becomes child collection
          parentID: parentCollectionID,
          orderIndex: collectionCount + 1,
        },
      });

      return E.right(updatedCollection);
    } catch (error) {
      return E.left(USER_COLL_NOT_FOUND);
    }
  }

  /**
   * Check if collection is parent of destCollection
   *
   * @param collection The ID of collection being moved
   * @param destCollection The ID of collection into which we are moving target collection into
   * @returns An Option of boolean, is parent or not
   */
  private async isParent(
    collection: UserCollection,
    destCollection: UserCollection,
  ): Promise<O.Option<boolean>> {
    // Check if collection and destCollection are same
    if (collection === destCollection) {
      return O.none;
    }
    if (destCollection.parentID !== null) {
      // Check if ID of collection is same as parent of destCollection
      if (destCollection.parentID === collection.id) {
        return O.none;
      }
      // Get collection details of collection one step above in the tree i.e the parent collection
      const parentCollection = await this.getUserCollection(
        destCollection.parentID,
      );
      if (E.isLeft(parentCollection)) {
        return O.none;
      }
      // Call isParent again now with parent collection
      return await this.isParent(collection, parentCollection.right);
    } else {
      return O.some(true);
    }
  }

  /**
   * Update the OrderIndex of all collections in given parentID
   *
   * @param parentID The Parent collectionID
   * @param orderIndexCondition Condition to decide what collections will be updated
   * @param dataCondition Increment/Decrement OrderIndex condition
   * @returns A Collection with updated OrderIndexes
   */
  private async updateOrderIndex(
    parentID: string,
    orderIndexCondition: Prisma.IntFilter,
    dataCondition: Prisma.IntFieldUpdateOperationsInput,
  ) {
    const updatedUserCollection = await this.prisma.userCollection.updateMany({
      where: {
        parentID: parentID,
        orderIndex: orderIndexCondition,
      },
      data: { orderIndex: dataCondition },
    });

    return updatedUserCollection;
  }

  /**
   * Move UserCollection into root or another collection
   *
   * @param userCollectionID The ID of collection being moved
   * @param destCollectionID The ID of collection the target collection is being moved into or move target collection to root
   * @param userID The User UID
   * @returns An Either of the moved UserCollection
   */
  async moveUserCollection(
    userCollectionID: string,
    destCollectionID: string | null,
    userID: string,
  ) {
    // Get collection details of collectionID
    const collection = await this.getUserCollection(userCollectionID);
    if (E.isLeft(collection)) return E.left(USER_COLL_NOT_FOUND);

    // Check to see is the collection belongs to the user
    if (collection.right.userUid !== userID) return E.left(USER_NOT_OWNER);

    // destCollectionID == null i.e move collection to root
    if (!destCollectionID) {
      if (!collection.right.parentID) {
        // collection is a root collection
        // Throw error if collection is already a root collection
        return E.left(USER_COLL_ALREADY_ROOT);
      }
      // Move child collection into root and update orderIndexes for root userCollections
      await this.updateOrderIndex(
        collection.right.parentID,
        { gt: collection.right.orderIndex },
        { decrement: 1 },
      );

      // Change parent from child to root i.e child collection becomes a root collection
      const updatedCollection = await this.changeParent(collection.right, null);
      if (E.isLeft(updatedCollection)) return E.left(updatedCollection.left);

      this.pubsub.publish(
        `user_coll/${collection.right.userUid}/moved`,
        this.cast(updatedCollection.right),
      );

      return E.right(this.cast(updatedCollection.right));
    }

    // destCollectionID != null i.e move into another collection
    if (userCollectionID === destCollectionID) {
      // Throw error if collectionID and destCollectionID are the same
      return E.left(USER_COLL_DEST_SAME);
    }

    // Get collection details of destCollectionID
    const destCollection = await this.getUserCollection(destCollectionID);
    if (E.isLeft(destCollection)) return E.left(USER_COLL_NOT_FOUND);

    // Check if collection and destCollection belong to the same collection type
    if (collection.right.type !== destCollection.right.type) {
      return E.left(USER_COLL_NOT_SAME_TYPE);
    }

    // Check if collection and destCollection belong to the same user account
    if (collection.right.userUid !== destCollection.right.userUid) {
      return E.left(USER_COLL_NOT_SAME_USER);
    }

    // Check if collection is present on the parent tree for destCollection
    const checkIfParent = await this.isParent(
      collection.right,
      destCollection.right,
    );
    if (O.isNone(checkIfParent)) {
      return E.left(USER_COLL_IS_PARENT_COLL);
    }

    // Move root/child collection into another child collection and update orderIndexes of the previous parent
    await this.updateOrderIndex(
      collection.right.parentID,
      { gt: collection.right.orderIndex },
      { decrement: 1 },
    );

    // Change parent from null to teamCollection i.e collection becomes a child collection
    const updatedCollection = await this.changeParent(
      collection.right,
      destCollection.right.id,
    );
    if (E.isLeft(updatedCollection)) return E.left(updatedCollection.left);

    this.pubsub.publish(
      `user_coll/${collection.right.userUid}/moved`,
      this.cast(updatedCollection.right),
    );

    return E.right(this.cast(updatedCollection.right));
  }

  /**
   * Find the number of child collections present in collectionID
   *
   * @param collectionID The Collection ID
   * @returns Number of collections
   */
  getCollectionCount(collectionID: string): Promise<number> {
    return this.prisma.userCollection.count({
      where: { parentID: collectionID },
    });
  }

  /**
   * Update order of root or child collectionID's
   *
   * @param collectionID The ID of collection being re-ordered
   * @param nextCollectionID The ID of collection that is after the moved collection in its new position
   * @param userID The User UID
   * @returns If successful return an Either of true
   */
  async updateUserCollectionOrder(
    collectionID: string,
    nextCollectionID: string | null,
    userID: string,
  ) {
    // Throw error if collectionID and nextCollectionID are the same
    if (collectionID === nextCollectionID)
      return E.left(USER_COLL_SAME_NEXT_COLL);

    // Get collection details of collectionID
    const collection = await this.getUserCollection(collectionID);
    if (E.isLeft(collection)) return E.left(USER_COLL_NOT_FOUND);

    // Check to see is the collection belongs to the user
    if (collection.right.userUid !== userID) return E.left(USER_NOT_OWNER);

    if (!nextCollectionID) {
      // nextCollectionID == null i.e move collection to the end of the list
      try {
        await this.prisma.$transaction(async (tx) => {
          // Step 1: Decrement orderIndex of all items that come after collection.orderIndex till end of list of items
          await tx.userCollection.updateMany({
            where: {
              parentID: collection.right.parentID,
              orderIndex: {
                gte: collection.right.orderIndex + 1,
              },
            },
            data: {
              orderIndex: { decrement: 1 },
            },
          });
          // Step 2: Update orderIndex of collection to length of list
          const updatedUserCollection = await tx.userCollection.update({
            where: { id: collection.right.id },
            data: {
              orderIndex: await this.getCollectionCount(
                collection.right.parentID,
              ),
            },
          });
        });

        this.pubsub.publish(
          `user_coll/${collection.right.userUid}/order_updated`,
          {
            userCollection: this.cast(collection.right),
            nextUserCollection: null,
          },
        );

        return E.right(true);
      } catch (error) {
        return E.left(USER_COLL_REORDERING_FAILED);
      }
    }

    // nextCollectionID != null i.e move to a certain position
    // Get collection details of nextCollectionID
    const subsequentCollection = await this.getUserCollection(nextCollectionID);
    if (E.isLeft(subsequentCollection)) return E.left(USER_COLL_NOT_FOUND);

    if (collection.right.userUid !== subsequentCollection.right.userUid)
      return E.left(USER_COLL_NOT_SAME_USER);

    // Check if collection and subsequentCollection belong to the same collection type
    if (collection.right.type !== subsequentCollection.right.type) {
      return E.left(USER_COLL_NOT_SAME_TYPE);
    }

    try {
      await this.prisma.$transaction(async (tx) => {
        // Step 1: Determine if we are moving collection up or down the list
        const isMovingUp =
          subsequentCollection.right.orderIndex < collection.right.orderIndex;
        // Step 2: Update OrderIndex of items in list depending on moving up or down
        const updateFrom = isMovingUp
          ? subsequentCollection.right.orderIndex
          : collection.right.orderIndex + 1;

        const updateTo = isMovingUp
          ? collection.right.orderIndex - 1
          : subsequentCollection.right.orderIndex - 1;

        await tx.userCollection.updateMany({
          where: {
            parentID: collection.right.parentID,
            orderIndex: { gte: updateFrom, lte: updateTo },
          },
          data: {
            orderIndex: isMovingUp ? { increment: 1 } : { decrement: 1 },
          },
        });
        // Step 3: Update OrderIndex of collection
        const updatedUserCollection = await tx.userCollection.update({
          where: { id: collection.right.id },
          data: {
            orderIndex: isMovingUp
              ? subsequentCollection.right.orderIndex
              : subsequentCollection.right.orderIndex - 1,
          },
        });
      });

      this.pubsub.publish(
        `user_coll/${collection.right.userUid}/order_updated`,
        {
          userCollection: this.cast(collection.right),
          nextUserCollection: this.cast(subsequentCollection.right),
        },
      );

      return E.right(true);
    } catch (error) {
      return E.left(USER_COLL_REORDERING_FAILED);
    }
  }

  /**
   * Generate a JSON containing all the contents of a collection
   *
   * @param userUID The User UID
   * @param collectionID The Collection ID
   * @returns A JSON string containing all the contents of a collection
   */
  async exportUserCollectionToJSONObject(
    userUID: string,
    collectionID: string,
  ): Promise<E.Left<string> | E.Right<CollectionFolder>> {
    // Get Collection details
    const collection = await this.getUserCollection(collectionID);
    if (E.isLeft(collection)) return E.left(collection.left);

    // Get all child collections whose parentID === collectionID
    const childCollectionList = await this.prisma.userCollection.findMany({
      where: {
        parentID: collectionID,
        userUid: userUID,
      },
      orderBy: {
        orderIndex: 'asc',
      },
    });

    // Create a list of child collection and request data ready for export
    const childrenCollectionObjects: CollectionFolder[] = [];
    for (const coll of childCollectionList) {
      const result = await this.exportUserCollectionToJSONObject(
        userUID,
        coll.id,
      );
      if (E.isLeft(result)) return E.left(result.left);

      childrenCollectionObjects.push(result.right);
    }

    // Fetch all child requests that belong to collectionID
    const requests = await this.prisma.userRequest.findMany({
      where: {
        userUid: userUID,
        collectionID,
      },
      orderBy: {
        orderIndex: 'asc',
      },
    });

    const data = transformCollectionData(collection.right.data);

    const result: CollectionFolder = {
      id: collection.right.id,
      name: collection.right.title,
      folders: childrenCollectionObjects,
      requests: requests.map((x) => {
        return {
          id: x.id,
          name: x.title,
          ...(x.request as Record<string, unknown>), // type casting x.request of type Prisma.JSONValue to an object to enable spread
        };
      }),
      data,
    };

    return E.right(result);
  }

  /**
   * Generate a JSON containing all the contents of collections and requests of a team
   *
   * @param userUID The User UID
   * @returns A JSON string containing all the contents of collections and requests of a team
   */
  async exportUserCollectionsToJSON(
    userUID: string,
    collectionID: string | null,
    reqType: ReqType,
  ) {
    // Get all child collections details
    const childCollectionList = await this.prisma.userCollection.findMany({
      where: {
        userUid: userUID,
        parentID: collectionID,
        type: reqType,
      },
      orderBy: {
        orderIndex: 'asc',
      },
    });

    // Create a list of child collection and request data ready for export
    const collectionListObjects: CollectionFolder[] = [];
    for (const coll of childCollectionList) {
      const result = await this.exportUserCollectionToJSONObject(
        userUID,
        coll.id,
      );
      if (E.isLeft(result)) return E.left(result.left);

      collectionListObjects.push(result.right);
    }

    // If collectionID is not null, return JSONified data for specific collection
    if (collectionID) {
      // Get Details of collection
      const parentCollection = await this.getUserCollection(collectionID);
      if (E.isLeft(parentCollection)) return E.left(parentCollection.left);

      if (parentCollection.right.type !== reqType)
        return E.left(USER_COLL_NOT_SAME_TYPE);

      // Fetch all child requests that belong to collectionID
      const requests = await this.prisma.userRequest.findMany({
        where: {
          userUid: userUID,
          collectionID: parentCollection.right.id,
        },
        orderBy: {
          orderIndex: 'asc',
        },
      });

      return E.right(<UserCollectionExportJSONData>{
        exportedCollection: JSON.stringify({
          id: parentCollection.right.id,
          name: parentCollection.right.title,
          folders: collectionListObjects,
          requests: requests.map((x) => {
            return {
              id: x.id,
              name: x.title,
              ...(x.request as Record<string, unknown>), // type casting x.request of type Prisma.JSONValue to an object to enable spread
            };
          }),
          data: JSON.stringify(parentCollection.right.data),
        }),
        collectionType: parentCollection.right.type,
      });
    }

    return E.right(<UserCollectionExportJSONData>{
      exportedCollection: JSON.stringify(collectionListObjects),
      collectionType: reqType,
    });
  }

  /**
   * Generate a Prisma query object representation of a collection and its child collections and requests
   *
   * @param folder CollectionFolder from client
   * @param userID The User ID
   * @param orderIndex Initial OrderIndex of
   * @param reqType The Type of Collection
   * @returns A Prisma query object to create a collection, its child collections and requests
   */
  private generatePrismaQueryObj(
    folder: CollectionFolder,
    userID: string,
    orderIndex: number,
    reqType: DBReqType,
  ): Prisma.UserCollectionCreateInput {
    return {
      title: folder.name,
      user: {
        connect: {
          uid: userID,
        },
      },
      requests: {
        create: folder.requests.map((r, index) => ({
          title: r.name,
          user: {
            connect: {
              uid: userID,
            },
          },
          type: reqType,
          request: r,
          orderIndex: index + 1,
        })),
      },
      orderIndex: orderIndex,
      type: reqType,
      children: {
        create: folder.folders.map((f, index) =>
          this.generatePrismaQueryObj(f, userID, index + 1, reqType),
        ),
      },
      data: folder.data ?? undefined,
    };
  }

  /**
   * Create new UserCollections and UserRequests from JSON string
   *
   * @param jsonString The JSON string of the content
   * @param userID The User ID
   * @param destCollectionID The Collection ID
   * @param reqType The Type of Collection
   * @returns An Either of a Boolean if the creation operation was successful
   */
  async importCollectionsFromJSON(
    jsonString: string,
    userID: string,
    destCollectionID: string | null,
    reqType: DBReqType,
    isCollectionDuplication = false,
  ) {
    // Check to see if jsonString is valid
    const collectionsList = stringToJson<CollectionFolder[]>(jsonString);
    if (E.isLeft(collectionsList)) return E.left(USER_COLL_INVALID_JSON);

    // Check to see if parsed jsonString is an array
    if (!Array.isArray(collectionsList.right))
      return E.left(USER_COLL_INVALID_JSON);

    // Check to see if destCollectionID belongs to this User
    if (destCollectionID) {
      const parentCollection = await this.getUserCollection(destCollectionID);
      if (E.isLeft(parentCollection)) return E.left(parentCollection.left);

      // Check to see if parentUserCollectionID belongs to this User
      if (parentCollection.right.userUid !== userID)
        return E.left(USER_NOT_OWNER);

      // Check to see if parent collection is of the same type of new collection being created
      if (parentCollection.right.type !== reqType)
        return E.left(USER_COLL_NOT_SAME_TYPE);
    }

    // Get number of root or child collections for destCollectionID(if destcollectionID != null) or destTeamID(if destcollectionID == null)
    const count = !destCollectionID
      ? await this.getRootCollectionsCount(userID)
      : await this.getChildCollectionsCount(destCollectionID);

    // Generate Prisma Query Object for all child collections in collectionsList
    const queryList = collectionsList.right.map((x) =>
      this.generatePrismaQueryObj(x, userID, count + 1, reqType),
    );

    const parent = destCollectionID
      ? {
          connect: {
            id: destCollectionID,
          },
        }
      : undefined;

    const userCollections = await this.prisma.$transaction(
      queryList.map((x) =>
        this.prisma.userCollection.create({
          data: {
            ...x,
            parent,
          },
        }),
      ),
    );

    if (isCollectionDuplication) {
      const collectionData = await this.fetchCollectionData(
        userCollections[0].id,
      );
      if (E.isRight(collectionData)) {
        this.pubsub.publish(
          `user_coll/${userID}/duplicated`,
          collectionData.right,
        );
      }
    } else {
      userCollections.forEach((collection) =>
        this.pubsub.publish(
          `user_coll/${userID}/created`,
          this.cast(collection),
        ),
      );
    }

    return E.right(true);
  }

  /**
   * Update a UserCollection
   *
   * @param newTitle The new title of collection
   * @param userCollectionID The Collection Id
   * @param userID The User UID
   * @returns An Either of the updated UserCollection
   */
  async updateUserCollection(
    newTitle: string = null,
    collectionData: string | null = null,
    userCollectionID: string,
    userID: string,
  ) {
    if (collectionData === '') return E.left(USER_COLL_DATA_INVALID);

    if (collectionData) {
      const jsonReq = stringToJson(collectionData);
      if (E.isLeft(jsonReq)) return E.left(USER_COLL_DATA_INVALID);
      collectionData = jsonReq.right;
    }

    if (newTitle != null) {
      const isTitleValid = isValidLength(newTitle, this.TITLE_LENGTH);
      if (!isTitleValid) return E.left(USER_COLL_SHORT_TITLE);
    }

    // Check to see is the collection belongs to the user
    const isOwner = await this.isOwnerCheck(userCollectionID, userID);
    if (O.isNone(isOwner)) return E.left(USER_NOT_OWNER);

    try {
      const updatedUserCollection = await this.prisma.userCollection.update({
        where: {
          id: userCollectionID,
        },
        data: {
          data: collectionData ?? undefined,
          title: newTitle ?? undefined,
        },
      });

      this.pubsub.publish(
        `user_coll/${updatedUserCollection.userUid}/updated`,
        this.cast(updatedUserCollection),
      );

      return E.right(this.cast(updatedUserCollection));
    } catch (error) {
      return E.left(USER_COLL_NOT_FOUND);
    }
  }

  /**
   * Duplicate a User Collection
   *
   * @param collectionID The Collection ID
   * @returns Boolean of duplication status
   */
  async duplicateUserCollection(
    collectionID: string,
    userID: string,
    reqType: DBReqType,
  ) {
    const collection = await this.getUserCollection(collectionID);
    if (E.isLeft(collection)) return E.left(USER_COLL_NOT_FOUND);

    if (collection.right.userUid !== userID) return E.left(USER_NOT_OWNER);
    if (collection.right.type !== reqType)
      return E.left(USER_COLL_NOT_SAME_TYPE);

    const collectionJSONObject = await this.exportUserCollectionToJSONObject(
      collection.right.userUid,
      collectionID,
    );
    if (E.isLeft(collectionJSONObject))
      return E.left(collectionJSONObject.left);

    const result = await this.importCollectionsFromJSON(
      JSON.stringify([
        {
          ...collectionJSONObject.right,
          name: `${collection.right.title} - Duplicate`,
        },
      ]),
      userID,
      collection.right.parentID,
      reqType,
      true,
    );
    if (E.isLeft(result)) return E.left(result.left as string);

    return E.right(true);
  }

  /**
   * Generates a JSON containing all the contents of a collection
   *
   * @param collection Collection whose details we want to fetch
   * @returns A JSON string containing all the contents of a collection
   */
  private async fetchCollectionData(
    collectionID: string,
  ): Promise<E.Left<string> | E.Right<UserCollectionDuplicatedData>> {
    const collection = await this.getUserCollection(collectionID);
    if (E.isLeft(collection)) return E.left(collection.left);

    const { id, title, data, type, parentID, userUid } = collection.right;
    const orderIndex = 'asc';

    const [childCollections, requests] = await Promise.all([
      this.prisma.userCollection.findMany({
        where: { parentID: id },
        orderBy: { orderIndex },
      }),
      this.prisma.userRequest.findMany({
        where: { collectionID: id },
        orderBy: { orderIndex },
      }),
    ]);

    const childCollectionDataList = await Promise.all(
      childCollections.map(({ id }) => this.fetchCollectionData(id)),
    );

    const failedChildData = childCollectionDataList.find(E.isLeft);
    if (failedChildData) return E.left(failedChildData.left);

    const childCollectionsJSONStr = JSON.stringify(
      (childCollectionDataList as E.Right<UserCollectionDuplicatedData>[]).map(
        (childCollection) => childCollection.right,
      ),
    );

    const transformedRequests = requests.map((requestObj) => ({
      ...requestObj,
      request: JSON.stringify(requestObj.request),
    }));

    return E.right(<UserCollectionDuplicatedData>{
      id,
      title,
      data,
      type,
      parentID,
      userID: userUid,
      childCollections: childCollectionsJSONStr,
      requests: transformedRequests,
    });
  }
}
