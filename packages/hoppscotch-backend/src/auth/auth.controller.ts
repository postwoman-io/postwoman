import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Request,
  Res,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { SignInMagicDto } from './dto/signin-magic.dto';
import { VerifyMagicDto } from './dto/verify-magic.dto';
import { Response } from 'express';
import * as E from 'fp-ts/Either';
import { RTJwtAuthGuard } from './guards/rt-jwt-auth.guard';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { GqlUser } from 'src/decorators/gql-user.decorator';
import { AuthUser } from 'src/types/AuthUser';
import { RTCookie } from 'src/decorators/rt-cookie.decorator';
import { AuthProvider, authCookieHandler, authProviderCheck } from './helper';
import { GoogleSSOGuard } from './guards/google-sso.guard';
import { GithubSSOGuard } from './guards/github-sso.guard';
import { MicrosoftSSOGuard } from './guards/microsoft-sso-.guard';
import { ThrottlerBehindProxyGuard } from 'src/guards/throttler-behind-proxy.guard';
import { SkipThrottle } from '@nestjs/throttler';
import { AUTH_PROVIDER_NOT_SPECIFIED } from 'src/errors';
import { ConfigService } from '@nestjs/config';
import { throwHTTPErr } from 'src/utils';
import { UserLastLoginInterceptor } from 'src/interceptors/user-last-login.interceptor';

@UseGuards(ThrottlerBehindProxyGuard)
@Controller({ path: 'auth', version: '1' })
export class AuthController {
  constructor(
    private authService: AuthService,
    private configService: ConfigService,
  ) {}

  @Get('providers')
  async getAuthProviders() {
    const providers = await this.authService.getAuthProviders();
    return { providers };
  }

  /**
   ** Route to initiate magic-link auth for a users email
   */
  @Post('signin')
  async signInMagicLink(
    @Body() authData: SignInMagicDto,
    @Query('origin') origin: string,
  ) {
    if (
      !authProviderCheck(
        AuthProvider.EMAIL,
        this.configService.get('INFRA.VITE_ALLOWED_AUTH_PROVIDERS'),
      )
    ) {
      throwHTTPErr({ message: AUTH_PROVIDER_NOT_SPECIFIED, statusCode: 404 });
    }

    const deviceIdToken = await this.authService.signInMagicLink(
      authData.email,
      origin,
    );
    if (E.isLeft(deviceIdToken)) throwHTTPErr(deviceIdToken.left);
    return deviceIdToken.right;
  }

  /**
   ** Route to verify and sign in a valid user via magic-link
   */
  @Post('verify')
  async verify(@Body() data: VerifyMagicDto, @Res() res: Response) {
    const authTokens = await this.authService.verifyMagicLinkTokens(data);
    if (E.isLeft(authTokens)) throwHTTPErr(authTokens.left);
    authCookieHandler(res, authTokens.right, false, null);
  }

  /**
   ** Route to refresh auth tokens with Refresh Token Rotation
   * @see https://auth0.com/docs/secure/tokens/refresh-tokens/refresh-token-rotation
   */
  @Get('refresh')
  @UseGuards(RTJwtAuthGuard)
  async refresh(
    @GqlUser() user: AuthUser,
    @RTCookie() refresh_token: string,
    @Res() res,
  ) {
    const newTokenPair = await this.authService.refreshAuthTokens(
      refresh_token,
      user,
    );
    if (E.isLeft(newTokenPair)) throwHTTPErr(newTokenPair.left);
    authCookieHandler(res, newTokenPair.right, false, null);
  }

  /**
   ** Route to initiate SSO auth via Google
   */
  @Get('google')
  @UseGuards(GoogleSSOGuard)
  async googleAuth(@Request() req) {}

  /**
   ** Callback URL for Google SSO
   * @see https://auth0.com/docs/get-started/authentication-and-authorization-flow/authorization-code-flow#how-it-works
   */
  @Get('google/callback')
  @SkipThrottle()
  @UseGuards(GoogleSSOGuard)
  @UseInterceptors(UserLastLoginInterceptor)
  async googleAuthRedirect(@Request() req, @Res() res) {
    const authTokens = await this.authService.generateAuthTokens(req.user.uid);
    if (E.isLeft(authTokens)) throwHTTPErr(authTokens.left);
    authCookieHandler(
      res,
      authTokens.right,
      true,
      req.authInfo.state.redirect_uri,
    );
  }

  /**
   ** Route to initiate SSO auth via Github
   */
  @Get('github')
  @UseGuards(GithubSSOGuard)
  async githubAuth(@Request() req) {}

  /**
   ** Callback URL for Github SSO
   * @see https://auth0.com/docs/get-started/authentication-and-authorization-flow/authorization-code-flow#how-it-works
   */
  @Get('github/callback')
  @SkipThrottle()
  @UseGuards(GithubSSOGuard)
  @UseInterceptors(UserLastLoginInterceptor)
  async githubAuthRedirect(@Request() req, @Res() res) {
    const authTokens = await this.authService.generateAuthTokens(req.user.uid);
    if (E.isLeft(authTokens)) throwHTTPErr(authTokens.left);
    authCookieHandler(
      res,
      authTokens.right,
      true,
      req.authInfo.state.redirect_uri,
    );
  }

  /**
   ** Route to initiate SSO auth via Microsoft
   */
  @Get('microsoft')
  @UseGuards(MicrosoftSSOGuard)
  async microsoftAuth(@Request() req) {}

  /**
   ** Callback URL for Microsoft SSO
   * @see https://auth0.com/docs/get-started/authentication-and-authorization-flow/authorization-code-flow#how-it-works
   */
  @Get('microsoft/callback')
  @SkipThrottle()
  @UseGuards(MicrosoftSSOGuard)
  @UseInterceptors(UserLastLoginInterceptor)
  async microsoftAuthRedirect(@Request() req, @Res() res) {
    const authTokens = await this.authService.generateAuthTokens(req.user.uid);
    if (E.isLeft(authTokens)) throwHTTPErr(authTokens.left);
    authCookieHandler(
      res,
      authTokens.right,
      true,
      req.authInfo.state.redirect_uri,
    );
  }

  /**
   ** Log user out by clearing cookies containing auth tokens
   */
  @Get('logout')
  async logout(@Res() res: Response) {
    res.clearCookie('access_token');
    res.clearCookie('refresh_token');
    return res.status(200).send();
  }

  @Get('verify/admin')
  @UseGuards(JwtAuthGuard)
  async verifyAdmin(@GqlUser() user: AuthUser) {
    const userInfo = await this.authService.verifyAdmin(user);
    if (E.isLeft(userInfo)) throwHTTPErr(userInfo.left);
    return userInfo.right;
  }

  @Get('desktop')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(UserLastLoginInterceptor)
  async desktopAuthCallback(
    @GqlUser() user: AuthUser,
    @Query('redirect_uri') redirectUri: string,
  ) {
    if (!redirectUri || !redirectUri.startsWith('http://localhost')) {
      throwHTTPErr({
        message: 'Invalid desktop callback URL',
        statusCode: 400
      });
    }

    const tokens = await this.authService.generateAuthTokens(user.uid);
    if (E.isLeft(tokens)) throwHTTPErr(tokens.left);

    return tokens.right;
  }
}
