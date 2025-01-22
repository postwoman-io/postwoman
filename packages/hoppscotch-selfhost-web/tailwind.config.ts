import { Config } from "tailwindcss"
import preset from "@hoppscotch/ui/ui-preset"

export default {
  content: ["../hoppscotch-common/src/**/*.{vue,html}"],
  presets: [preset],
  theme: {
    extend: {
      inset: {
        upperPrimaryStickyFold: "var(--upper-primary-sticky-fold)",
        upperSecondaryStickyFold: "var(--upper-secondary-sticky-fold)",
        upperTertiaryStickyFold: "var(--upper-tertiary-sticky-fold)",
        upperFourthStickyFold: "var(--upper-fourth-sticky-fold)",
        upperRunnerStickyFold: "var(--upper-runner-sticky-fold)",
        upperMobilePrimaryStickyFold: "var(--upper-mobile-primary-sticky-fold)",
        upperMobileSecondaryStickyFold:
          "var(--upper-mobile-secondary-sticky-fold)",
        upperMobileStickyFold: "var(--upper-mobile-sticky-fold)",
        upperMobileTertiaryStickyFold:
          "var(--upper-mobile-tertiary-sticky-fold)",
        lowerPrimaryStickyFold: "var(--lower-primary-sticky-fold)",
        lowerSecondaryStickyFold: "var(--lower-secondary-sticky-fold)",
        lowerTertiaryStickyFold: "var(--lower-tertiary-sticky-fold)",
        lowerFourthStickyFold: "var(--lower-fourth-sticky-fold)",
        sidebarPrimaryStickyFold: "var(--sidebar-primary-sticky-fold)",
        sidebarSecondaryStickyFold: "var(--line-height-body)",
        propertiesPrimaryStickyFold: "var(--properties-primary-sticky-fold)",
      },
    },
  },
} satisfies Config
