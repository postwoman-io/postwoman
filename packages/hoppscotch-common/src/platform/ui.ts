import { Ref, Component } from "vue"
import { getI18n } from "~/modules/i18n"

export type HoppFooterMenuItem = {
  id: string
  text: (t: ReturnType<typeof getI18n>) => string
  icon: Component
  action: { type: "link"; href: string } | { type: "custom"; do: () => void }
}

export type HoppSupportOptionsMenuItem = {
  id: string
  text: (t: ReturnType<typeof getI18n>) => string
  subtitle: (t: ReturnType<typeof getI18n>) => string
  icon: Component
  action: { type: "link"; href: string } | { type: "custom"; do: () => void }
}

export type UIPlatformDef = {
  appHeader?: {
    paddingTop?: Ref<string>
    paddingLeft?: Ref<string>

    /**
     * A function which is called when the header area of the app receives a click event
     */
    onHeaderAreaClick?: () => void
  }
  onCodemirrorInstanceMount?: (element: HTMLElement) => void

  /**
   * Additonal menu items shown in the "Help and Feedback" menu
   * in the app footer.
   */
  additionalFooterMenuItems?: HoppFooterMenuItem[]

  /**
   * Additional Support Options menu items shown in the app header
   */
  additionalSupportOptionsMenuItems?: HoppSupportOptionsMenuItem[]

  /**
   * Additional Settings Section components in the settings page
   */
  additionalSettingsSections?: Component[]

  /**
   * Additional profile Section components in the profile page
   */
  additionalProfileSections?: Component[]

  /**
   * Custom history related components to be shown in the history page
   */
  additionalHistoryComponent?: Component

  /**
   * Custom sidebar header item to be shown in the sidebar header
   */
  additionalSidebarHeaderItem?: Component
}
