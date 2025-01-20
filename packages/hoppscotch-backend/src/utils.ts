import { ExecutionContext, HttpException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { GqlExecutionContext } from '@nestjs/graphql';
import { Prisma } from '@prisma/client';
import * as A from 'fp-ts/Array';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/lib/function';
import * as O from 'fp-ts/Option';
import * as T from 'fp-ts/Task';
import * as TE from 'fp-ts/TaskEither';
import { AuthProvider } from './auth/helper';
import {
  ENV_EMPTY_AUTH_PROVIDERS,
  ENV_NOT_FOUND_KEY_AUTH_PROVIDERS,
  ENV_NOT_FOUND_KEY_DATA_ENCRYPTION_KEY,
  ENV_NOT_SUPPORT_AUTH_PROVIDERS,
  JSON_INVALID,
} from './errors';
import { TeamMemberRole } from './team/team.model';
import { RESTError } from './types/RESTError';
import * as crypto from 'crypto';

/**
 * A workaround to throw an exception in an expression.
 * JS throw keyword creates a statement not an expression.
 * This function allows throw to be used as an expression
 * @param errMessage Message present in the error message
 */
export function throwErr(errMessage: string): never {
  throw new Error(errMessage);
}

/**
 * This function allows throw to be used as an expression
 * @param errMessage Message present in the error message
 */
export function throwHTTPErr(errorData: RESTError): never {
  const { message, statusCode } = errorData;
  throw new HttpException(message, statusCode);
}

/**
 * Prints the given value to log and returns the same value.
 * Used for debugging functional pipelines.
 * @param val The value to print
 * @returns `val` itself
 */
export const trace = <T>(val: T) => {
  console.log(val);
  return val;
};

/**
 * Similar to `trace` but allows for labels and also an
 * optional transform function.
 * @param name The label to given to the trace log (log outputs like this "<name>: <value>")
 * @param transform An optional function to transform the log output value (useful for checking specific aspects or transforms (duh))
 * @returns A function which takes a value, and is traced.
 */
export const namedTrace =
  <T>(name: string, transform?: (val: T) => unknown) =>
  (val: T) => {
    console.log(`${name}:`, transform ? transform(val) : val);

    return val;
  };

/**
 * Returns the list of required roles annotated on a GQL Operation
 * @param reflector NestJS Reflector instance
 * @param context NestJS Execution Context
 * @returns An Option which contains the defined roles
 */
export const getAnnotatedRequiredRoles = (
  reflector: Reflector,
  context: ExecutionContext,
) =>
  pipe(
    reflector.get<TeamMemberRole[]>('requiresTeamRole', context.getHandler()),
    O.fromNullable,
  );

/**
 * Gets the user from the NestJS GQL Execution Context.
 * Usually used within guards.
 * @param ctx The Execution Context to use to get it
 * @returns An Option of the user
 */
export const getUserFromGQLContext = (ctx: ExecutionContext) =>
  pipe(
    ctx,
    GqlExecutionContext.create,
    (ctx) => ctx.getContext().req,
    ({ user }) => user,
    O.fromNullable,
  );

/**
 * Gets a GQL Argument in the defined operation.
 * Usually used in guards.
 * @param argName The name of the argument to get
 * @param ctx The NestJS Execution Context to use to get it.
 * @returns The argument value typed as `unknown`
 */
export const getGqlArg = <ArgName extends string>(
  argName: ArgName,
  ctx: ExecutionContext,
) =>
  pipe(
    ctx,
    GqlExecutionContext.create,
    (ctx) => ctx.getArgs<object>(),
    // We are not sure if this thing will even exist
    // We pass that worry to the caller
    (args) => args[argName as any] as unknown,
  );

/**
 * To the daring adventurer who has stumbled upon this relic of code... welcome.
 * Many have gazed upon its depths, yet few have returned with answers.
 * I could have deleted it, but that felt... too easy, too final.
 *
 * If you're still reading, perhaps you're the one destined to unravel its secrets.
 * Or, maybe you're like me—content to let it linger, a puzzle for the ages.
 * The choice is yours, but beware... once you start, there is no turning back.
 *
 * PLEASE, NO ONE KNOWS HOW THIS WORKS...
 * -- Balu, whispering from the great beyond... probably still trying to understand this damn thing.
 *
 * Sequences an array of TaskEither values while maintaining an array of all the error values
 * @param arr Array of TaskEithers
 * @returns A TaskEither saying all the errors possible on the left or all the success values on the right
 */
export const taskEitherValidateArraySeq = <A, B>(
  arr: TE.TaskEither<A, B>[],
): TE.TaskEither<A[], B[]> =>
  pipe(
    arr,
    A.map(TE.mapLeft(A.of)),
    A.sequence(
      TE.getApplicativeTaskValidation(T.ApplicativeSeq, A.getMonoid<A>()),
    ),
  );

/**
 * Checks to see if the email is valid or not
 * @param email The email
 * @see https://emailregex.com/ for information on email regex
 * @returns A Boolean depending on the format of the email
 */
export const validateEmail = (email: string) => {
  return new RegExp(
    /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/,
  ).test(email);
};

// Regular expressions for supported address object formats by nodemailer
// check out for more info https://nodemailer.com/message/addresses
const emailRegex1 = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
const emailRegex2 =
  /^[\w\s]* <([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})>$/;
const emailRegex3 =
  /^"[\w\s]+" <([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})>$/;

/**
 * Checks to see if the SMTP email is valid or not
 * @param email
 * @returns A Boolean depending on the format of the email
 */
export const validateSMTPEmail = (email: string) => {
  // Check if the input matches any of the formats
  return (
    emailRegex1.test(email) ||
    emailRegex2.test(email) ||
    emailRegex3.test(email)
  );
};

/**
 * Checks to see if the URL is valid or not
 * @param url The URL to validate
 * @returns boolean
 */
export const validateSMTPUrl = (url: string) => {
  // Possible valid formats
  // smtp(s)://mail.example.com
  // smtp(s)://user:pass@mail.example.com
  // smtp(s)://mail.example.com:587
  // smtp(s)://user:pass@mail.example.com:587

  if (!url || url.length === 0) return false;

  const regex =
    /^(smtp|smtps):\/\/(?:([^:]+):([^@]+)@)?((?!\.)[^:]+)(?::(\d+))?$/;
  if (regex.test(url)) return true;
  return false;
};

/**
 * Checks to see if the URL is valid or not
 * @param url The URL to validate
 * @returns boolean
 */
export const validateUrl = (url: string) => {
  const urlRegex = /^(http|https):\/\/[^ "]+$/;
  return urlRegex.test(url);
};

/**
 * Check to see if "prompt" has an allowed value.
 * @param prompt The prompt value
 * @returns boolean
 */
export const validatePrompt = (prompt: string) => {
  return ['none', 'login', 'consent', 'select_account'].includes(prompt);
}

/**
 * String to JSON parser
 * @param {str} str The string to parse
 * @returns {E.Right<T> | E.Left<"json_invalid">} An Either of the parsed JSON
 */
export function stringToJson<T>(
  str: string,
): E.Right<T | any> | E.Left<string> {
  try {
    return E.right(JSON.parse(str));
  } catch (err) {
    return E.left(JSON_INVALID);
  }
}
/**
 *
 * @param title string whose length we need to check
 * @param length minimum length the title needs to be
 * @returns boolean if title is of valid length or not
 */
export function isValidLength(title: string, length: number) {
  if (title.length < length) {
    return false;
  }

  return true;
}

/**
 * This function is called by bootstrap() in main.ts
 * It checks if the "VITE_ALLOWED_AUTH_PROVIDERS" environment variable is properly set or not.
 * If not, it throws an error.
 */
export function checkEnvironmentAuthProvider(
  VITE_ALLOWED_AUTH_PROVIDERS: string,
) {
  if (!VITE_ALLOWED_AUTH_PROVIDERS) {
    throw new Error(ENV_NOT_FOUND_KEY_AUTH_PROVIDERS);
  }

  if (VITE_ALLOWED_AUTH_PROVIDERS === '') {
    throw new Error(ENV_EMPTY_AUTH_PROVIDERS);
  }

  const givenAuthProviders = VITE_ALLOWED_AUTH_PROVIDERS.split(',').map(
    (provider) => provider.toLocaleUpperCase(),
  );
  const supportedAuthProviders = Object.values(AuthProvider).map(
    (provider: string) => provider.toLocaleUpperCase(),
  );

  for (const givenAuthProvider of givenAuthProviders) {
    if (!supportedAuthProviders.includes(givenAuthProvider)) {
      throw new Error(ENV_NOT_SUPPORT_AUTH_PROVIDERS);
    }
  }
}

/**
 * Adds escape backslashes to the input so that it can be used inside
 * SQL LIKE/ILIKE queries. Inspired by PHP's `mysql_real_escape_string`
 * function.
 *
 * Eg. "100%" -> "100\\%"
 *
 * Source: https://stackoverflow.com/a/32648526
 */
export function escapeSqlLikeString(str: string) {
  if (typeof str != 'string') return str;

  return str.replace(/[\0\x08\x09\x1a\n\r"'\\\%]/g, function (char) {
    switch (char) {
      case '\0':
        return '\\0';
      case '\x08':
        return '\\b';
      case '\x09':
        return '\\t';
      case '\x1a':
        return '\\z';
      case '\n':
        return '\\n';
      case '\r':
        return '\\r';
      case '"':
      case "'":
      case '\\':
      case '%':
        return '\\' + char; // prepends a backslash to backslash, percent,
      // and double/single quotes
    }
  });
}

/**
 * Calculate the expiration date of the token
 *
 * @param expiresOn Number of days the token is valid for
 * @returns Date object of the expiration date
 */
export function calculateExpirationDate(expiresOn: null | number) {
  if (expiresOn === null) return null;
  return new Date(Date.now() + expiresOn * 24 * 60 * 60 * 1000);
}

/*
 * Transforms the collection level properties (authorization & headers) under the `data` field.
 * Preserves `null` values and prevents duplicate stringification.
 *
 * @param {Prisma.JsonValue} collectionData - The team collection data to transform.
 * @returns {string | null} The transformed team collection data as a string.
 */
export function transformCollectionData(
  collectionData: Prisma.JsonValue,
): string | null {
  if (!collectionData) {
    return null;
  }

  return typeof collectionData === 'string'
    ? collectionData
    : JSON.stringify(collectionData);
}

// Encrypt and Decrypt functions. InfraConfig and Account table uses these functions to encrypt and decrypt the data.
const ENCRYPTION_ALGORITHM = 'aes-256-cbc';

/**
 * Encrypts a text using a key
 * @param text The text to encrypt
 * @param key The key to use for encryption
 * @returns The encrypted text
 */
export function encrypt(text: string, key = process.env.DATA_ENCRYPTION_KEY) {
  if (!key) throw new Error(ENV_NOT_FOUND_KEY_DATA_ENCRYPTION_KEY);

  if (text === null || text === undefined) return text;

  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(
    ENCRYPTION_ALGORITHM,
    Buffer.from(key),
    iv,
  );
  let encrypted = cipher.update(text);
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  return iv.toString('hex') + ':' + encrypted.toString('hex');
}

/**
 * Decrypts a text using a key
 * @param text The text to decrypt
 * @param key The key to use for decryption
 * @returns The decrypted text
 */
export function decrypt(
  encryptedData: string,
  key = process.env.DATA_ENCRYPTION_KEY,
) {
  if (!key) throw new Error(ENV_NOT_FOUND_KEY_DATA_ENCRYPTION_KEY);

  if (encryptedData === null || encryptedData === undefined) {
    return encryptedData;
  }

  const textParts = encryptedData.split(':');
  const iv = Buffer.from(textParts.shift(), 'hex');
  const encryptedText = Buffer.from(textParts.join(':'), 'hex');
  const decipher = crypto.createDecipheriv(
    ENCRYPTION_ALGORITHM,
    Buffer.from(key),
    iv,
  );
  let decrypted = decipher.update(encryptedText);
  decrypted = Buffer.concat([decrypted, decipher.final()]);
  return decrypted.toString();
}
