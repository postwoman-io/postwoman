import {
  Resolver,
  ResolveField,
  Parent,
  Args,
  Query,
  Mutation,
  Subscription,
  ID,
} from '@nestjs/graphql';
import { CollectionReorderData, TeamCollection } from './team-collection.model';
import { Team, TeamMemberRole } from '../team/team.model';
import { TeamCollectionService } from './team-collection.service';
import { GqlAuthGuard } from '../guards/gql-auth.guard';
import { GqlTeamMemberGuard } from '../team/guards/gql-team-member.guard';
import { UseGuards } from '@nestjs/common';
import { RequiresTeamRole } from '../team/decorators/requires-team-role.decorator';
import { GqlCollectionTeamMemberGuard } from './guards/gql-collection-team-member.guard';
import { PubSubService } from 'src/pubsub/pubsub.service';
import { PaginationArgs } from 'src/types/input-types.args';
import {
  CreateChildTeamCollectionArgs,
  CreateRootTeamCollectionArgs,
  GetRootTeamCollectionsArgs,
  MoveTeamCollectionArgs,
  RenameTeamCollectionArgs,
  ReplaceTeamCollectionArgs,
  UpdateTeamCollectionArgs,
  UpdateTeamCollectionOrderArgs,
} from './input-type.args';
import * as E from 'fp-ts/Either';
import { throwErr } from 'src/utils';
import { GqlThrottlerGuard } from 'src/guards/gql-throttler.guard';
import { SkipThrottle } from '@nestjs/throttler';

@UseGuards(GqlThrottlerGuard)
@Resolver(() => TeamCollection)
export class TeamCollectionResolver {
  constructor(
    private readonly teamCollectionService: TeamCollectionService,
    private readonly pubsub: PubSubService,
  ) {}

  // Field resolvers
  @ResolveField(() => Team, {
    description: 'Team the collection belongs to',
    complexity: 5,
  })
  async team(@Parent() collection: TeamCollection) {
    const team = await this.teamCollectionService.getTeamOfCollection(
      collection.id,
    );
    if (E.isLeft(team)) throwErr(team.left);
    return team.right;
  }

  @ResolveField(() => TeamCollection, {
    description: 'Return the parent Team Collection (null if root )',
    nullable: true,
    complexity: 3,
  })
  async parent(@Parent() collection: TeamCollection) {
    return this.teamCollectionService.getParentOfCollection(collection.id);
  }

  @ResolveField(() => [TeamCollection], {
    description: 'List of children Team Collections',
    complexity: 3,
  })
  async children(
    @Parent() collection: TeamCollection,
    @Args() args: PaginationArgs,
  ) {
    return this.teamCollectionService.getChildrenOfCollection(
      collection.id,
      args.cursor,
      args.take,
    );
  }

  // Queries

  @Query(() => String, {
    description:
      'Returns the JSON string giving the collections and their contents of the team',
  })
  @UseGuards(GqlAuthGuard, GqlTeamMemberGuard)
  @RequiresTeamRole(
    TeamMemberRole.VIEWER,
    TeamMemberRole.EDITOR,
    TeamMemberRole.OWNER,
  )
  async exportCollectionsToJSON(
    @Args({ name: 'teamID', description: 'ID of the team', type: () => ID })
    teamID: string,
  ) {
    const jsonString = await this.teamCollectionService.exportCollectionsToJSON(
      teamID,
    );

    if (E.isLeft(jsonString)) throwErr(jsonString.left as string);
    return jsonString.right;
  }

  @Query(() => String, {
    description:
      'Returns a JSON string of all the contents of a Team Collection',
  })
  @UseGuards(GqlAuthGuard, GqlTeamMemberGuard)
  @RequiresTeamRole(
    TeamMemberRole.VIEWER,
    TeamMemberRole.EDITOR,
    TeamMemberRole.OWNER,
  )
  async exportCollectionToJSON(
    @Args({ name: 'teamID', description: 'ID of the team', type: () => ID })
    teamID: string,
    @Args({
      name: 'collectionID',
      description: 'ID of the collection',
      type: () => ID,
    })
    collectionID: string,
  ) {
    const collectionData =
      await this.teamCollectionService.exportCollectionToJSONObject(
        teamID,
        collectionID,
      );

    if (E.isLeft(collectionData)) throwErr(collectionData.left as string);
    return JSON.stringify(collectionData.right);
  }

  @Query(() => [TeamCollection], {
    description: 'Returns the collections of a team',
  })
  @UseGuards(GqlAuthGuard, GqlTeamMemberGuard)
  @RequiresTeamRole(
    TeamMemberRole.VIEWER,
    TeamMemberRole.EDITOR,
    TeamMemberRole.OWNER,
  )
  async rootCollectionsOfTeam(@Args() args: GetRootTeamCollectionsArgs) {
    return this.teamCollectionService.getTeamRootCollections(
      args.teamID,
      args.cursor,
      args.take,
    );
  }

  @Query(() => TeamCollection, {
    description: 'Get a Team Collection with ID or null (if not exists)',
    nullable: true,
  })
  @UseGuards(GqlAuthGuard, GqlCollectionTeamMemberGuard)
  @RequiresTeamRole(
    TeamMemberRole.VIEWER,
    TeamMemberRole.EDITOR,
    TeamMemberRole.OWNER,
  )
  async collection(
    @Args({
      name: 'collectionID',
      description: 'ID of the collection',
      type: () => ID,
    })
    collectionID: string,
  ) {
    const teamCollections = await this.teamCollectionService.getCollection(
      collectionID,
    );

    if (E.isLeft(teamCollections)) throwErr(teamCollections.left);
    return <TeamCollection>{
      id: teamCollections.right.id,
      title: teamCollections.right.title,
      parentID: teamCollections.right.parentID,
      data: !teamCollections.right.data
        ? null
        : JSON.stringify(teamCollections.right.data),
    };
  }

  // Mutations
  @Mutation(() => TeamCollection, {
    description:
      'Creates a collection at the root of the team hierarchy (no parent collection)',
  })
  @UseGuards(GqlAuthGuard, GqlTeamMemberGuard)
  @RequiresTeamRole(TeamMemberRole.OWNER, TeamMemberRole.EDITOR)
  async createRootCollection(@Args() args: CreateRootTeamCollectionArgs) {
    const teamCollection = await this.teamCollectionService.createCollection(
      args.teamID,
      args.title,
      args.data,
      null,
    );

    if (E.isLeft(teamCollection)) throwErr(teamCollection.left);
    return teamCollection.right;
  }

  @Mutation(() => Boolean, {
    description: 'Import collections from JSON string to the specified Team',
  })
  @UseGuards(GqlAuthGuard, GqlTeamMemberGuard)
  @RequiresTeamRole(TeamMemberRole.OWNER, TeamMemberRole.EDITOR)
  async importCollectionsFromJSON(
    @Args({
      name: 'teamID',
      type: () => ID,
      description: 'Id of the team to add to',
    })
    teamID: string,
    @Args({
      name: 'jsonString',
      description: 'JSON string to import',
    })
    jsonString: string,
    @Args({
      name: 'parentCollectionID',
      type: () => ID,
      description:
        'ID to the collection to which to import to (null if to import to the root of team)',
      nullable: true,
    })
    parentCollectionID?: string,
  ): Promise<boolean> {
    const importedCollection =
      await this.teamCollectionService.importCollectionsFromJSON(
        jsonString,
        teamID,
        parentCollectionID ?? null,
      );
    if (E.isLeft(importedCollection)) throwErr(importedCollection.left);
    return importedCollection.right;
  }

  @Mutation(() => Boolean, {
    description:
      'Replace existing collections of a specific team with collections in JSON string',
  })
  @UseGuards(GqlAuthGuard, GqlTeamMemberGuard)
  @RequiresTeamRole(TeamMemberRole.OWNER, TeamMemberRole.EDITOR)
  async replaceCollectionsWithJSON(@Args() args: ReplaceTeamCollectionArgs) {
    const teamCollection =
      await this.teamCollectionService.replaceCollectionsWithJSON(
        args.jsonString,
        args.teamID,
        args.parentCollectionID ?? null,
      );

    if (E.isLeft(teamCollection)) throwErr(teamCollection.left);
    return teamCollection.right;
  }

  @Mutation(() => TeamCollection, {
    description: 'Create a collection that has a parent collection',
  })
  @UseGuards(GqlAuthGuard, GqlCollectionTeamMemberGuard)
  @RequiresTeamRole(TeamMemberRole.OWNER, TeamMemberRole.EDITOR)
  async createChildCollection(@Args() args: CreateChildTeamCollectionArgs) {
    const team = await this.teamCollectionService.getTeamOfCollection(
      args.collectionID,
    );
    if (E.isLeft(team)) throwErr(team.left);

    const teamCollection = await this.teamCollectionService.createCollection(
      team.right.id,
      args.childTitle,
      args.data,
      args.collectionID,
    );

    if (E.isLeft(teamCollection)) throwErr(teamCollection.left);
    return teamCollection.right;
  }

  @Mutation(() => TeamCollection, {
    description: 'Rename a collection',
    deprecationReason: 'Switch to updateTeamCollection mutation instead',
  })
  @UseGuards(GqlAuthGuard, GqlCollectionTeamMemberGuard)
  @RequiresTeamRole(TeamMemberRole.OWNER, TeamMemberRole.EDITOR)
  async renameCollection(@Args() args: RenameTeamCollectionArgs) {
    const updatedTeamCollection =
      await this.teamCollectionService.renameCollection(
        args.collectionID,
        args.newTitle,
      );

    if (E.isLeft(updatedTeamCollection)) throwErr(updatedTeamCollection.left);
    return updatedTeamCollection.right;
  }

  @Mutation(() => Boolean, {
    description: 'Delete a collection',
  })
  @UseGuards(GqlAuthGuard, GqlCollectionTeamMemberGuard)
  @RequiresTeamRole(TeamMemberRole.OWNER, TeamMemberRole.EDITOR)
  async deleteCollection(
    @Args({
      name: 'collectionID',
      description: 'ID of the collection',
      type: () => ID,
    })
    collectionID: string,
  ) {
    const result = await this.teamCollectionService.deleteCollection(
      collectionID,
    );

    if (E.isLeft(result)) throwErr(result.left);
    return result.right;
  }

  @Mutation(() => TeamCollection, {
    description:
      'Move a collection into a new parent collection or the root of the team',
  })
  @UseGuards(GqlAuthGuard, GqlCollectionTeamMemberGuard)
  @RequiresTeamRole(TeamMemberRole.OWNER, TeamMemberRole.EDITOR)
  async moveCollection(@Args() args: MoveTeamCollectionArgs) {
    const res = await this.teamCollectionService.moveCollection(
      args.collectionID,
      args.parentCollectionID,
    );
    if (E.isLeft(res)) throwErr(res.left);
    return res.right;
  }

  @Mutation(() => Boolean, {
    description: 'Update the order of collections',
  })
  @UseGuards(GqlAuthGuard, GqlCollectionTeamMemberGuard)
  @RequiresTeamRole(TeamMemberRole.OWNER, TeamMemberRole.EDITOR)
  async updateCollectionOrder(@Args() args: UpdateTeamCollectionOrderArgs) {
    const request = await this.teamCollectionService.updateCollectionOrder(
      args.collectionID,
      args.destCollID,
    );
    if (E.isLeft(request)) throwErr(request.left);
    return request.right;
  }

  @Mutation(() => TeamCollection, {
    description: 'Update Team Collection details',
  })
  @UseGuards(GqlAuthGuard, GqlCollectionTeamMemberGuard)
  @RequiresTeamRole(TeamMemberRole.OWNER, TeamMemberRole.EDITOR)
  async updateTeamCollection(@Args() args: UpdateTeamCollectionArgs) {
    const updatedTeamCollection =
      await this.teamCollectionService.updateTeamCollection(
        args.collectionID,
        args.data,
        args.newTitle,
      );

    if (E.isLeft(updatedTeamCollection)) throwErr(updatedTeamCollection.left);
    return updatedTeamCollection.right;
  }

  @Mutation(() => Boolean, {
    description: 'Duplicate a Team Collection',
  })
  @UseGuards(GqlAuthGuard, GqlCollectionTeamMemberGuard)
  @RequiresTeamRole(TeamMemberRole.OWNER, TeamMemberRole.EDITOR)
  async duplicateTeamCollection(
    @Args({
      name: 'collectionID',
      description: 'ID of the collection',
    })
    collectionID: string,
  ) {
    const duplicatedTeamCollection =
      await this.teamCollectionService.duplicateTeamCollection(collectionID);

    if (E.isLeft(duplicatedTeamCollection))
      throwErr(duplicatedTeamCollection.left);
    return duplicatedTeamCollection.right;
  }

  // Subscriptions

  @Subscription(() => TeamCollection, {
    description:
      'Listen to when a collection has been added to a team. The emitted value is the team added',
    resolve: (value) => value,
  })
  @RequiresTeamRole(
    TeamMemberRole.OWNER,
    TeamMemberRole.EDITOR,
    TeamMemberRole.VIEWER,
  )
  @SkipThrottle()
  @UseGuards(GqlAuthGuard, GqlTeamMemberGuard)
  teamCollectionAdded(
    @Args({
      name: 'teamID',
      description: 'ID of the team to listen to',
      type: () => ID,
    })
    teamID: string,
  ) {
    return this.pubsub.asyncIterator(`team_coll/${teamID}/coll_added`);
  }

  @Subscription(() => TeamCollection, {
    description: 'Listen to when a collection has been updated.',
    resolve: (value) => value,
  })
  @RequiresTeamRole(
    TeamMemberRole.OWNER,
    TeamMemberRole.EDITOR,
    TeamMemberRole.VIEWER,
  )
  @SkipThrottle()
  @UseGuards(GqlAuthGuard, GqlTeamMemberGuard)
  teamCollectionUpdated(
    @Args({
      name: 'teamID',
      description: 'ID of the team to listen to',
      type: () => ID,
    })
    teamID: string,
  ) {
    return this.pubsub.asyncIterator(`team_coll/${teamID}/coll_updated`);
  }

  @Subscription(() => ID, {
    description: 'Listen to when a collection has been removed',
    resolve: (value) => value,
  })
  @RequiresTeamRole(
    TeamMemberRole.OWNER,
    TeamMemberRole.EDITOR,
    TeamMemberRole.VIEWER,
  )
  @SkipThrottle()
  @UseGuards(GqlAuthGuard, GqlTeamMemberGuard)
  teamCollectionRemoved(
    @Args({
      name: 'teamID',
      description: 'ID of the team to listen to',
      type: () => ID,
    })
    teamID: string,
  ) {
    return this.pubsub.asyncIterator(`team_coll/${teamID}/coll_removed`);
  }

  @Subscription(() => TeamCollection, {
    description: 'Listen to when a collection has been moved',
    resolve: (value) => value,
  })
  @RequiresTeamRole(
    TeamMemberRole.OWNER,
    TeamMemberRole.EDITOR,
    TeamMemberRole.VIEWER,
  )
  @SkipThrottle()
  @UseGuards(GqlAuthGuard, GqlTeamMemberGuard)
  teamCollectionMoved(
    @Args({
      name: 'teamID',
      description: 'ID of the team to listen to',
      type: () => ID,
    })
    teamID: string,
  ) {
    return this.pubsub.asyncIterator(`team_coll/${teamID}/coll_moved`);
  }

  @Subscription(() => CollectionReorderData, {
    description: 'Listen to when a collections position has changed',
    resolve: (value) => value,
  })
  @RequiresTeamRole(
    TeamMemberRole.OWNER,
    TeamMemberRole.EDITOR,
    TeamMemberRole.VIEWER,
  )
  @SkipThrottle()
  @UseGuards(GqlAuthGuard, GqlTeamMemberGuard)
  collectionOrderUpdated(
    @Args({
      name: 'teamID',
      description: 'ID of the team to listen to',
      type: () => ID,
    })
    teamID: string,
  ) {
    return this.pubsub.asyncIterator(`team_coll/${teamID}/coll_order_updated`);
  }
}
