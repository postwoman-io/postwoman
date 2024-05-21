import {
  Body,
  Controller,
  Delete,
  Get,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { AccessTokenService } from './access-token.service';
import { CreateAccessTokenDto } from './dto/create-access-token.dto';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import * as E from 'fp-ts/Either';
import { throwHTTPErr } from 'src/utils';
import { GqlUser } from 'src/decorators/gql-user.decorator';
import { AuthUser } from 'src/types/AuthUser';
import { ThrottlerBehindProxyGuard } from 'src/guards/throttler-behind-proxy.guard';
import { PATAuthGuard } from 'src/guards/rest-pat-auth.guard';
import { AccessTokenInterceptor } from 'src/interceptors/access-token.interceptor';
import { TeamEnvironmentsService } from 'src/team-environments/team-environments.service';
import { TeamCollectionService } from 'src/team-collection/team-collection.service';
import { RequiresTeamRole } from 'src/team/decorators/requires-team-role.decorator';
import { TeamMemberRole } from '@prisma/client';
import { userInfo } from 'os';
import { ACCESS_TOKENS_INVALID_DATA_ID } from 'src/errors';

@UseGuards(ThrottlerBehindProxyGuard)
@Controller({ path: 'access-tokens', version: '1' })
export class AccessTokenController {
  constructor(
    private readonly accessTokenService: AccessTokenService,
    private readonly teamCollectionService: TeamCollectionService,
    private readonly teamEnvironmentsService: TeamEnvironmentsService,
  ) {}

  @Post('create')
  @UseGuards(JwtAuthGuard)
  async createPAT(
    @GqlUser() user: AuthUser,
    @Body() createAccessTokenDto: CreateAccessTokenDto,
  ) {
    const result = await this.accessTokenService.createPAT(
      createAccessTokenDto,
      user,
    );
    if (E.isLeft(result)) throwHTTPErr(result.left);
    return result.right;
  }

  @Delete('revoke')
  @UseGuards(JwtAuthGuard)
  async deletePAT(@Query('id') id: string) {
    const result = await this.accessTokenService.deletePAT(id);

    if (E.isLeft(result)) throwHTTPErr(result.left);
    return result.right;
  }

  @Get('list')
  @UseGuards(JwtAuthGuard)
  async listAllUserPAT(
    @GqlUser() user: AuthUser,
    @Query('offset', ParseIntPipe) offset: number,
    @Query('limit', ParseIntPipe) limit: number,
  ) {
    const result = await this.accessTokenService.listAllUserPAT(
      user.uid,
      offset,
      limit,
    );

    if (E.isLeft(result)) throwHTTPErr(result.left);
    return result.right;
  }

  @Get('collection/:id')
  @RequiresTeamRole(
    TeamMemberRole.VIEWER,
    TeamMemberRole.EDITOR,
    TeamMemberRole.OWNER,
  )
  @UseGuards(JwtAuthGuard, PATAuthGuard)
  @UseInterceptors(AccessTokenInterceptor)
  async fetchCollection(@GqlUser() user: AuthUser, @Param('id') id: string) {
    const res = await this.teamCollectionService.getCollectionForCLI(
      id,
      user.uid,
    );

    if (E.isLeft(res))
      throwHTTPErr({
        message: { reason: ACCESS_TOKENS_INVALID_DATA_ID },
        statusCode: HttpStatus.BAD_REQUEST,
      });
    return res.right;
  }

  @Get('environment/:id')
  @RequiresTeamRole(
    TeamMemberRole.VIEWER,
    TeamMemberRole.EDITOR,
    TeamMemberRole.OWNER,
  )
  @UseGuards(JwtAuthGuard, PATAuthGuard)
  @UseInterceptors(AccessTokenInterceptor)
  async fetchEnvironment(@GqlUser() user: AuthUser, @Param('id') id: string) {
    const res = await this.teamEnvironmentsService.getTeamEnvironmentForCLI(
      id,
      user.uid,
    );

    if (E.isLeft(res))
      throwHTTPErr({
        message: { reason: ACCESS_TOKENS_INVALID_DATA_ID },
        statusCode: HttpStatus.BAD_REQUEST,
      });
    return res.right;
  }
}
