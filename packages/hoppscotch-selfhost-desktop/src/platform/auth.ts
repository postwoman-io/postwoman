import axios from "axios"
import {
  AuthEvent,
  AuthPlatformDef,
  HoppUser,
} from "@hoppscotch/common/platform/auth"
import { BehaviorSubject, Subject } from "rxjs"
import {
  getLocalConfig,
  removeLocalConfig,
  setLocalConfig,
} from "@hoppscotch/common/newstore/localpersistence"
import { Ref, ref, watch } from "vue"
import { open } from "@tauri-apps/api/shell"
import { Body, getClient } from "@tauri-apps/api/http"
import { listen } from "@tauri-apps/api/event"
import { Store } from "tauri-plugin-store-api"
import { subscriptionExchange } from "@urql/core"
import {
  getSubscriptionClient,
  tauriGQLFetchExchange,
} from "../helpers/GQLClient"

export const authEvents$ = new Subject<AuthEvent | { event: "token_refresh" }>()
const currentUser$ = new BehaviorSubject<HoppUser | null>(null)
export const probableUser$ = new BehaviorSubject<HoppUser | null>(null)

export const APP_DATA_PATH = "~/.hopp-desktop-app-data.dat"

async function logout() {
  let client = await getClient()
  await client.get(`${import.meta.env.VITE_BACKEND_API_URL}/auth/logout`)

  const store = new Store(APP_DATA_PATH)
  await store.set("refresh_token", {})
  await store.set("access_token", {})
  await store.save()
}

async function signInUserWithGithubFB() {
  await open(
    `${import.meta.env.VITE_BACKEND_API_URL}/auth/github?redirect_uri=desktop`
  )
}

async function signInUserWithGoogleFB() {
  await open(
    `${import.meta.env.VITE_BACKEND_API_URL}/auth/google?redirect_uri=desktop`
  )
}

async function signInUserWithMicrosoftFB() {
  await open(
    `${
      import.meta.env.VITE_BACKEND_API_URL
    }/auth/microsoft?redirect_uri=desktop`
  )
}

async function getInitialUserDetails() {
  const store = new Store(APP_DATA_PATH)

  try {
    const accessToken = await store.get("access_token")
    let client = await getClient()
    let body = {
      query: `query Me {
      me {
        uid
        displayName
        email
        photoURL
        isAdmin
        createdOn
      }
    }`,
    }

    let res = await client.post(
      `${import.meta.env.VITE_BACKEND_GQL_URL}`,
      Body.json(body),
      {
        headers: {
          Cookie: `access_token=${accessToken.value}`,
        },
      }
    )

    return res.data
  } catch (error) {
    let res = {
      error: "auth/cookies_not_found",
    }

    return res
  }
}

const isGettingInitialUser: Ref<null | boolean> = ref(null)

function setUser(user: HoppUser | null) {
  currentUser$.next(user)
  probableUser$.next(user)

  setLocalConfig("login_state", JSON.stringify(user))
}

async function setInitialUser() {
  isGettingInitialUser.value = true
  const res = await getInitialUserDetails()

  const error = res.errors && res.errors[0]

  // no cookies sent. so the user is not logged in
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

  // cookies sent, but it is expired, we need to refresh the token
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

  // no errors, we have a valid user
  if (res.data && res.data.me) {
    const hoppBackendUser = res.data.me

    const hoppUser: HoppUser = {
      uid: hoppBackendUser.uid,
      displayName: hoppBackendUser.displayName,
      email: hoppBackendUser.email,
      photoURL: hoppBackendUser.photoURL,
      // all our signin methods currently guarantees the email is verified
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
  const store = new Store(APP_DATA_PATH)
  try {
    const refreshToken = await store.get("refresh_token")

    let client = await getClient()
    let res = await client.get(
      `${import.meta.env.VITE_BACKEND_API_URL}/auth/refresh`,
      {
        headers: { Cookie: `refresh_token=${refreshToken.value}` },
      }
    )

    setAuthCookies(res.rawHeaders)

    const isSuccessful = res.status === 200

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
  const client = await getClient()
  let url = `${import.meta.env.VITE_BACKEND_API_URL}/auth/signin?origin=desktop`

  const res = await client.post(url, Body.json({ email }))

  if (res.data && res.data.deviceIdentifier) {
    setLocalConfig("deviceIdentifier", res.data.deviceIdentifier)
  } else {
    throw new Error("test: does not get device identifier")
  }

  return res.data
}

async function setAuthCookies(rawHeaders: Array<String>) {
  let cookies = rawHeaders["set-cookie"].join("|")

  const accessTokenMatch = cookies.match(/access_token=([^;]+)/)
  const refreshTokenMatch = cookies.match(/refresh_token=([^;]+)/)

  const store = new Store(APP_DATA_PATH)

  if (accessTokenMatch) {
    const accessToken = accessTokenMatch[1]
    await store.set("access_token", { value: accessToken })
  }

  if (refreshTokenMatch) {
    const refreshToken = refreshTokenMatch[1]
    await store.set("refresh_token", { value: refreshToken })
  }

  await store.save()
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
      exchanges: [
        subscriptionExchange({
          forwardSubscription(fetchBody) {
            const subscriptionClient = getSubscriptionClient()
            return subscriptionClient!.request(fetchBody)
          },
        }),
        tauriGQLFetchExchange(new Store(APP_DATA_PATH)),
      ],
      fetchOptions: {
        credentials: "include",
      },
    }
  },

  /**
   * it is not possible for us to know if the current cookie is expired because we cannot access http-only cookies from js
   * hence just returning if the currentUser$ has a value associated with it
   */
  willBackendHaveAuthError() {
    return !currentUser$.value
  },
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
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

  /**
   * we cannot access our auth cookies from javascript, so leaving this as null
   */
  getDevOptsBackendIDToken() {
    return null
  },
  async performAuthInit() {
    const probableUser = JSON.parse(getLocalConfig("login_state") ?? "null")
    probableUser$.next(probableUser)
    await setInitialUser()

    await listen("scheme-request-received", async (event: any) => {
      let deep_link = event.payload as string

      const params = new URLSearchParams(deep_link.split("?")[1])
      const accessToken = params.get("access_token")
      const refreshToken = params.get("refresh_token")
      const token = params.get("token")

      function isNotNullOrUndefined(x: any) {
        return x !== null && x !== undefined
      }

      if (
        isNotNullOrUndefined(accessToken) &&
        isNotNullOrUndefined(refreshToken)
      ) {
        const store = new Store(APP_DATA_PATH)

        await store.set("access_token", { value: accessToken })
        await store.set("refresh_token", { value: refreshToken })
        await store.save()

        window.location.href = "/"
        return
      }

      if (isNotNullOrUndefined(token)) {
        setLocalConfig("verifyToken", token)
        await this.signInWithEmailLink("", "")
        await setInitialUser()
      }
    })
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
    const deviceIdentifier = getLocalConfig("deviceIdentifier")

    if (!deviceIdentifier) {
      throw new Error(
        "Device Identifier not found, you can only signin from the browser you generated the magic link"
      )
    }

    let verifyToken = getLocalConfig("verifyToken")

    const client = await getClient()
    let res = await client.post(
      `${import.meta.env.VITE_BACKEND_API_URL}/auth/verify`,
      Body.json({
        token: verifyToken,
        deviceIdentifier,
      })
    )

    setAuthCookies(res.rawHeaders)

    removeLocalConfig("deviceIdentifier")
    removeLocalConfig("verifyToken")
    window.location.href = "/"
  },
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async setEmailAddress(_email: string) {
    return
  },
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async setDisplayName(name: string) {
    return
  },

  async signOutUser() {
    // if (!currentUser$.value) throw new Error("No user has logged in")

    await logout()

    probableUser$.next(null)
    currentUser$.next(null)
    removeLocalConfig("login_state")

    authEvents$.next({
      event: "logout",
    })
  },
}
