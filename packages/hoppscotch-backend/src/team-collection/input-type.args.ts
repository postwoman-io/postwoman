import { ArgsType, Field, ID } from '@nestjs/graphql';
import { PaginationArgs } from 'src/types/input-types.args';

@ArgsType()
export class GetRootTeamCollectionsArgs extends PaginationArgs {
  @Field(() => ID, { name: 'teamID', description: 'ID of the team' })
  teamID: string;
}

@ArgsType()
export class CreateRootTeamCollectionArgs {
  @Field(() => ID, { name: 'teamID', description: 'ID of the team' })
  teamID: string;

  @Field({ name: 'title', description: 'Title of the new collection' })
  title: string;

  @Field({
    name: 'data',
    description: 'JSON string representing the collection data',
    nullable: true,
  })
  data: string;
}

@ArgsType()
export class CreateChildTeamCollectionArgs {
  @Field(() => ID, {
    name: 'collectionID',
    description: 'ID of the parent to the new collection',
  })
  collectionID: string;

  @Field({ name: 'childTitle', description: 'Title of the new collection' })
  childTitle: string;

  @Field({
    name: 'data',
    description: 'JSON string representing the collection data',
    nullable: true,
  })
  data: string;
}

@ArgsType()
export class RenameTeamCollectionArgs {
  @Field(() => ID, {
    name: 'collectionID',
    description: 'ID of the collection',
  })
  collectionID: string;

  @Field({
    name: 'newTitle',
    description: 'The updated title of the collection',
  })
  newTitle: string;
}

@ArgsType()
export class MoveTeamCollectionArgs {
  @Field(() => ID, {
    name: 'parentCollectionID',
    description: 'ID of the parent to the new collection',
    nullable: true,
  })
  parentCollectionID: string;

  @Field(() => ID, {
    name: 'collectionID',
    description: 'ID of the collection',
  })
  collectionID: string;
}

@ArgsType()
export class UpdateTeamCollectionOrderArgs {
  @Field(() => ID, {
    name: 'collectionID',
    description: 'ID of the collection',
  })
  collectionID: string;

  @Field(() => ID, {
    name: 'destCollID',
    description:
      'ID of the collection that comes after the updated collection in its new position',
    nullable: true,
  })
  destCollID: string;
}

@ArgsType()
export class ReplaceTeamCollectionArgs {
  @Field(() => ID, {
    name: 'teamID',
    description: 'Id of the team to add to',
  })
  teamID: string;

  @Field({
    name: 'jsonString',
    description: 'JSON string to replace with',
  })
  jsonString: string;

  @Field(() => ID, {
    name: 'parentCollectionID',
    description:
      'ID to the collection to which to import to (null if to import to the root of team)',
    nullable: true,
  })
  parentCollectionID?: string;
}

@ArgsType()
export class UpdateTeamCollectionArgs {
  @Field(() => ID, {
    name: 'collectionID',
    description: 'ID of the collection',
  })
  collectionID: string;

  @Field({
    name: 'newTitle',
    description: 'The updated title of the collection',
    nullable: true,
  })
  newTitle: string;

  @Field({
    name: 'data',
    description: 'JSON string representing the collection data',
    nullable: true,
  })
  data: string;
}
