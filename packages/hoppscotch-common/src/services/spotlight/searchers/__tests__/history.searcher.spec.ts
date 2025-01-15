import { TestContainer } from "dioc/testing"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { HistorySpotlightSearcherService } from "../history.searcher"
import { nextTick, ref } from "vue"
import { SpotlightService } from "../.."
import { GQLHistoryEntry, RESTHistoryEntry } from "~/newstore/history"
import { getDefaultRESTRequest } from "~/helpers/rest/default"
import { HoppAction, HoppActionWithArgs } from "~/helpers/actions"
import { getDefaultGQLRequest } from "~/helpers/graphql/default"
import { RESTTabService } from "~/services/tab/rest"
import { PlatformDef, setPlatformDef } from "~/platform"

async function flushPromises() {
  return await new Promise((r) => setTimeout(r))
}

vi.mock("~/modules/i18n", () => ({
  __esModule: true,
  getI18n: () => (x: string) => x,
}))

const actionsMock = vi.hoisted(() => ({
  value: [] as (HoppAction | HoppActionWithArgs)[],
  invokeAction: vi.fn(),
}))

vi.mock("~/helpers/actions", async () => {
  const { BehaviorSubject }: any = await vi.importActual("rxjs")

  return {
    __esModule: true,
    activeActions$: new BehaviorSubject(actionsMock.value),
    invokeAction: actionsMock.invokeAction,
  }
})

const historyMock = vi.hoisted(() => ({
  restEntries: [] as RESTHistoryEntry[],
  gqlEntries: [] as GQLHistoryEntry[],
}))

vi.mock("~/newstore/history", () => ({
  __esModule: true,
  restHistoryStore: {
    value: {
      state: historyMock.restEntries,
    },
  },
  graphqlHistoryStore: {
    value: {
      state: historyMock.gqlEntries,
    },
  },
}))

describe("HistorySpotlightSearcherService", () => {
  beforeEach(() => {
    let x = actionsMock.value.pop()
    while (x) {
      x = actionsMock.value.pop()
    }

    let y = historyMock.restEntries.pop()
    while (y) {
      y = historyMock.restEntries.pop()
    }

    const container = new TestContainer()

    const createNewTabFn = vi.fn()

    container.bindMock(RESTTabService, {
      createNewTab: createNewTabFn,
    })

    actionsMock.invokeAction.mockReset()
    createNewTabFn.mockReset()

    const platform = {
      sync: {
        history: {},
      },
    }

    setPlatformDef(platform as PlatformDef)
  })

  it("registers with the spotlight service upon initialization", async () => {
    const container = new TestContainer()

    const registerSearcherFn = vi.fn()

    container.bindMock(SpotlightService, {
      registerSearcher: registerSearcherFn,
    })

    const history = container.bind(HistorySpotlightSearcherService)
    await flushPromises()

    expect(registerSearcherFn).toHaveBeenCalledOnce()
    expect(registerSearcherFn).toHaveBeenCalledWith(history)
  })

  it("returns a clear history result if the action is available", async () => {
    const container = new TestContainer()

    actionsMock.value.push("history.clear")
    const history = container.bind(HistorySpotlightSearcherService)
    await flushPromises()

    const query = ref("his")
    const [result] = history.createSearchSession(query)
    await nextTick()

    expect(result.value.results).toContainEqual(
      expect.objectContaining({
        id: "clear-history",
      })
    )
  })

  it("doesn't return a clear history result if the action is not available", async () => {
    const container = new TestContainer()

    const history = container.bind(HistorySpotlightSearcherService)
    await flushPromises()

    const query = ref("his")
    const [result] = history.createSearchSession(query)
    await nextTick()

    expect(result.value.results).not.toContainEqual(
      expect.objectContaining({
        id: "clear-history",
      })
    )
  })

  it("selecting a clear history entry invokes the clear history action", async () => {
    const container = new TestContainer()

    actionsMock.value.push("history.clear")
    const history = container.bind(HistorySpotlightSearcherService)
    await flushPromises()

    const query = ref("his")
    const [result] = history.createSearchSession(query)
    await nextTick()

    history.onResultSelect(result.value.results[0])

    expect(actionsMock.invokeAction).toHaveBeenCalledOnce()
    expect(actionsMock.invokeAction).toHaveBeenCalledWith("history.clear")
  })

  it("returns all the valid rest history entries for the search term", async () => {
    actionsMock.value.push("rest.request.open")

    historyMock.restEntries.push({
      request: {
        ...getDefaultRESTRequest(),
        endpoint: "bla.com",
      },
      responseMeta: {
        duration: null,
        statusCode: null,
      },
      star: false,
      v: 1,
      updatedOn: new Date(),
    })

    const container = new TestContainer()

    const history = container.bind(HistorySpotlightSearcherService)
    await flushPromises()

    const query = ref("bla")
    const [result] = history.createSearchSession(query)
    await nextTick()

    expect(result.value.results).toContainEqual(
      expect.objectContaining({
        id: "rest-0",
        text: {
          type: "custom",
          component: expect.anything(),
          componentProps: expect.objectContaining({
            historyEntry: historyMock.restEntries[0],
          }),
        },
      })
    )
  })

  it("selecting a rest history entry invokes action to open the rest request", async () => {
    actionsMock.value.push("rest.request.open")

    const historyEntry: RESTHistoryEntry = {
      request: {
        ...getDefaultRESTRequest(),
        endpoint: "bla.com",
      },
      responseMeta: {
        duration: null,
        statusCode: null,
      },
      star: false,
      v: 1,
      updatedOn: new Date(),
    }

    historyMock.restEntries.push(historyEntry)

    const container = new TestContainer()

    const history = container.bind(HistorySpotlightSearcherService)
    await flushPromises()

    const query = ref("bla")
    const [result] = history.createSearchSession(query)
    await nextTick()

    const doc = result.value.results[0]

    history.onResultSelect(doc)

    expect(actionsMock.invokeAction).toHaveBeenCalledOnce()
    expect(actionsMock.invokeAction).toHaveBeenCalledWith("rest.request.open", {
      doc: {
        request: historyEntry.request,
        isDirty: false,
        type: "request",
      },
    })
  })

  it("returns all the valid graphql history entries for the search term", async () => {
    actionsMock.value.push("gql.request.open")

    historyMock.gqlEntries.push({
      request: {
        ...getDefaultGQLRequest(),
        url: "bla.com",
      },
      response: "{}",
      star: false,
      v: 1,
      updatedOn: new Date(),
    })

    const container = new TestContainer()

    const history = container.bind(HistorySpotlightSearcherService)
    await flushPromises()

    const query = ref("bla")
    const [result] = history.createSearchSession(query)
    await nextTick()

    expect(result.value.results).toContainEqual(
      expect.objectContaining({
        id: "gql-0",
        text: {
          type: "custom",
          component: expect.anything(),
          componentProps: expect.objectContaining({
            historyEntry: historyMock.gqlEntries[0],
          }),
        },
      })
    )
  })

  it("selecting a graphql history entry invokes action to open the graphql request", async () => {
    actionsMock.value.push("gql.request.open")

    const historyEntry: GQLHistoryEntry = {
      request: {
        ...getDefaultGQLRequest(),
        url: "bla.com",
      },
      response: "{}",
      star: false,
      v: 1,
      updatedOn: new Date(),
    }

    historyMock.gqlEntries.push(historyEntry)

    const container = new TestContainer()

    const history = container.bind(HistorySpotlightSearcherService)
    await flushPromises()

    const query = ref("bla")
    const [result] = history.createSearchSession(query)
    await nextTick()

    const doc = result.value.results[0]

    history.onResultSelect(doc)

    expect(actionsMock.invokeAction).toHaveBeenCalledOnce()
    expect(actionsMock.invokeAction).toHaveBeenCalledWith("gql.request.open", {
      request: historyEntry.request,
    })
  })

  it("rest history entries are not shown when the rest open action is not registered", async () => {
    actionsMock.value.push("gql.request.open")

    historyMock.gqlEntries.push({
      request: {
        ...getDefaultGQLRequest(),
        url: "bla.com",
      },
      response: "{}",
      star: false,
      v: 1,
      updatedOn: new Date(),
    })

    historyMock.restEntries.push({
      request: {
        ...getDefaultRESTRequest(),
        endpoint: "bla.com",
      },
      responseMeta: {
        duration: null,
        statusCode: null,
      },
      star: false,
      v: 1,
      updatedOn: new Date(),
    })

    const container = new TestContainer()

    const history = container.bind(HistorySpotlightSearcherService)
    await flushPromises()

    const query = ref("bla")
    const [result] = history.createSearchSession(query)
    await nextTick()

    expect(result.value.results).toContainEqual(
      expect.objectContaining({
        id: expect.stringMatching(/^gql/),
      })
    )
    expect(result.value.results).not.toContainEqual(
      expect.objectContaining({
        id: expect.stringMatching(/^rest/),
      })
    )
  })

  it("gql history entries are not shown when the gql open action is not registered", async () => {
    actionsMock.value.push("rest.request.open")

    historyMock.gqlEntries.push({
      request: {
        ...getDefaultGQLRequest(),
        url: "bla.com",
      },
      response: "{}",
      star: false,
      v: 1,
      updatedOn: new Date(),
    })

    historyMock.restEntries.push({
      request: {
        ...getDefaultRESTRequest(),
        endpoint: "bla.com",
      },
      responseMeta: {
        duration: null,
        statusCode: null,
      },
      star: false,
      v: 1,
      updatedOn: new Date(),
    })

    const container = new TestContainer()

    const history = container.bind(HistorySpotlightSearcherService)
    await flushPromises()

    const query = ref("bla")
    const [result] = history.createSearchSession(query)
    await nextTick()

    expect(result.value.results).toContainEqual(
      expect.objectContaining({
        id: expect.stringMatching(/^rest/),
      })
    )
    expect(result.value.results).not.toContainEqual(
      expect.objectContaining({
        id: expect.stringMatching(/^gql/),
      })
    )
  })

  it("none of the history entries are show when neither of the open actions are registered", async () => {
    historyMock.gqlEntries.push({
      request: {
        ...getDefaultGQLRequest(),
        url: "bla.com",
      },
      response: "{}",
      star: false,
      v: 1,
      updatedOn: new Date(),
    })

    historyMock.restEntries.push({
      request: {
        ...getDefaultRESTRequest(),
        endpoint: "bla.com",
      },
      responseMeta: {
        duration: null,
        statusCode: null,
      },
      star: false,
      v: 1,
      updatedOn: new Date(),
    })

    const container = new TestContainer()

    const history = container.bind(HistorySpotlightSearcherService)
    await flushPromises()

    const query = ref("bla")
    const [result] = history.createSearchSession(query)
    await nextTick()

    expect(result.value.results).not.toContainEqual(
      expect.objectContaining({
        id: expect.stringMatching(/^rest/),
      })
    )
    expect(result.value.results).not.toContainEqual(
      expect.objectContaining({
        id: expect.stringMatching(/^gql/),
      })
    )
  })
})
