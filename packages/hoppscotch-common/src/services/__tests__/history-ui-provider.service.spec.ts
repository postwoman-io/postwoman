import { TestContainer } from "dioc/testing"
import { describe, expect, it } from "vitest"
import { getI18n } from "~/modules/i18n"
import { HistoryUIProviderService } from "../history-ui-provider.service"

describe("HistoryUIProviderService", () => {
  const container = new TestContainer()
  const historyUI = container.bind(HistoryUIProviderService)

  it("should initialize with default values", () => {
    expect(historyUI.isEnabled.value).toBe(false)
  })

  it("should return correct default title", () => {
    const mockT = ((key: string) => key) as ReturnType<typeof getI18n>
    const title = historyUI.historyUIProviderTitle.value(mockT)
    expect(title).toBe("tab.history")
  })

  it("should allow toggling enabled state", () => {
    expect(historyUI.isEnabled.value).toBe(false)
    historyUI.isEnabled.value = true
    expect(historyUI.isEnabled.value).toBe(true)
  })
})
