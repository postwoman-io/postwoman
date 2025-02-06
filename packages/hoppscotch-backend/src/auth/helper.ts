import { HttpException, HttpStatus } from '@nestjs/common';
import { DateTime } from 'luxon';
import { AuthTokens } from 'src/types/AuthTokens';
import { Response } from 'express';
import * as cookie from 'cookie';
import { AUTH_HEADER_NOT_FOUND, AUTH_PROVIDER_NOT_SPECIFIED, COOKIES_NOT_FOUND, INVALID_AUTH_HEADER } from 'src/errors';
import { throwErr } from 'src/utils';
import { ConfigService } from '@nestjs/config';
import { IncomingHttpHeaders } from 'http';

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
  const configService = new ConfigService();

  const currentTime = DateTime.now();
  const accessTokenValidity = currentTime
    .plus({
      milliseconds: parseInt(configService.get('ACCESS_TOKEN_VALIDITY')),
    })
    .toMillis();
  const refreshTokenValidity = currentTime
    .plus({
      milliseconds: parseInt(configService.get('REFRESH_TOKEN_VALIDITY')),
    })
    .toMillis();

  res.cookie(AuthTokenType.ACCESS_TOKEN, authTokens.access_token, {
    httpOnly: true,
    secure: configService.get('ALLOW_SECURE_COOKIES') === 'true',
    sameSite: 'lax',
    maxAge: accessTokenValidity,
  });
  res.cookie(AuthTokenType.REFRESH_TOKEN, authTokens.refresh_token, {
    httpOnly: true,
    secure: configService.get('ALLOW_SECURE_COOKIES') === 'true',
    sameSite: 'lax',
    maxAge: refreshTokenValidity,
  });

  if (!redirect) {
    return res.status(HttpStatus.OK).send();
  }

  // check to see if redirectUrl is a whitelisted url
  const whitelistedOrigins = configService
    .get('WHITELISTED_ORIGINS')
    .split(',');
  if (!whitelistedOrigins.includes(redirectUrl))
    // if it is not redirect by default to REDIRECT_URL
    redirectUrl = configService.get('REDIRECT_URL');

  return res.status(HttpStatus.OK).redirect(redirectUrl);
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
export function authProviderCheck(
  provider: string,
  VITE_ALLOWED_AUTH_PROVIDERS: string,
) {
  if (!provider) {
    throwErr(AUTH_PROVIDER_NOT_SPECIFIED);
  }

  const envVariables = VITE_ALLOWED_AUTH_PROVIDERS
    ? VITE_ALLOWED_AUTH_PROVIDERS.split(',').map((provider) =>
      provider.trim().toUpperCase(),
    )
    : [];

  if (!envVariables.includes(provider.toUpperCase())) return false;

  return true;
}

/**
 * Extract cookie as key-value pairs from headers of a request
 * @param headers HTTP request headers containing auth tokens
 * @returns Cookie's key-value pairs
 */
export const extractCookieAsKeyValuesFromHeaders = (headers: IncomingHttpHeaders) => {
  const cookieHeader = headers['cookie'] || headers['Cookie'] || headers['COOKIE'];

  if (!cookieHeader) {
    throw new HttpException(COOKIES_NOT_FOUND, 400, {
      cause: new Error(COOKIES_NOT_FOUND),
    });
  }

  const cookieStr = Array.isArray(cookieHeader) ? cookieHeader[0] : cookieHeader;

  const kv = cookieStr.split(';')
    .map(cookie => cookie.trim())
    .reduce((acc, curr) => {
      const [key, value] = curr.split('=');
      acc[key] = value;
      return acc;
    }, {} as Record<string, string>);

  return kv;
};

/**
 * Extract auth tokens from cookie headers of a request
 * @param headers HTTP request headers containing auth tokens
 * @returns AuthTokens for JWT strategy to use
 */
export const extractAuthTokensFromCookieHeaders = (headers: IncomingHttpHeaders) => {
  const cookieKV = extractCookieAsKeyValuesFromHeaders(headers);

  if (!cookieKV[AuthTokenType.ACCESS_TOKEN] || !cookieKV[AuthTokenType.REFRESH_TOKEN]) {
    throw new HttpException(COOKIES_NOT_FOUND, 400, {
      cause: new Error(COOKIES_NOT_FOUND),
    });
  }

  return <AuthTokens>{
    access_token: cookieKV[AuthTokenType.ACCESS_TOKEN],
    refresh_token: cookieKV[AuthTokenType.REFRESH_TOKEN],
  };
};

/**
 * Extract access tokens from cookie headers of a request
 * @param headers HTTP request headers containing access tokens
 * @returns AccessTokens for JWT strategy to use
 */
export const extractAccessTokensFromCookieHeaders = (headers: IncomingHttpHeaders) => {
  const cookieKV = extractCookieAsKeyValuesFromHeaders(headers);

  if (!cookieKV[AuthTokenType.ACCESS_TOKEN]) {
    throw new HttpException(COOKIES_NOT_FOUND, 400, {
      cause: new Error(COOKIES_NOT_FOUND),
    });
  }

  return {
    access_token: cookieKV[AuthTokenType.ACCESS_TOKEN],
  };
};

/**
 * Extract access token from authorization header
 * @param headers HTTP request headers containing bearer token
 * @returns AccessTokens for JWT strategy
 */
export const extractAccessTokenFromAuthRecords = (headers: IncomingHttpHeaders) => {
  const authHeader = headers['authorization'] || headers['Authorization'];
  if (!authHeader) {
    throw new HttpException(AUTH_HEADER_NOT_FOUND, 400, {
      cause: new Error(AUTH_HEADER_NOT_FOUND),
    });
  }

  const headerValue = Array.isArray(authHeader) ? authHeader[0] : authHeader;
  const [bearer, access_token] = headerValue.split(' ');

  if (bearer !== 'Bearer' || !access_token) {
    throw new HttpException(INVALID_AUTH_HEADER, 400, {
      cause: new Error(INVALID_AUTH_HEADER),
    });
  }

  return access_token;
};
