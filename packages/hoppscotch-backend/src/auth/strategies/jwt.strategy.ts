import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { AccessTokenPayload } from 'src/types/AuthTokens';
import { UserService } from 'src/user/user.service';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import * as O from 'fp-ts/Option';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';
import { COOKIES_NOT_FOUND, INVALID_ACCESS_TOKEN, USER_NOT_FOUND } from 'src/errors';

/**
 * Extracts an access token from a cookie in the request.
 *
 * @param request - Express Request object
 * @returns Option<string> containing the token if found
 */
const extractFromCookie = (request: Request): O.Option<string> =>
  pipe(
    O.fromNullable(request.cookies),
    O.chain(cookies => O.fromNullable(cookies['access_token']))
  );

/**
 * Extracts an access token from the Authorization header.
 * Expects the header to be in the format: 'Bearer <token>'.
 *
 * @param request - Express Request object
 * @returns Option<string> containing the token if found
 */
const extractFromAuthHeaders = (request: Request): O.Option<string> =>
  pipe(
    // First try headers.authorization, then fall back to root level authorization
    // see `gql-auth.guard` for more info.
    O.fromNullable(
      request?.headers?.authorization ||
      (request && 'authorization' in request ? request['authorization'] : undefined)
    ),
    O.chain(auth =>
      typeof auth === 'string' && auth.startsWith('Bearer ')
        ? O.some(auth.slice(7))
        : O.none
    )
  );

/**
 * Combines cookie and header token extraction strategies.
 * Attempts to extract from cookie first, then falls back to Authorization header.
 *
 * @param request - Express Request object
 * @returns Either<Error, string> containing the token or an error
 */
const extractToken = (request: Request): E.Either<Error, string> =>
  pipe(
    extractFromCookie(request),
    O.alt(() => extractFromAuthHeaders(request)),
    // Neither `Authorization` header nor `Cookie` were found with the request,
    // `COOKIES_NOT_FOUND` for backwards compatibility.
    E.fromOption(() => {
      return new ForbiddenException(COOKIES_NOT_FOUND);
    })
  );

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    private usersService: UserService,
    private configService: ConfigService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (request: Request) =>
          pipe(
            extractToken(request),
            E.fold(
              error => { throw error; },
              token => { return token }
            )
          ),
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
