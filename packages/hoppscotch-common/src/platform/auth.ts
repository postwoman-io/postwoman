import { ClientOptions } from "@urql/core"
import { Observable } from "rxjs"
import { Component } from "vue"
import { getI18n } from "~/modules/i18n"
import * as E from "fp-ts/Either"
import { AxiosRequestConfig } from "axios"
import { GQLError } from "~/helpers/backend/GQLClient"

/**
 * A common (and required) set of fields that describe a user.
 */
export type HoppUser = {
  /** A unique ID identifying the user */
  uid: string

  /** The name to be displayed as the user's */
  displayName: string | null

  /** The user's email address */
  email: string | null

  /** URL to the profile picture of the user */
  photoURL: string | null

  // Regarding `provider` and `accessToken`:
  // The current implementation and use case for these 2 fields are super weird due to legacy.
  // Currrently these fields are only basically populated for Github Auth as we need the access token issued
  // by it to implement Gist submission. I would really love refactor to make this thing more sane.

  /** Name of the provider authenticating (NOTE: See notes on `platform/auth.ts`) */
  provider?: string
  /** Access Token for the auth of the user against the given `provider`. */
  accessToken?: string
  emailVerified: boolean
}

export type AuthEvent =
  | { event: "probable_login"; user: HoppUser } // We have previous login state, but the app is waiting for authentication
  | { event: "login"; user: HoppUser } // We are authenticated
  | { event: "logout" } // No authentication and we have no previous state

export type GithubSignInResult =
  | { type: "success"; user: HoppUser } // The authentication was a success
  | { type: "account-exists-with-different-cred"; link: () => Promise<void> } // We authenticated correctly, but the provider didn't match, so we give the user the opportunity to link to continue completing auth
  | { type: "error"; err: unknown } // Auth failed completely and we don't know why

export type LoginItemDef = {
  id: string
  icon: Component
  text: (t: ReturnType<typeof getI18n>) => string
  onClick: () => Promise<void> | void
}

export type AuthPlatformDef = {
  /**
   * Whether this platform shows a custom login selector UI. Used for situations
   * where we don't want to render the traditional UI and want to replace it
   * with something else
   */
  customLoginSelectorUI?: Component

  /**
   * Returns an observable that emits the current user as per the auth implementation.
   *
   * NOTES:
   * 1. Make sure to emit non-null values once you have credentials to perform backend operations. (Get required tokens ?)
   * 2. It is best to let the stream emit a value immediately on subscription (we can do that by basing this on a BehaviourSubject)
   *
   * @returns An observable which returns a `HoppUser` or null if not logged in (or login not completed)
   */
  getCurrentUserStream: () => Observable<HoppUser | null>

  /**
   * Returns a stream to events happening in the auth mechanism. Common uses these events to
   * let subsystems know something is changed by the authentication status and to react accordingly
   *
   * @returns An observable which emits an AuthEvent over time
   */
  getAuthEventsStream: () => Observable<AuthEvent>

  /**
   * Similar to `getCurrentUserStream` but deals with the authentication being `probable`.
   * Probable User for states where, "We haven't authed yet but we are guessing this person will auth eventually".
   * This allows for things like Header component to presumpt a state until we auth properly and avoid flashing a "logged out" state.
   *
   * NOTES:
   * 1. It is best to let the stream emit a value immediately on subscription (we can do that by basing this on a BehaviourSubject)
   * 2. Once the authentication is confirmed, this stream should emit the same values as `getCurrentUserStream`.
   *
   * @returns An obsverable which returns a `HoppUser` for the probable user (or confirmed user if authed) or null if we don't know about a probable user
   */
  getProbableUserStream: () => Observable<HoppUser | null>

  /**
   * Returns the currently authed user. (Similar rules apply as `getCurrentUserStream`)
   * @returns The authenticated user or null if not logged in
   */
  getCurrentUser: () => HoppUser | null

  /**
   * Returns the most probable to complete auth user. (Similar rules apply as `getProbableUserStream`)
   * @returns The probable user or null if have no idea who will auth in
   */
  getProbableUser: () => HoppUser | null

  /**
   * [This is only for Common Init logic to call!]
   * Called by Common when it is time to perform initialization activities for authentication.
   * (This is the best place to do init work for the auth subsystem in the platform).
   */
  performAuthInit: () => Promise<void>

  /**
   * Returns the headers that should be applied by the backend GQL API client (see GQLClient)
   * inorder to talk to the backend (like apply auth headers ?)
   * @returns An object with the header key and header values as strings
   */
  getBackendHeaders: () => Record<string, string>

  /**
   * Called when the backend GQL API client encounters an auth error to check if with the
   * current state, if an auth error is possible. This lets the backend GQL client know that
   * it can expect an auth error and we should wait and (possibly retry) to re-execute an operation.
   * This is useful for cases where queries might fail as the tokens just expired and need to be refreshed,
   * so the app can get the new token and GQL client knows to re-execute the same query.

   * @returns Whether an error is expected or not
   */
  willBackendHaveAuthError: () => boolean

  /**
   * Used to register a callback where the backend GQL client should reconnect/reconfigure subscriptions
   * as some communication parameter changed over time. Like for example, the backend subscription system
   * on a id token based mechanism should be let known that the id token has changed and reconnect the subscription
   * connection with the updated params.
   * @param func The callback function to call
   */
  onBackendGQLClientShouldReconnect: (func: () => void) => void

  /**
   * Called by the platform to provide additional/different config options when
   * setting up the URQL based GQLCLient instance
   * @returns
   */
  getGQLClientOptions?: () => Partial<ClientOptions>

  /**
   * called by the platform to provide additional/different config options when
   * sending requests with axios
   * eg: SH needs to include cookies in the request, while Central doesn't and throws a cors error if it does
   * Ensure to invoke `platform.auth.waitProbableLoginToConfirm()` before accessing
   *
   * @returns AxiosRequestConfig
   */
  axiosPlatformConfig?: () => AxiosRequestConfig

  /**
   * Returns the string content that should be returned when the user selects to
   * copy auth token from Developer Options.
   *
   * @returns The auth token (or equivalent) as a string if we have one to give, else null
   */
  getDevOptsBackendIDToken: () => string | null

  /**
   * Returns an empty promise that only resolves when the current probable user because confirmed.
   *
   * Note:
   * 1. Make sure there is a probable user before waiting, as if not, this function will throw
   * 2. If the probable user is already confirmed, this function will return an immediately resolved promise
   */
  waitProbableLoginToConfirm: () => Promise<void>

  /**
   * Called to sign in user with email (magic link). This should send backend calls to send the auth email.
   * @param email The email that is logging in.
   * @returns An empty promise that is resolved when the operation is complete
   */
  signInWithEmail: (email: string) => Promise<void>

  /**
   * Check whether a given link is a valid sign in with email, magic link response url.
   * (i.e, a URL that COULD be from a magic link email)
   * @param url The url to check
   * @returns Whether this is valid or not (NOTE: This is just a structural check not whether this is accepted (hence, not async))
   */
  isSignInWithEmailLink: (url: string) => boolean

  /**
   * Function that validates the magic link redirect and signs in the user
   *
   * @param email - Email to log in to
   * @param url - The action URL which is used to validate login
   * @returns A promise that resolves with the user info when auth is completed
   */
  signInWithEmailLink: (email: string, url: string) => Promise<void>

  /**
   * function that validates the magic link & signs the user in
   */
  processMagicLink: () => Promise<void>

  /**
   * Sends email verification email (the checkmark besides the email)
   * @returns When the check has succeed and completed
   */
  verifyEmailAddress: () => Promise<void>

  /**
   * Signs user in with Google.
   * @returns A promise that resolves with the user info when auth is completed
   */
  signInUserWithGoogle: () => Promise<void>
  /**
   * Signs user in with Github.
   * @returns A promise that resolves with the auth status, giving an opportunity to link if or handle failures
   */
  signInUserWithGithub: () => Promise<GithubSignInResult> | Promise<undefined>
  /**
   * Signs user in with Microsoft.
   * @returns A promise that resolves with the user info when auth is completed
   */
  signInUserWithMicrosoft: () => Promise<void>

  /**
   * Signs out the user from auth
   * @returns An empty promise that is resolved when the operation is complete
   */
  signOutUser: () => Promise<void>

  /**
   * Updates the email address of the user
   * @param email The new email to set this to.
   * @returns An empty promise that is resolved when the operation is complete
   */
  setEmailAddress: (email: string) => Promise<void>

  /**
   * Updates the display name of the user
   * @param name The new name to set this to.
   * @returns A promise that resolves with the display name update status when the operation is complete
   */
  setDisplayName: (
    name: string
  ) => Promise<E.Either<GQLError<string>, undefined>>

  /**
   * Returns the list of allowed auth providers for the platform ( the currently supported ones are GOOGLE, GITHUB, EMAIL, MICROSOFT, SAML )
   */
  getAllowedAuthProviders: () => Promise<E.Either<string, string[]>>

  /**
   * Defines the additional login items that should be shown in the login screen
   */
  additionalLoginItems?: LoginItemDef[]
}
