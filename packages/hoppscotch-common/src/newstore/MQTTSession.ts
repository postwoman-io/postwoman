import { distinctUntilChanged, pluck } from "rxjs/operators"
import DispatchingStore, { defineDispatchers } from "./DispatchingStore"
import { MQTTConnection } from "~/helpers/realtime/MQTTConnection"
import {
  HoppRealtimeLog,
  HoppRealtimeLogLine,
} from "~/helpers/types/HoppRealtimeLog"

type MQTTTab = {
  id: string
  name: string
  color: string
  removable: boolean
  logs: HoppRealtimeLog[]
}

type HoppMQTTRequest = {
  endpoint: string
  clientID?: string
}

type HoppMQTTSession = {
  request: HoppMQTTRequest
  subscriptionState: boolean
  log: HoppRealtimeLog
  socket: MQTTConnection
  tabs: MQTTTab[]
  currentTabId: string
}

const defaultMQTTRequest: HoppMQTTRequest = {
  endpoint: "wss://test.mosquitto.org:8081",
  clientID: "hoppscotch",
}

const defaultTab: MQTTTab = {
  id: "all",
  name: "All Topics",
  color: "var(--accent-color)",
  removable: false,
  logs: [],
}

const defaultMQTTSession: HoppMQTTSession = {
  request: defaultMQTTRequest,
  subscriptionState: false,
  socket: new MQTTConnection(),
  log: [],
  tabs: [defaultTab],
  currentTabId: defaultTab.id,
}

const dispatchers = defineDispatchers({
  setRequest(
    _: HoppMQTTSession,
    { newRequest }: { newRequest: HoppMQTTRequest }
  ) {
    return {
      request: newRequest,
    }
  },
  setEndpoint(curr: HoppMQTTSession, { newEndpoint }: { newEndpoint: string }) {
    return {
      request: {
        clientID: curr.request.clientID,
        endpoint: newEndpoint,
      },
    }
  },
  setClientID(curr: HoppMQTTSession, { newClientID }: { newClientID: string }) {
    return {
      request: {
        endpoint: curr.request.endpoint,
        clientID: newClientID,
      },
    }
  },
  setConn(_: HoppMQTTSession, { socket }: { socket: MQTTConnection }) {
    return {
      socket,
    }
  },
  setSubscriptionState(_: HoppMQTTSession, { state }: { state: boolean }) {
    return {
      subscriptionState: state,
    }
  },
  setLog(_: HoppMQTTSession, { log }: { log: HoppRealtimeLog }) {
    return {
      log,
    }
  },
  addLogLine(curr: HoppMQTTSession, { line }: { line: HoppRealtimeLogLine }) {
    return {
      log: [...curr.log, line],
    }
  },
  setTabs(_: HoppMQTTSession, { tabs }: { tabs: MQTTTab[] }) {
    return {
      tabs,
    }
  },
  addTab(curr: HoppMQTTSession, { tab }: { tab: MQTTTab }) {
    return {
      tabs: [...curr.tabs, tab],
    }
  },
  setCurrentTabId(_: HoppMQTTSession, { tabId }: { tabId: string }) {
    return {
      currentTabId: tabId,
    }
  },
  setCurrentTabLog(
    _: HoppMQTTSession,
    { log, tabId }: { log: HoppRealtimeLog[]; tabId: string }
  ) {
    const newTabs = _.tabs.map((tab) => {
      if (tab.id === tabId) tab.logs = log
      return tab
    })

    return {
      tabs: newTabs,
    }
  },
  addCurrentTabLogLine(
    _: HoppMQTTSession,
    { line, tabId }: { tabId: string; line: HoppRealtimeLog }
  ) {
    const newTabs = _.tabs.map((tab) => {
      if (tab.id === tabId) tab.logs = [...tab.logs, line]
      return tab
    })

    return {
      tabs: newTabs,
    }
  },
})

const MQTTSessionStore = new DispatchingStore(defaultMQTTSession, dispatchers)

export function setMQTTRequest(newRequest?: HoppMQTTRequest) {
  MQTTSessionStore.dispatch({
    dispatcher: "setRequest",
    payload: {
      newRequest: newRequest ?? defaultMQTTRequest,
    },
  })
}

export function setMQTTEndpoint(newEndpoint: string) {
  MQTTSessionStore.dispatch({
    dispatcher: "setEndpoint",
    payload: {
      newEndpoint,
    },
  })
}

export function setMQTTClientID(newClientID: string) {
  MQTTSessionStore.dispatch({
    dispatcher: "setClientID",
    payload: {
      newClientID,
    },
  })
}

export function setMQTTConn(socket: MQTTConnection) {
  MQTTSessionStore.dispatch({
    dispatcher: "setConn",
    payload: {
      socket,
    },
  })
}

export function setMQTTSubscriptionState(state: boolean) {
  MQTTSessionStore.dispatch({
    dispatcher: "setSubscriptionState",
    payload: {
      state,
    },
  })
}

export function setMQTTLog(log: HoppRealtimeLog) {
  MQTTSessionStore.dispatch({
    dispatcher: "setLog",
    payload: {
      log,
    },
  })
}

export function addMQTTLogLine(line: HoppRealtimeLogLine) {
  MQTTSessionStore.dispatch({
    dispatcher: "addLogLine",
    payload: {
      line,
    },
  })
}

export function setMQTTTabs(tabs: MQTTTab[]) {
  MQTTSessionStore.dispatch({
    dispatcher: "setTabs",
    payload: {
      tabs,
    },
  })
}

export function addMQTTTab(tab: MQTTTab) {
  MQTTSessionStore.dispatch({
    dispatcher: "addTab",
    payload: {
      tab,
    },
  })
}

export function setCurrentTab(tabId: string) {
  MQTTSessionStore.dispatch({
    dispatcher: "setCurrentTabId",
    payload: {
      tabId,
    },
  })
}

export function setMQTTCurrentTabLog(tabId: string, log: HoppRealtimeLog) {
  MQTTSessionStore.dispatch({
    dispatcher: "setCurrentTabLog",
    payload: {
      tabId,
      log,
    },
  })
}

export function addMQTTCurrentTabLogLine(
  tabId: string,
  line: HoppRealtimeLogLine
) {
  MQTTSessionStore.dispatch({
    dispatcher: "addCurrentTabLogLine",
    payload: {
      tabId,
      line,
    },
  })
}

export const MQTTRequest$ = MQTTSessionStore.subject$.pipe(
  pluck("request"),
  distinctUntilChanged()
)

export const MQTTEndpoint$ = MQTTSessionStore.subject$.pipe(
  pluck("request", "endpoint"),
  distinctUntilChanged()
)

export const MQTTClientID$ = MQTTSessionStore.subject$.pipe(
  pluck("request", "clientID"),
  distinctUntilChanged()
)

export const MQTTConnectingState$ = MQTTSessionStore.subject$.pipe(
  pluck("connectingState"),
  distinctUntilChanged()
)

export const MQTTConnectionState$ = MQTTSessionStore.subject$.pipe(
  pluck("connectionState"),
  distinctUntilChanged()
)

export const MQTTSubscriptionState$ = MQTTSessionStore.subject$.pipe(
  pluck("subscriptionState"),
  distinctUntilChanged()
)

export const MQTTConn$ = MQTTSessionStore.subject$.pipe(
  pluck("socket"),
  distinctUntilChanged()
)

export const MQTTLog$ = MQTTSessionStore.subject$.pipe(
  pluck("log"),
  distinctUntilChanged()
)

export const MQTTTabs$ = MQTTSessionStore.subject$.pipe(
  pluck("tabs"),
  distinctUntilChanged()
)

export const MQTTCurrentTab$ = MQTTSessionStore.subject$.pipe(
  pluck("currentTabId"),
  distinctUntilChanged()
)
