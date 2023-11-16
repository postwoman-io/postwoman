import { HttpException, HttpStatus } from '@nestjs/common';
import { DateTime } from 'luxon';
import { AuthError } from 'src/types/AuthError';
import { AuthTokens } from 'src/types/AuthTokens';
import { Response } from 'express';
import * as cookie from 'cookie';
import { AUTH_PROVIDER_NOT_SPECIFIED, COOKIES_NOT_FOUND } from 'src/errors';
import { throwErr } from 'src/utils';

enum AuthTokenType {
  ACCESS_TOKEN = 'access_token',
  REFRESH_TOKEN = 'refresh_token',
}

export enum Origin {
  ADMIN = 'admin',
  APP = 'app',
}

export enum AuthProvider {
  GOOGLE = 'GOOGLE',
  GITHUB = 'GITHUB',
  MICROSOFT = 'MICROSOFT',
  EMAIL = 'EMAIL',
}

/**
 * This function allows throw to be used as an expression
 * @param errMessage Message present in the error message
 */
export function throwHTTPErr(errorData: AuthError): never {
  const { message, statusCode } = errorData;
  throw new HttpException(message, statusCode);
}

/**
 * Sets and returns the cookies in the response object on successful authentication
 * @param res Express Response Object
 * @param authTokens Object containing the access and refresh tokens
 * @param redirect if true will redirect to provided URL else just send a 200 status code
 */
export const authCookieHandler = (
  res: Response,
  authTokens: AuthTokens,
  redirect: boolean,
  redirectUrl: string | null,
) => {
  const currentTime = DateTime.now();
  const accessTokenValidity = currentTime
    .plus({
      milliseconds: parseInt(process.env.ACCESS_TOKEN_VALIDITY),
    })
    .toMillis();
  const refreshTokenValidity = currentTime
    .plus({
      milliseconds: parseInt(process.env.REFRESH_TOKEN_VALIDITY),
    })
    .toMillis();

  res.cookie(AuthTokenType.ACCESS_TOKEN, authTokens.access_token, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: accessTokenValidity,
  });
  res.cookie(AuthTokenType.REFRESH_TOKEN, authTokens.refresh_token, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: refreshTokenValidity,
  });

  if (!redirect) {
    return res.status(HttpStatus.OK).send();
  }

  // check to see if redirectUrl is a whitelisted url
  const whitelistedOrigins = process.env.WHITELISTED_ORIGINS.split(',');
  if (!whitelistedOrigins.includes(redirectUrl))
    // if it is not redirect by default to REDIRECT_URL
    redirectUrl = process.env.REDIRECT_URL;

  return res.status(HttpStatus.OK).redirect(redirectUrl);
};

export const authDesktopDeepLinkHandler = (
  res: Response,
  authTokens: AuthTokens,
) => {
  const desktopDeepLinkUrl = process.env.DESKTOP_DEEP_LINK_URL;
  return res
    .status(HttpStatus.OK)
    .redirect(
      `${desktopDeepLinkUrl}?access_token=${authTokens.access_token}&refresh_token=${authTokens.refresh_token}`,
    );
};

/**
 * Decode the cookie header from incoming websocket connects and returns a auth token pair
 * @param rawCookies cookies from the websocket connection
 * @returns AuthTokens for JWT strategy to use
 */
export const subscriptionContextCookieParser = (rawCookies: string) => {
  const cookies = cookie.parse(rawCookies);

  if (
    !cookies[AuthTokenType.ACCESS_TOKEN] &&
    !cookies[AuthTokenType.REFRESH_TOKEN]
  ) {
    throw new HttpException(COOKIES_NOT_FOUND, 400, {
      cause: new Error(COOKIES_NOT_FOUND),
    });
  }

  return <AuthTokens>{
    access_token: cookies[AuthTokenType.ACCESS_TOKEN],
    refresh_token: cookies[AuthTokenType.REFRESH_TOKEN],
  };
};

/**
 * Check to see if given auth provider is present in the VITE_ALLOWED_AUTH_PROVIDERS env variable
 *
 * @param provider Provider we want to check the presence of
 * @returns Boolean if provider specified is present or not
 */
export function authProviderCheck(provider: string) {
  if (!provider) {
    throwErr(AUTH_PROVIDER_NOT_SPECIFIED);
  }

  const envVariables = process.env.VITE_ALLOWED_AUTH_PROVIDERS
    ? process.env.VITE_ALLOWED_AUTH_PROVIDERS.split(',').map((provider) =>
        provider.trim().toUpperCase(),
      )
    : [];

  if (!envVariables.includes(provider.toUpperCase())) return false;

  return true;
}
