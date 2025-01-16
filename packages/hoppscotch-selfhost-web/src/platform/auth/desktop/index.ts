import * as E from "fp-ts/Either"

import { BehaviorSubject, Subject } from "rxjs"
import { Ref, ref, watch } from "vue"

import { content } from "@hoppscotch/kernel"

import { Io } from "@hoppscotch/common/kernel/io"
import { listen } from "@tauri-apps/api/event"
import { getService } from "@hoppscotch/common/modules/dioc"
import { parseBodyAsJSON } from "@hoppscotch/common/helpers/functional/json"
import { AuthEvent, AuthPlatformDef } from "@hoppscotch/common/platform/auth"
import { PersistenceService } from "@hoppscotch/common/services/persistence"
import { KernelInterceptorService } from "@hoppscotch/common/services/kernel-interceptor.service"

import Login from "@platform-components/Login.vue"
import { getAllowedAuthProviders, updateUserDisplayName } from "./api"

export type HoppUserWithAuthDetail = {
  uid: string
  displayName: string | null
  email: string | null
  photoURL: string | null
  provider?: string
  accessToken?: string
  refreshToken?: string
  emailVerified: boolean
}

interface GQLResponse {
  data?: {
    me: HoppUserWithAuthDetail
  }
  errors?: Array<{ message: string }>
}

export const authEvents$ = new Subject<AuthEvent>()
export const currentUser$ = new BehaviorSubject<HoppUserWithAuthDetail | null>(null)
export const probableUser$ = new BehaviorSubject<HoppUserWithAuthDetail | null>(null)

const isGettingInitialUser: Ref<null | boolean> = ref(null)

const persistenceService = getService(PersistenceService)
const interceptorService = getService(KernelInterceptorService)

async function logout() {
  const { response } = interceptorService.execute({
    id: Date.now(),
    url: `${import.meta.env.VITE_BACKEND_API_URL}/auth/logout`,
    version: "HTTP/1.1",
    method: "GET",
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

async function getInitialUserDetails(): Promise<GQLResponse | { error: string }> {
  try {
    const accessToken = await persistenceService.getLocalConfig("access_token")
    const refreshToken = await persistenceService.getLocalConfig("refresh_token")
    if (!accessToken || !refreshToken) return { error: "Access token not found" }

    const { response } = interceptorService.execute({
      id: Date.now(),
      url: `${import.meta.env.VITE_BACKEND_GQL_URL}`,
      method: "POST",
      version: "HTTP/1.1",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
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

    const responseBytes = await response
    if (E.isLeft(responseBytes)) {
      return { error: "auth/cookies_not_found" }
    }

    const res = parseBodyAsJSON<GQLResponse>(responseBytes.right.body)
    if (res._tag == "Some" && res.value.data?.me) {
      return {
        data: {
          me: {
            ...res.value.data.me,
            refreshToken,
            accessToken,
            emailVerified: true
          }
        }
      }
    }
    return { error: "auth/cookies_not_found" }
  } catch (error) {
    return { error: "auth/cookies_not_found" }
  }
}

async function setUser(user: HoppUserWithAuthDetail | null) {
  const accessToken = await persistenceService.getLocalConfig("access_token")
  const refreshToken = await persistenceService.getLocalConfig("refresh_token")

  if (!accessToken || !refreshToken) return null

  const userWithToken = user && accessToken && refreshToken ? {
    ...user,
    accessToken,
    refreshToken,
  } : null

  currentUser$.next(userWithToken)
  probableUser$.next(userWithToken)
  await persistenceService.setLocalConfig("login_state", JSON.stringify(userWithToken))
}

export async function setInitialUser() {
  isGettingInitialUser.value = true
  const res = await getInitialUserDetails()

  if ('error' in res) {
    await setUser(null)
    isGettingInitialUser.value = false
    return
  }

  if (res.errors?.[0]?.message === "Unauthorized") {
    const isRefreshSuccess = await refreshToken()
    if (isRefreshSuccess) {
      await setInitialUser()
    } else {
      await setUser(null)
      isGettingInitialUser.value = false
    }
    return
  }

  if (res.data?.me) {
    const hoppBackendUser = res.data.me
    const accessToken = await persistenceService.getLocalConfig("access_token")
    if (!accessToken) return null

    if (!accessToken) {
      await setUser(null)
      isGettingInitialUser.value = false
      return
    }

    const HoppUserWithAuthDetail: HoppUserWithAuthDetail = {
      uid: hoppBackendUser.uid,
      displayName: hoppBackendUser.displayName,
      email: hoppBackendUser.email,
      photoURL: hoppBackendUser.photoURL,
      emailVerified: true,
      accessToken,
    }

    await setUser(HoppUserWithAuthDetail)
    isGettingInitialUser.value = false

    authEvents$.next({
      event: "login",
      user: HoppUserWithAuthDetail,
    })
  }
}

async function refreshToken() {
  try {
    const refreshToken = await persistenceService.getLocalConfig("refresh_token")
    if (!refreshToken) return null

    const { response } = interceptorService.execute({
      id: Date.now(),
      url: `${import.meta.env.VITE_BACKEND_API_URL}/auth/refresh`,
      method: "GET",
      version: "HTTP/1.1",
      headers: {
        "Authorization": `Bearer ${refreshToken}`,
      }
    })

    const res = await response
    if (E.isLeft(res)) return false

    await setAuthCookies(res.right.headers)
    const isSuccessful = res.right.status === 200

    if (isSuccessful && currentUser$.value) {
      authEvents$.next({
        event: "login",
        user: {
          uid: currentUser$.value.uid,
          displayName: currentUser$.value.displayName,
          email: currentUser$.value.email,
          photoURL: currentUser$.value.photoURL,
          emailVerified: currentUser$.value.emailVerified,
        },
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
    version: "HTTP/1.1",
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
  const cookieHeader = headers.get('set-cookie')
  const cookies = cookieHeader ? cookieHeader.split(',') : []

  const accessTokenMatch = cookies.join(',').match(/access_token=([^;]+)/)
  const refreshTokenMatch = cookies.join(',').match(/refresh_token=([^;]+)/)

  if (accessTokenMatch) {
    const accessToken = accessTokenMatch[1]
    await persistenceService.setLocalConfig("access_token", accessToken)
  }

  if (refreshTokenMatch) {
    const refreshToken = refreshTokenMatch[1]
    await persistenceService.setLocalConfig("refresh_token", refreshToken)
  }
}

export const def: AuthPlatformDef = {
  customLoginSelectorUI: Login,
  getCurrentUserStream: () => currentUser$,
  getAuthEventsStream: () => authEvents$,
  getProbableUserStream: () => probableUser$,
  getCurrentUser: () => currentUser$.value,
  getProbableUser: () => probableUser$.value,

  async getAllowedAuthProviders() {
    return await getAllowedAuthProviders()
  },

  getBackendHeaders() {
    const accessToken = currentUser$.value?.accessToken
    return accessToken ? {
      Authorization: `Bearer ${accessToken}`
    } : {} as Record<string, string>
  },

  getGQLClientOptions() {
    const accessToken = currentUser$.value?.accessToken
    return {
      // For GraphQL subscriptions via WebSocket
      connectionParams: accessToken ? {
        Authorization: `Bearer ${accessToken}`
      } : undefined,
      // For regular HTTP queries
      fetchOptions: {
        headers: accessToken
          ? { Authorization: `Bearer ${accessToken}` }
          : undefined
      }
    }
  },

  axiosPlatformConfig() {
    const accessToken = currentUser$.value?.accessToken
    return {
      headers: accessToken ? {
        Authorization: `Bearer ${accessToken}`
      } : {}
    }
  },

  willBackendHaveAuthError() {
    return !currentUser$.value
  },

  onBackendGQLClientShouldReconnect(func) {
    authEvents$.subscribe((event) => {
      if (event.event === "login" || event.event === "logout") {
        func()
      }
    })
  },

  isSignInWithEmailLink(url: string) {
    const urlObject = new URL(url)
    const searchParams = new URLSearchParams(urlObject.search)
    return searchParams.has("token")
  },

  async processMagicLink(): Promise<void> {
    return Promise.resolve()
  },

  getDevOptsBackendIDToken() {
    return null
  },

  async performAuthInit() {
    const loginState = await persistenceService.getLocalConfig("login_state")
    const probableUser = JSON.parse(loginState ?? "null")
    probableUser$.next(probableUser)
    await setInitialUser()

    await listen<string>('scheme-request-received', async (event: { payload: string }) => {
      const deepLink = event.payload;
      const params = new URLSearchParams(deepLink.split('?')[1]);

      const accessToken = params.get('access_token');
      const refreshToken = params.get('refresh_token');
      const token = params.get('token');

      if (accessToken && refreshToken) {
        await persistenceService.setLocalConfig("access_token", accessToken);
        await persistenceService.setLocalConfig("refresh_token", refreshToken);
        return;
      }

      if (token) {
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

  async signInWithEmailLink(_email: string, url: string) {
    const deviceIdentifier = await persistenceService.getLocalConfig("deviceIdentifier")

    if (!deviceIdentifier) {
      throw new Error(
        "Device Identifier not found, you can only signin from the browser you generated the magic link"
      )
    }

    const urlObject = new URL(url)
    const searchParams = new URLSearchParams(urlObject.search)
    const token = searchParams.get("token")
    const verifyToken = token || await persistenceService.getLocalConfig("verifyToken")

    const { response } = interceptorService.execute({
      id: Date.now(),
      url: `${import.meta.env.VITE_BACKEND_API_URL}/auth/verify`,
      version: "HTTP/1.1",
      method: "POST",
      content: content.json({
        token: verifyToken,
        deviceIdentifier
      })
    })

    const res = await response
    if (E.isLeft(res)) throw new Error("Failed to verify email link")

    await setAuthCookies(res.right.headers)

    await persistenceService.removeLocalConfig("deviceIdentifier")
    await persistenceService.removeLocalConfig("verifyToken")
  },

  async setEmailAddress(_email: string) {
    return
  },

  async setDisplayName(name: string) {
    if (!name) return E.left("USER_NAME_CANNOT_BE_EMPTY")
    if (!currentUser$.value) return E.left("NO_USER_LOGGED_IN")

    const res = await updateUserDisplayName(name)

    if (E.isRight(res)) {
      const user = currentUser$.value
      if (user) {
        await setUser({
          ...user,
          displayName: res.right.updateDisplayName.displayName ?? null,
        })
      }
      return E.right(undefined)
    }
    return E.left(res.left)
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
