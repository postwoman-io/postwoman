import { Component, markRaw, reactive } from "vue"
import { invokeAction } from "~/helpers/actions"
import { getI18n } from "~/modules/i18n"
import { SpotlightSearcherResult, SpotlightService } from ".."
import {
  SearchResult,
  StaticSpotlightSearcherService,
} from "./base/static.searcher"

import IconLinkedIn from "~icons/brands/linkedin"
import IconTwitter from "~icons/brands/twitter"
import IconDiscord from "~icons/brands/discord"
import IconGitHub from "~icons/lucide/github"
import IconBook from "~icons/lucide/book"
import IconLifeBuoy from "~icons/lucide/life-buoy"
import IconZap from "~icons/lucide/zap"
import { platform } from "~/platform"
import { Container } from "dioc"

type Doc = {
  text: string | string[]
  alternates: string[]
  icon: object | Component
  action: () => void
}

/**
 *
 * This searcher is responsible for providing general related actions on the spotlight results.
 *
 * NOTE: Initializing this service registers it as a searcher with the Spotlight Service.
 */
export class GeneralSpotlightSearcherService extends StaticSpotlightSearcherService<Doc> {
  public static readonly ID = "GENERAL_SPOTLIGHT_SEARCHER_SERVICE"

  private t = getI18n()

  public readonly searcherID = "general"
  public searcherSectionTitle = this.t("spotlight.general.title")

  private readonly spotlight = this.bind(SpotlightService)

  private documents: Record<string, Doc> = reactive({
    open_help: {
      text: this.t("spotlight.general.help_menu"),
      alternates: ["help", "hoppscotch"],
      icon: markRaw(IconLifeBuoy),
      action() {
        invokeAction("modals.support.toggle")
      },
    },
    open_docs: {
      text: this.t("spotlight.general.open_docs"),
      alternates: ["docs", "documentation", "hoppscotch"],
      icon: markRaw(IconBook),
      action: () => this.openURL("https://docs.hoppscotch.io"),
    },
    open_keybindings: {
      text: this.t("spotlight.general.open_keybindings"),
      alternates: ["key", "shortcuts", "binding"],
      icon: markRaw(IconZap),
      action() {
        invokeAction("flyouts.keybinds.toggle")
      },
    },
    open_github: {
      text: this.t("spotlight.general.open_github"),
      alternates: ["repository", "github", "documentation", "hoppscotch"],
      icon: markRaw(IconGitHub),
      action: () => this.openURL("https://hoppscotch.io/github"),
    },
    link_twitter: {
      text: [this.t("spotlight.general.social"), "Twitter"],
      alternates: ["social", "twitter", "link"],
      icon: markRaw(IconTwitter),
      action: () => this.openURL("https://twitter.com/hoppscotch_io"),
    },
    link_discord: {
      text: [this.t("spotlight.general.social"), "Discord"],
      alternates: ["social", "discord", "link"],
      icon: markRaw(IconDiscord),
      action: () => this.openURL("https://hoppscotch.io/discord"),
    },
    link_linkedin: {
      text: [this.t("spotlight.general.social"), "LinkedIn"],
      alternates: ["social", "linkedin", "link"],
      icon: markRaw(IconLinkedIn),
      action: () =>
        this.openURL("https://www.linkedin.com/company/hoppscotch/"),
    },
  })

  // TODO: This is not recommended as of dioc > 3. Move to onServiceInit instead
  constructor(c: Container) {
    super(c, {
      searchFields: ["text", "alternates"],
      fieldWeights: {
        text: 2,
        alternates: 1,
      },
    })
  }

  override onServiceInit() {
    this.setDocuments(this.documents)
    this.spotlight.registerSearcher(this)
  }

  protected getSearcherResultForSearchResult(
    result: SearchResult<Doc>
  ): SpotlightSearcherResult {
    return {
      id: result.id,
      icon: result.doc.icon,
      text: { type: "text", text: result.doc.text },
      score: result.score,
    }
  }

  private openURL(url: string) {
    platform.kernelIO.openExternalLink(url)
  }

  public onDocSelected(id: string): void {
    this.documents[id]?.action()
  }

  public addCustomEntries(docs: Record<string, Doc>) {
    this.documents = { ...this.documents, ...docs }
    this.setDocuments(this.documents)
  }
}
