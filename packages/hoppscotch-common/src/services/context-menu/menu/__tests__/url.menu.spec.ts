import { TestContainer } from "dioc/testing"
import { describe, expect, it, vi } from "vitest"
import { RESTTabService } from "~/services/tab/rest"
import { ContextMenuService } from "../.."
import { URLMenuService } from "../url.menu"
import { getDefaultRESTRequest } from "~/helpers/rest/default"

vi.mock("~/modules/i18n", () => ({
  __esModule: true,
  getI18n: () => (x: string) => x,
}))

describe("URLMenuService", () => {
  it("registers with the contextmenu service upon initialization", () => {
    const container = new TestContainer()

    const registerContextMenuFn = vi.fn()

    container.bindMock(ContextMenuService, {
      registerMenu: registerContextMenuFn,
    })

    const environment = container.bind(URLMenuService)

    expect(registerContextMenuFn).toHaveBeenCalledOnce()
    expect(registerContextMenuFn).toHaveBeenCalledWith(environment)
  })

  describe("getMenuFor", () => {
    it("validating if the text passes the regex and return the menu", () => {
      function isValidURL(url: string) {
        try {
          new URL(url)
          return true
        } catch (error) {
          // Fallback to regular expression check
          const pattern = /^(https?:\/\/)?([\w.-]+)(\.[\w.-]+)+([/?].*)?$/
          return pattern.test(url)
        }
      }

      const container = new TestContainer()
      const url = container.bind(URLMenuService)

      const test = ""
      const result = url.getMenuFor(test)

      if (isValidURL(test)) {
        expect(result.results).toContainEqual(
          expect.objectContaining({ id: "link-tab" })
        )
      } else {
        expect(result).toEqual({ results: [] })
      }
    })

    it("should call the openNewTab function when action is called and a new hoppscotch tab is opened", () => {
      const container = new TestContainer()
      const createNewTabFn = vi.fn()
      container.bindMock(RESTTabService, {
        createNewTab: createNewTabFn,
      })
      const url = container.bind(URLMenuService)

      const test = "https://hoppscotch.io"
      const result = url.getMenuFor(test)

      result.results[0].action()

      const request = {
        ...getDefaultRESTRequest(),
        endpoint: test,
      }

      expect(createNewTabFn).toHaveBeenCalledOnce()
      expect(createNewTabFn).toHaveBeenCalledWith({
        request: request,
        isDirty: false,
        type: "request",
      })
    })
  })
})
