import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { AccessTokenPayload } from 'src/types/AuthTokens';
import { UserService } from 'src/user/user.service';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import * as O from 'fp-ts/Option';
import { COOKIES_NOT_FOUND, INVALID_ACCESS_TOKEN, USER_NOT_FOUND } from 'src/errors';
import { extractAccessTokensFromHeaders } from 'src/auth/helper';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    private usersService: UserService,
    private configService: ConfigService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (request: Request) => {
          if (request.cookies) {
            const ATCookie = request.cookies['access_token'];
            if (ATCookie) {
              return ATCookie;
            }
          }

          try {
            const tokens = extractAccessTokensFromHeaders(request.headers);
            return tokens.access_token;
          } catch {
            throw new ForbiddenException(COOKIES_NOT_FOUND);
          }
        },
      ]),
      secretOrKey: configService.get('JWT_SECRET'),
    });
  }

  async validate(payload: AccessTokenPayload) {
    if (!payload) throw new ForbiddenException(INVALID_ACCESS_TOKEN);

    const user = await this.usersService.findUserById(payload.sub);
    if (O.isNone(user)) {
      throw new UnauthorizedException(USER_NOT_FOUND);
    }

    return user.value;
  }
}
