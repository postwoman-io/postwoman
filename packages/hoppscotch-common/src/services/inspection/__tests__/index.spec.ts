import { describe, it, expect, vi } from "vitest"
import { Inspector, InspectionService, InspectorResult } from "../"
import { TestContainer } from "dioc/testing"
import { ref } from "vue"
import { RESTTabService } from "~/services/tab/rest"

vi.mock("~/modules/i18n", () => ({
  __esModule: true,
  getI18n: () => (x: string) => x,
}))

const inspectorResultMock: InspectorResult[] = [
  {
    id: "result1",
    text: { type: "text", text: "Sample Text" },
    icon: {},
    isApplicable: true,
    severity: 2,
    locations: { type: "url" },
    doc: { text: "Sample Doc", link: "https://example.com" },
    action: {
      text: "Sample Action",
      // eslint-disable-next-line @typescript-eslint/no-empty-function
      apply: () => {},
    },
  },
]

const testInspector: Inspector = {
  inspectorID: "inspector1",
  getInspections: () => ref(inspectorResultMock),
}

describe("InspectionService", () => {
  describe("registerInspector", () => {
    it("should register an inspector", () => {
      const container = new TestContainer()

      container.bindMock(RESTTabService, {
        currentActiveTab: ref({
          id: "test",
          document: {
            type: "request",
            request: {},
            response: null,
            isDirty: false,
            optionTabPreference: "params",
          },
        }),
        tabMap: new Map([
          [
            "test",
            {
              id: "test",
              document: {
                type: "request",
                request: {},
                isDirty: false,
                optionTabPreference: "params",
              },
            },
          ],
        ]),
        tabOrdering: ref(["test"]),
        currentTabID: ref("test"),
      })

      const service = container.bind(InspectionService)

      service.registerInspector(testInspector)

      expect(service.inspectors.has(testInspector.inspectorID)).toEqual(true)
    })
  })

  describe("deleteTabInspectorResult", () => {
    it("should delete a tab's inspector results", () => {
      const container = new TestContainer()

      container.bindMock(RESTTabService, {
        currentActiveTab: ref({
          id: "test",
          document: {
            type: "request",
            request: {},
            response: null,
            isDirty: false,
            optionTabPreference: "params",
          },
        }),
        tabMap: new Map([
          [
            "test",
            {
              id: "test",
              document: {
                type: "request",
                request: {},
                isDirty: false,
                optionTabPreference: "params",
              },
            },
          ],
        ]),
        tabOrdering: ref(["test"]),
        currentTabID: ref("test"),
      })

      const service = container.bind(InspectionService)

      const tabID = "testTab"
      service.tabs.value.set(tabID, inspectorResultMock)

      expect(service.tabs.value.has(tabID)).toEqual(true)

      service.deleteTabInspectorResult(tabID)

      expect(service.tabs.value.has(tabID)).toEqual(false)
    })
  })
})
