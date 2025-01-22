import { UseGuards } from '@nestjs/common';
import {
  Args,
  ID,
  Mutation,
  Query,
  ResolveField,
  Resolver,
} from '@nestjs/graphql';
import { GqlThrottlerGuard } from 'src/guards/gql-throttler.guard';
import { Infra } from './infra.model';
import { AdminService } from './admin.service';
import { GqlAuthGuard } from 'src/guards/gql-auth.guard';
import { GqlAdminGuard } from './guards/gql-admin.guard';
import { User } from 'src/user/user.model';
import { AuthUser } from 'src/types/AuthUser';
import { throwErr } from 'src/utils';
import * as E from 'fp-ts/Either';
import { Admin } from './admin.model';
import {
  OffsetPaginationArgs,
  PaginationArgs,
} from 'src/types/input-types.args';
import { InvitedUser } from './invited-user.model';
import { Team } from 'src/team/team.model';
import { TeamInvitation } from 'src/team-invitation/team-invitation.model';
import { GqlAdmin } from './decorators/gql-admin.decorator';
import { ShortcodeWithUserEmail } from 'src/shortcode/shortcode.model';
import { InfraConfig } from 'src/infra-config/infra-config.model';
import { InfraConfigService } from 'src/infra-config/infra-config.service';
import {
  EnableAndDisableSSOArgs,
  InfraConfigArgs,
} from 'src/infra-config/input-args';
import { InfraConfigEnum } from 'src/types/InfraConfig';
import { ServiceStatus } from 'src/infra-config/helper';

@UseGuards(GqlThrottlerGuard)
@Resolver(() => Infra)
export class InfraResolver {
  constructor(
    private adminService: AdminService,
    private infraConfigService: InfraConfigService,
  ) {}

  @Query(() => Infra, {
    description: 'Fetch details of the Infrastructure',
  })
  @UseGuards(GqlAuthGuard, GqlAdminGuard)
  infra(@GqlAdmin() admin: Admin) {
    const infra: Infra = { executedBy: admin };
    return infra;
  }

  @ResolveField(() => [User], {
    description: 'Returns a list of all admin users in infra',
  })
  @UseGuards(GqlAuthGuard, GqlAdminGuard)
  async admins() {
    const admins = await this.adminService.fetchAdmins();
    return admins;
  }

  @ResolveField(() => User, {
    description: 'Returns a user info by UID',
  })
  @UseGuards(GqlAuthGuard, GqlAdminGuard)
  async userInfo(
    @Args({
      name: 'userUid',
      type: () => ID,
      description: 'The user UID',
    })
    userUid: string,
  ): Promise<AuthUser> {
    const user = await this.adminService.fetchUserInfo(userUid);
    if (E.isLeft(user)) throwErr(user.left);
    return user.right;
  }

  @ResolveField(() => [User], {
    description: 'Returns a list of all the users in infra',
    deprecationReason: 'Use allUsersV2 instead',
  })
  @UseGuards(GqlAuthGuard, GqlAdminGuard)
  async allUsers(@Args() args: PaginationArgs): Promise<AuthUser[]> {
    const users = await this.adminService.fetchUsers(args.cursor, args.take);
    return users;
  }

  @ResolveField(() => [User], {
    description: 'Returns a list of all the users in infra',
  })
  @UseGuards(GqlAuthGuard, GqlAdminGuard)
  async allUsersV2(
    @Args({
      name: 'searchString',
      nullable: true,
      description: 'Search on users displayName or email',
    })
    searchString: string,
    @Args() paginationOption: OffsetPaginationArgs,
  ): Promise<AuthUser[]> {
    const users = await this.adminService.fetchUsersV2(
      searchString,
      paginationOption,
    );
    return users;
  }

  @ResolveField(() => [InvitedUser], {
    description: 'Returns a list of all the invited users',
  })
  async invitedUsers(
    @Args() args: OffsetPaginationArgs,
  ): Promise<InvitedUser[]> {
    const users = await this.adminService.fetchInvitedUsers(args);
    return users;
  }

  @ResolveField(() => [Team], {
    description: 'Returns a list of all the teams in the infra',
  })
  async allTeams(@Args() args: PaginationArgs): Promise<Team[]> {
    const teams = await this.adminService.fetchAllTeams(args.cursor, args.take);
    return teams;
  }

  @ResolveField(() => Team, {
    description: 'Returns a team info by ID when requested by Admin',
  })
  async teamInfo(
    @Args({
      name: 'teamID',
      type: () => ID,
      description: 'Team ID for which info to fetch',
    })
    teamID: string,
  ): Promise<Team> {
    const team = await this.adminService.getTeamInfo(teamID);
    if (E.isLeft(team)) throwErr(team.left);
    return team.right;
  }

  @ResolveField(() => Number, {
    description: 'Return count of all the members in a team',
  })
  async membersCountInTeam(
    @Args({
      name: 'teamID',
      type: () => ID,
      description: 'Team ID for which team members to fetch',
      nullable: false,
    })
    teamID: string,
  ): Promise<number> {
    const teamMembersCount = await this.adminService.membersCountInTeam(teamID);
    return teamMembersCount;
  }

  @ResolveField(() => Number, {
    description: 'Return count of all the stored collections in a team',
  })
  async collectionCountInTeam(
    @Args({
      name: 'teamID',
      type: () => ID,
      description: 'Team ID for which team members to fetch',
    })
    teamID: string,
  ): Promise<number> {
    const teamCollCount = await this.adminService.collectionCountInTeam(teamID);
    return teamCollCount;
  }

  @ResolveField(() => Number, {
    description: 'Return count of all the stored requests in a team',
  })
  async requestCountInTeam(
    @Args({
      name: 'teamID',
      type: () => ID,
      description: 'Team ID for which team members to fetch',
    })
    teamID: string,
  ): Promise<number> {
    const teamReqCount = await this.adminService.requestCountInTeam(teamID);
    return teamReqCount;
  }

  @ResolveField(() => Number, {
    description: 'Return count of all the stored environments in a team',
  })
  async environmentCountInTeam(
    @Args({
      name: 'teamID',
      type: () => ID,
      description: 'Team ID for which team members to fetch',
    })
    teamID: string,
  ): Promise<number> {
    const envsCount = await this.adminService.environmentCountInTeam(teamID);
    return envsCount;
  }

  @ResolveField(() => [TeamInvitation], {
    description: 'Return all the pending invitations in a team',
  })
  async pendingInvitationCountInTeam(
    @Args({
      name: 'teamID',
      type: () => ID,
      description: 'Team ID for which team members to fetch',
    })
    teamID: string,
  ) {
    const invitations =
      await this.adminService.pendingInvitationCountInTeam(teamID);
    return invitations;
  }

  @ResolveField(() => Number, {
    description: 'Return total number of Users in organization',
  })
  async usersCount() {
    return this.adminService.getUsersCount();
  }

  @ResolveField(() => Number, {
    description: 'Return total number of Teams in organization',
  })
  async teamsCount() {
    return this.adminService.getTeamsCount();
  }

  @ResolveField(() => Number, {
    description: 'Return total number of Team Collections in organization',
  })
  async teamCollectionsCount() {
    return this.adminService.getTeamCollectionsCount();
  }

  @ResolveField(() => Number, {
    description: 'Return total number of Team Requests in organization',
  })
  async teamRequestsCount() {
    return this.adminService.getTeamRequestsCount();
  }

  @ResolveField(() => [ShortcodeWithUserEmail], {
    description: 'Returns a list of all the shortcodes in the infra',
  })
  async allShortcodes(
    @Args() args: PaginationArgs,
    @Args({
      name: 'userEmail',
      nullable: true,
      description: 'Users email to filter shortcodes by',
    })
    userEmail: string,
  ) {
    return await this.adminService.fetchAllShortcodes(
      args.cursor,
      args.take,
      userEmail,
    );
  }

  @Query(() => [InfraConfig], {
    description: 'Retrieve configuration details for the instance',
  })
  @UseGuards(GqlAuthGuard, GqlAdminGuard)
  async infraConfigs(
    @Args({
      name: 'configNames',
      type: () => [InfraConfigEnum],
      description: 'Configs to fetch',
    })
    names: InfraConfigEnum[],
  ) {
    const infraConfigs = await this.infraConfigService.getMany(names);
    if (E.isLeft(infraConfigs)) throwErr(infraConfigs.left);
    return infraConfigs.right;
  }

  @Query(() => [String], {
    description: 'Allowed Auth Provider list',
  })
  @UseGuards(GqlAuthGuard, GqlAdminGuard)
  allowedAuthProviders() {
    return this.infraConfigService.getAllowedAuthProviders();
  }

  /* Mutations */

  @Mutation(() => [InfraConfig], {
    description: 'Update Infra Configs',
  })
  @UseGuards(GqlAuthGuard, GqlAdminGuard)
  async updateInfraConfigs(
    @Args({
      name: 'infraConfigs',
      type: () => [InfraConfigArgs],
      description: 'InfraConfigs to update',
    })
    infraConfigs: InfraConfigArgs[],
  ) {
    const updatedRes = await this.infraConfigService.updateMany(infraConfigs);
    if (E.isLeft(updatedRes)) throwErr(updatedRes.left);
    return updatedRes.right;
  }

  @Mutation(() => Boolean, {
    description: 'Enable or disable analytics collection',
  })
  @UseGuards(GqlAuthGuard, GqlAdminGuard)
  async toggleAnalyticsCollection(
    @Args({
      name: 'status',
      type: () => ServiceStatus,
      description: 'Toggle analytics collection',
    })
    analyticsCollectionStatus: ServiceStatus,
  ) {
    const res = await this.infraConfigService.toggleAnalyticsCollection(
      analyticsCollectionStatus,
    );
    if (E.isLeft(res)) throwErr(res.left);
    return res.right;
  }

  @Mutation(() => Boolean, {
    description: 'Reset Infra Configs with default values (.env)',
  })
  @UseGuards(GqlAuthGuard, GqlAdminGuard)
  async resetInfraConfigs() {
    const resetRes = await this.infraConfigService.reset();
    if (E.isLeft(resetRes)) throwErr(resetRes.left);
    return true;
  }

  @Mutation(() => Boolean, {
    description: 'Enable or Disable SSO for login/signup',
  })
  @UseGuards(GqlAuthGuard, GqlAdminGuard)
  async enableAndDisableSSO(
    @Args({
      name: 'providerInfo',
      type: () => [EnableAndDisableSSOArgs],
      description: 'SSO provider and status',
    })
    providerInfo: EnableAndDisableSSOArgs[],
  ) {
    const isUpdated =
      await this.infraConfigService.enableAndDisableSSO(providerInfo);
    if (E.isLeft(isUpdated)) throwErr(isUpdated.left);

    return true;
  }

  @Mutation(() => Boolean, {
    description: 'Enable or Disable SMTP for sending emails',
  })
  @UseGuards(GqlAuthGuard, GqlAdminGuard)
  async toggleSMTP(
    @Args({
      name: 'status',
      type: () => ServiceStatus,
      description: 'Toggle SMTP',
    })
    status: ServiceStatus,
  ) {
    const isUpdated =
      await this.infraConfigService.enableAndDisableSMTP(status);
    if (E.isLeft(isUpdated)) throwErr(isUpdated.left);
    return true;
  }

  @Mutation(() => Boolean, {
    description: 'Enable or Disable User History Storing in DB',
  })
  @UseGuards(GqlAuthGuard, GqlAdminGuard)
  async toggleUserHistoryStore(
    @Args({
      name: 'status',
      type: () => ServiceStatus,
      description: 'Toggle User History Store',
    })
    status: ServiceStatus,
  ) {
    const isUpdated = await this.infraConfigService.toggleServiceStatus(
      InfraConfigEnum.USER_HISTORY_STORE_ENABLED,
      status,
    );
    if (E.isLeft(isUpdated)) throwErr(isUpdated.left);
    return true;
  }
}
