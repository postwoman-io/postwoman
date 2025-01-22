import {
  Body,
  Controller,
  Delete,
  Get,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { AdminService } from 'src/admin/admin.service';
import { InfraTokenGuard } from 'src/guards/infra-token.guard';
import { ThrottlerBehindProxyGuard } from 'src/guards/throttler-behind-proxy.guard';
import {
  DeleteUserInvitationRequest,
  DeleteUserInvitationResponse,
  ExceptionResponse,
  GetUserInvitationResponse,
  GetUsersRequestQuery,
  GetUserResponse,
  UpdateUserRequest,
  UpdateUserAdminStatusRequest,
  UpdateUserAdminStatusResponse,
  CreateUserInvitationRequest,
  CreateUserInvitationResponse,
  DeleteUserResponse,
  GetUserWorkspacesResponse,
} from './request-response.dto';
import * as E from 'fp-ts/Either';
import * as O from 'fp-ts/Option';
import { OffsetPaginationArgs } from 'src/types/input-types.args';
import {
  ApiBadRequestResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiSecurity,
  ApiTags,
} from '@nestjs/swagger';
import { throwHTTPErr } from 'src/utils';
import { UserService } from 'src/user/user.service';
import {
  INFRA_TOKEN_CREATOR_NOT_FOUND,
  USER_NOT_FOUND,
  USERS_NOT_FOUND,
} from 'src/errors';
import { InfraTokenService } from './infra-token.service';
import { InfraTokenInterceptor } from 'src/interceptors/infra-token.interceptor';
import { BearerToken } from 'src/decorators/bearer-token.decorator';

@ApiTags('User Management API')
@ApiSecurity('infra-token')
@UseGuards(ThrottlerBehindProxyGuard, InfraTokenGuard)
@UseInterceptors(InfraTokenInterceptor)
@Controller({ path: 'infra', version: '1' })
export class InfraTokensController {
  constructor(
    private readonly infraTokenService: InfraTokenService,
    private readonly adminService: AdminService,
    private readonly userService: UserService,
  ) {}

  @Post('user-invitations')
  @ApiCreatedResponse({
    description: 'Create a user invitation',
    type: CreateUserInvitationResponse,
  })
  @ApiBadRequestResponse({ type: ExceptionResponse })
  @ApiNotFoundResponse({ type: ExceptionResponse })
  async createUserInvitation(
    @BearerToken() token: string,
    @Body() dto: CreateUserInvitationRequest,
  ) {
    const createdInvitations =
      await this.infraTokenService.createUserInvitation(token, dto);

    if (E.isLeft(createdInvitations)) {
      const statusCode =
        (createdInvitations.left as string) === INFRA_TOKEN_CREATOR_NOT_FOUND
          ? HttpStatus.NOT_FOUND
          : HttpStatus.BAD_REQUEST;

      throwHTTPErr({ message: createdInvitations.left, statusCode });
    }

    return plainToInstance(
      CreateUserInvitationResponse,
      { invitationLink: process.env.VITE_BASE_URL },
      {
        excludeExtraneousValues: true,
        enableImplicitConversion: true,
      },
    );
  }

  @Get('user-invitations')
  @ApiOkResponse({
    description: 'Get pending user invitations',
    type: [GetUserInvitationResponse],
  })
  async getPendingUserInvitation(
    @Query() paginationQuery: OffsetPaginationArgs,
  ) {
    const pendingInvitedUsers =
      await this.adminService.fetchInvitedUsers(paginationQuery);

    return plainToInstance(GetUserInvitationResponse, pendingInvitedUsers, {
      excludeExtraneousValues: true,
      enableImplicitConversion: true,
    });
  }

  @Delete('user-invitations')
  @ApiOkResponse({
    description: 'Delete a pending user invitation',
    type: DeleteUserInvitationResponse,
  })
  @ApiBadRequestResponse({ type: ExceptionResponse })
  async deleteUserInvitation(@Body() dto: DeleteUserInvitationRequest) {
    const isDeleted = await this.adminService.revokeUserInvitations(
      dto.inviteeEmails,
    );

    if (E.isLeft(isDeleted)) {
      throwHTTPErr({
        message: isDeleted.left,
        statusCode: HttpStatus.BAD_REQUEST,
      });
    }

    return plainToInstance(
      DeleteUserInvitationResponse,
      { message: isDeleted.right },
      {
        excludeExtraneousValues: true,
        enableImplicitConversion: true,
      },
    );
  }

  @Get('users')
  @ApiOkResponse({
    description: 'Get users list',
    type: [GetUserResponse],
  })
  async getUsers(@Query() query: GetUsersRequestQuery) {
    const users = await this.userService.fetchAllUsersV2(query.searchString, {
      take: query.take,
      skip: query.skip,
    });

    return plainToInstance(GetUserResponse, users, {
      excludeExtraneousValues: true,
      enableImplicitConversion: true,
    });
  }

  @Get('users/:uid')
  @ApiOkResponse({
    description: 'Get user details',
    type: GetUserResponse,
  })
  @ApiNotFoundResponse({ type: ExceptionResponse })
  async getUser(@Param('uid') uid: string) {
    const user = await this.userService.findUserById(uid);

    if (O.isNone(user)) {
      throwHTTPErr({
        message: USER_NOT_FOUND,
        statusCode: HttpStatus.NOT_FOUND,
      });
    }

    return plainToInstance(GetUserResponse, user.value, {
      excludeExtraneousValues: true,
      enableImplicitConversion: true,
    });
  }

  @Patch('users/:uid')
  @ApiOkResponse({
    description: 'Update user display name',
    type: GetUserResponse,
  })
  @ApiBadRequestResponse({ type: ExceptionResponse })
  @ApiNotFoundResponse({ type: ExceptionResponse })
  async updateUser(@Param('uid') uid: string, @Body() body: UpdateUserRequest) {
    const updatedUser = await this.userService.updateUserDisplayName(
      uid,
      body.displayName,
    );

    if (E.isLeft(updatedUser)) {
      const statusCode =
        (updatedUser.left as string) === USER_NOT_FOUND
          ? HttpStatus.NOT_FOUND
          : HttpStatus.BAD_REQUEST;

      throwHTTPErr({ message: updatedUser.left, statusCode });
    }

    return plainToInstance(GetUserResponse, updatedUser.right, {
      excludeExtraneousValues: true,
      enableImplicitConversion: true,
    });
  }

  @Delete('users/:uid')
  @ApiOkResponse({
    description: 'Delete a user from the instance',
    type: DeleteUserResponse,
  })
  @ApiBadRequestResponse({ type: ExceptionResponse })
  @ApiNotFoundResponse({ type: ExceptionResponse })
  async deleteUser(@Param('uid') uid: string) {
    const deletedUser = await this.adminService.removeUserAccount(uid);

    if (E.isLeft(deletedUser)) {
      const statusCode =
        (deletedUser.left as string) === USER_NOT_FOUND
          ? HttpStatus.NOT_FOUND
          : HttpStatus.BAD_REQUEST;

      throwHTTPErr({ message: deletedUser.left, statusCode });
    }

    return plainToInstance(
      DeleteUserResponse,
      { message: deletedUser.right },
      {
        excludeExtraneousValues: true,
        enableImplicitConversion: true,
      },
    );
  }

  @Patch('users/:uid/admin-status')
  @ApiOkResponse({
    description: 'Update user admin status',
    type: UpdateUserAdminStatusResponse,
  })
  @ApiBadRequestResponse({ type: ExceptionResponse })
  @ApiNotFoundResponse({ type: ExceptionResponse })
  async updateUserAdminStatus(
    @Param('uid') uid: string,
    @Body() body: UpdateUserAdminStatusRequest,
  ) {
    let updatedUser;

    if (body.isAdmin) {
      updatedUser = await this.adminService.makeUsersAdmin([uid]);
    } else {
      updatedUser = await this.adminService.demoteUsersByAdmin([uid]);
    }

    if (E.isLeft(updatedUser)) {
      const statusCode =
        (updatedUser.left as string) === USERS_NOT_FOUND
          ? HttpStatus.NOT_FOUND
          : HttpStatus.BAD_REQUEST;

      throwHTTPErr({ message: updatedUser.left as string, statusCode });
    }

    return plainToInstance(
      UpdateUserAdminStatusResponse,
      { message: updatedUser.right },
      {
        excludeExtraneousValues: true,
        enableImplicitConversion: true,
      },
    );
  }

  @Get('users/:uid/workspaces')
  @ApiOkResponse({
    description: 'Get user workspaces',
    type: [GetUserWorkspacesResponse],
  })
  @ApiNotFoundResponse({ type: ExceptionResponse })
  async getUserWorkspaces(@Param('uid') uid: string) {
    const userWorkspaces = await this.userService.fetchUserWorkspaces(uid);

    if (E.isLeft(userWorkspaces)) {
      const statusCode =
        userWorkspaces.left === USER_NOT_FOUND
          ? HttpStatus.NOT_FOUND
          : HttpStatus.BAD_REQUEST;

      throwHTTPErr({ message: userWorkspaces.left, statusCode });
    }

    return plainToInstance(GetUserWorkspacesResponse, userWorkspaces.right, {
      excludeExtraneousValues: true,
      enableImplicitConversion: true,
    });
  }
}
