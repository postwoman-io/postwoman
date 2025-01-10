import * as E from "fp-ts/Either"

import { BehaviorSubject, Subject } from "rxjs"
import { Ref, ref, watch } from "vue"

import { Io } from "@hoppscotch/common/kernel/io"
import { content } from "@hoppscotch/kernel"
import { getService } from "@hoppscotch/common/modules/dioc"
import {
  AuthEvent,
  AuthPlatformDef,
  HoppUser,
} from "@hoppscotch/common/platform/auth"
import {
  PersistenceService
} from "@hoppscotch/common/services/persistence"
import {
  KernelInterceptorService
} from "@hoppscotch/common/services/kernel-interceptor.service"

export const authEvents$ = new Subject<AuthEvent | { event: "token_refresh" }>()
export const currentUser$ = new BehaviorSubject<HoppUser | null>(null)
export const probableUser$ = new BehaviorSubject<HoppUser | null>(null)

const persistenceService = getService(PersistenceService)
const interceptorService = getService(KernelInterceptorService)

async function logout() {
  const { response } = interceptorService.execute({
    id: Date.now(),
    url: `${import.meta.env.VITE_BACKEND_API_URL}/auth/logout`,
    method: "GET",
    version: "HTTP/1.1"
  })

  await response
  await persistenceService.removeLocalConfig("refresh_token")
  await persistenceService.removeLocalConfig("access_token")
}

async function signInUserWithGithubFB() {
  await Io.openExternalLink({
    url: `${import.meta.env.VITE_BACKEND_API_URL}/auth/github?redirect_uri=desktop`
  })
}

async function signInUserWithGoogleFB() {
  await Io.openExternalLink({
    url: `${import.meta.env.VITE_BACKEND_API_URL}/auth/google?redirect_uri=desktop`
  })
}

async function signInUserWithMicrosoftFB() {
  await Io.openExternalLink({
    url: `${import.meta.env.VITE_BACKEND_API_URL}/auth/microsoft?redirect_uri=desktop`
  })
}

async function getInitialUserDetails() {
  try {
    const accessToken = await persistenceService.getLocalConfig("access_token")

    const { response } = interceptorService.execute({
      id: Date.now(),
      url: `${import.meta.env.VITE_BACKEND_GQL_URL}`,
      method: "POST",
      headers: {
        "Cookie": `access_token=${accessToken}`,
      },
      content: content.json({
        query: `query Me {
          me {
            uid
            displayName
            email
            photoURL
            isAdmin
            createdOn
          }
        }`
      })
    })

    const res = await response
    if (E.isLeft(res)) {
      return { error: "auth/cookies_not_found" }
    }

    return res.right.data
  } catch (error) {
    return { error: "auth/cookies_not_found" }
  }
}

const isGettingInitialUser: Ref<null | boolean> = ref(null)

async function setUser(user: HoppUser | null) {
  currentUser$.next(user)
  probableUser$.next(user)
  await persistenceService.setLocalConfig("login_state", JSON.stringify(user))
}

async function setInitialUser() {
  isGettingInitialUser.value = true
  const res = await getInitialUserDetails()

  const error = res.errors && res.errors[0]

  if (error && error.message === "auth/cookies_not_found") {
    setUser(null)
    isGettingInitialUser.value = false
    return
  }

  if (error && error.message === "user/not_found") {
    setUser(null)
    isGettingInitialUser.value = false
    return
  }

  if (error && error.message === "Unauthorized") {
    const isRefreshSuccess = await refreshToken()

    if (isRefreshSuccess) {
      setInitialUser()
    } else {
      setUser(null)
      isGettingInitialUser.value = false
    }

    return
  }

  if (res.data && res.data.me) {
    const hoppBackendUser = res.data.me

    const hoppUser: HoppUser = {
      uid: hoppBackendUser.uid,
      displayName: hoppBackendUser.displayName,
      email: hoppBackendUser.email,
      photoURL: hoppBackendUser.photoURL,
      emailVerified: true,
    }

    setUser(hoppUser)
    isGettingInitialUser.value = false

    authEvents$.next({
      event: "login",
      user: hoppUser,
    })

    return
  }
}

async function refreshToken() {
  try {
    const refreshToken = await persistenceService.getLocalConfig("refresh_token")

    const { response } = interceptorService.execute({
      id: Date.now(),
      url: `${import.meta.env.VITE_BACKEND_API_URL}/auth/refresh`,
      method: "GET",
      headers: {
        "Cookie": `refresh_token=${refreshToken}`
      }
    })

    const res = await response
    if (E.isLeft(res)) return false

    setAuthCookies(res.right.headers)
    const isSuccessful = res.right.status === 200

    if (isSuccessful) {
      authEvents$.next({
        event: "token_refresh",
      })
    }

    return isSuccessful
  } catch (err) {
    return false
  }
}

async function sendMagicLink(email: string) {
  const { response } = interceptorService.execute({
    id: Date.now(),
    url: `${import.meta.env.VITE_BACKEND_API_URL}/auth/signin?origin=desktop`,
    method: "POST",
    content: content.json({ email })
  })

  const res = await response
  if (E.isLeft(res)) throw new Error("Failed to send magic link")

  if (res.right.data && res.right.data.deviceIdentifier) {
    await persistenceService.setLocalConfig("deviceIdentifier", res.right.data.deviceIdentifier)
  } else {
    throw new Error("Does not get device identifier")
  }

  return res.right.data
}

async function setAuthCookies(headers: Headers) {
  let cookies = headers.get('set-cookie')?.join("|") || ""

  const accessTokenMatch = cookies.match(/access_token=([^;]+)/);
  const refreshTokenMatch = cookies.match(/refresh_token=([^;]+)/);

  if (accessTokenMatch) {
    const accessToken = accessTokenMatch[1];
    await persistenceService.setLocalConfig("access_token", accessToken)
  }

  if (refreshTokenMatch) {
    const refreshToken = refreshTokenMatch[1];
    await persistenceService.setLocalConfig("refresh_token", refreshToken)
  }
}

export const def: AuthPlatformDef = {
  getCurrentUserStream: () => currentUser$,
  getAuthEventsStream: () => authEvents$,
  getProbableUserStream: () => probableUser$,

  getCurrentUser: () => currentUser$.value,
  getProbableUser: () => probableUser$.value,

  getBackendHeaders() {
    return {}
  },
  getGQLClientOptions() {
    return {
      fetchOptions: {
        credentials: "include",
      },
    }
  },

  willBackendHaveAuthError() {
    return !currentUser$.value
  },

  onBackendGQLClientShouldReconnect(func) {
    authEvents$.subscribe((event) => {
      if (
        event.event == "login" ||
        event.event == "logout" ||
        event.event == "token_refresh"
      ) {
        func()
      }
    })
  },

  getDevOptsBackendIDToken() {
    return null
  },

  async performAuthInit() {
    const probableUser = JSON.parse(await persistenceService.getLocalConfig("login_state") ?? "null")
    probableUser$.next(probableUser)
    await setInitialUser()

    await Io.listen<string>('scheme-request-received', async (event) => {
      let deep_link = event.payload;
      const params = new URLSearchParams(deep_link.split('?')[1]);

      const accessToken = params.get('access_token');
      const refreshToken = params.get('refresh_token');
      const token = params.get('token');

      if (accessToken !== null && accessToken !== undefined && refreshToken !== null && refreshToken !== undefined) {
        await persistenceService.setLocalConfig("access_token", accessToken);
        await persistenceService.setLocalConfig("refresh_token", refreshToken);
        window.location.href = "/"
        return;
      }

      if (token !== null && token !== undefined) {
        await persistenceService.setLocalConfig("verifyToken", token)
        await this.signInWithEmailLink("", "")
        await setInitialUser()
      }
    });
  },

  waitProbableLoginToConfirm() {
    return new Promise<void>((resolve, reject) => {
      if (this.getCurrentUser()) {
        resolve()
      }

      if (!probableUser$.value) reject(new Error("no_probable_user"))

      const unwatch = watch(isGettingInitialUser, (val) => {
        if (val === true || val === false) {
          resolve()
          unwatch()
        }
      })
    })
  },

  async signInWithEmail(email: string) {
    await sendMagicLink(email)
  },

  async verifyEmailAddress() {
    return
  },

  async signInUserWithGoogle() {
    await signInUserWithGoogleFB()
  },

  async signInUserWithGithub() {
    await signInUserWithGithubFB()
    return undefined
  },

  async signInUserWithMicrosoft() {
    await signInUserWithMicrosoftFB()
  },

  async signInWithEmailLink(_email, _url) {
    const deviceIdentifier = await persistenceService.getLocalConfig("deviceIdentifier")

    if (!deviceIdentifier) {
      throw new Error(
        "Device Identifier not found, you can only signin from the browser you generated the magic link"
      )
    }

    const verifyToken = await persistenceService.getLocalConfig("verifyToken")

    const { response } = interceptorService.execute({
      id: Date.now(),
      url: `${import.meta.env.VITE_BACKEND_API_URL}/auth/verify`,
      method: "POST",
      content: content.json({
        token: verifyToken,
        deviceIdentifier
      })
    })

    const res = await response
    if (E.isLeft(res)) throw new Error("Failed to verify email link")

    setAuthCookies(res.right.headers)

    await persistenceService.removeLocalConfig("deviceIdentifier")
    await persistenceService.removeLocalConfig("verifyToken")
    window.location.href = "/"
  },

  async setEmailAddress(_email: string) {
    return
  },

  async setDisplayName(_name: string) {
    return
  },

  async signOutUser() {
    await logout()

    probableUser$.next(null)
    currentUser$.next(null)
    await persistenceService.removeLocalConfig("login_state")

    authEvents$.next({
      event: "logout",
    })
  },
}
