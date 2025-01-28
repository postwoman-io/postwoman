import * as E from "fp-ts/Either"
import { BehaviorSubject, Subscription } from "rxjs"
import { Subscription as WSubscription } from "wonka"
import { GQLError, runAuthOnlyGQLSubscription } from "../backend/GQLClient"
import {
  GetUserShortcodesQuery,
  ShortcodeCreatedDocument,
  ShortcodeDeletedDocument,
  ShortcodeUpdatedDocument,
} from "../backend/graphql"
import { BACKEND_PAGE_SIZE } from "../backend/helpers"
import { Shortcode } from "./Shortcode"
import { platform } from "~/platform"

export default class ShortcodeListAdapter {
  error$: BehaviorSubject<GQLError<string> | null>
  loading$: BehaviorSubject<boolean>
  shortcodes$: BehaviorSubject<GetUserShortcodesQuery["myShortcodes"]>
  hasMoreShortcodes$: BehaviorSubject<boolean>

  private isDispose: boolean

  private shortcodeCreated: Subscription | null
  private shortcodeRevoked: Subscription | null
  private shortcodeUpdated: Subscription | null

  private shortcodeCreatedSub: WSubscription | null
  private shortcodeRevokedSub: WSubscription | null
  private shortcodeUpdatedSub: WSubscription | null

  constructor(deferInit = false) {
    this.error$ = new BehaviorSubject<GQLError<string> | null>(null)
    this.loading$ = new BehaviorSubject<boolean>(false)
    this.shortcodes$ = new BehaviorSubject<
      GetUserShortcodesQuery["myShortcodes"]
    >([])
    this.hasMoreShortcodes$ = new BehaviorSubject<boolean>(true)
    this.isDispose = true
    this.shortcodeCreated = null
    this.shortcodeRevoked = null
    this.shortcodeUpdated = null
    this.shortcodeCreatedSub = null
    this.shortcodeRevokedSub = null
    this.shortcodeUpdatedSub = null

    if (!deferInit) this.initialize()
  }

  unsubscribeSubscriptions() {
    this.shortcodeCreated?.unsubscribe()
    this.shortcodeRevoked?.unsubscribe()
    this.shortcodeUpdated?.unsubscribe()
    this.shortcodeCreatedSub?.unsubscribe()
    this.shortcodeRevokedSub?.unsubscribe()
    this.shortcodeUpdatedSub?.unsubscribe()
  }

  initialize() {
    if (!this.isDispose) throw new Error(`Adapter is already initialized`)

    this.isDispose = false
    this.fetchList()
    this.registerSubscriptions()
  }

  /**
   * Returns whether the shortcode adapter is active and initialized
   */
  public isInitialized() {
    return !this.isDispose
  }

  public dispose() {
    if (this.isDispose) throw new Error(`Adapter has been disposed`)
    this.isDispose = true
    this.shortcodes$.next([])
    this.unsubscribeSubscriptions()
  }

  fetchList() {
    this.loadMore(true)
  }

  async loadMore(forcedAttempt = false) {
    if (!this.hasMoreShortcodes$.value && !forcedAttempt) return

    this.loading$.next(true)

    const lastCodeID =
      this.shortcodes$.value.length > 0
        ? this.shortcodes$.value[this.shortcodes$.value.length - 1].id
        : undefined

    const result = await platform.backend.getUserShortcodes(lastCodeID)

    if (E.isLeft(result)) {
      this.error$.next(result.left)
      console.error(result.left)
      this.loading$.next(false)

      throw new Error(`Failed fetching shortcodes list: ${result.left}`)
    }

    const fetchedResult = result.right.myShortcodes

    this.pushNewShortcode(fetchedResult)

    if (fetchedResult.length !== BACKEND_PAGE_SIZE) {
      this.hasMoreShortcodes$.next(false)
    }

    this.loading$.next(false)
  }

  private pushNewShortcode(results: Shortcode[]) {
    const userShortcodes = this.shortcodes$.value

    userShortcodes.push(...results)

    this.shortcodes$.next(userShortcodes)
  }

  private createShortcode(shortcode: Shortcode) {
    const userShortcode = this.shortcodes$.value

    userShortcode.unshift(shortcode)

    this.shortcodes$.next(userShortcode)
  }

  private deleteSharedRequest(codeId: string) {
    const newShortcode = this.shortcodes$.value.filter(
      ({ id }) => id !== codeId
    )

    this.shortcodes$.next(newShortcode)
  }

  private updateSharedRequest(shortcode: Shortcode) {
    const newShortcode = this.shortcodes$.value.map((oldShortcode) =>
      oldShortcode.id === shortcode.id ? shortcode : oldShortcode
    )

    this.shortcodes$.next(newShortcode)
  }

  private registerSubscriptions() {
    const [shortcodeCreated$, shortcodeCreatedSub] = runAuthOnlyGQLSubscription(
      {
        query: ShortcodeCreatedDocument,
        variables: {},
      }
    )

    this.shortcodeCreatedSub = shortcodeCreatedSub
    this.shortcodeCreated = shortcodeCreated$.subscribe((result) => {
      if (E.isLeft(result)) {
        console.error(result.left)
        throw new Error(`Shortcode Create Error ${result.left}`)
      }

      this.createShortcode(result.right.myShortcodesCreated)
    })

    const [shortcodeRevoked$, shortcodeRevokedSub] = runAuthOnlyGQLSubscription(
      {
        query: ShortcodeDeletedDocument,
        variables: {},
      }
    )

    this.shortcodeRevokedSub = shortcodeRevokedSub
    this.shortcodeRevoked = shortcodeRevoked$.subscribe((result) => {
      if (E.isLeft(result)) {
        console.error(result.left)
        throw new Error(`Shortcode Delete Error ${result.left}`)
      }

      this.deleteSharedRequest(result.right.myShortcodesRevoked.id)
    })

    const [shortcodeUpdated$, shortcodeUpdatedSub] = runAuthOnlyGQLSubscription(
      {
        query: ShortcodeUpdatedDocument,
        variables: {},
      }
    )

    this.shortcodeUpdatedSub = shortcodeUpdatedSub
    this.shortcodeUpdated = shortcodeUpdated$.subscribe((result) => {
      if (E.isLeft(result)) {
        console.error(result.left)
        throw new Error(`Shortcode Update Error ${result.left}`)
      }

      this.updateSharedRequest(result.right.myShortcodesUpdated)
    })
  }
}
