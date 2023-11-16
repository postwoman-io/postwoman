import { Store } from "tauri-plugin-store-api"
import TauriWebSocket, {
  Message,
  ConnectionConfig,
} from "tauri-plugin-websocket-api"
import { addCookieToFetchHeaders } from "./GQLClient"

/**
 * This is a wrapper around tauri-plugin-websocket-api with cookie injection support. This is required because
 * subscriptions-transport-ws client expects a custom websocket implementation in the shape of native browser WebSocket.
 */

export default class WebSocketWrapper extends EventTarget implements WebSocket {
  public client: TauriWebSocket | undefined
  private tauriWebSocketConfig:
    | (ConnectionConfig & { store: Store })
    | undefined
  private isConnected: boolean = false
  binaryType: BinaryType = "blob"
  extensions = ""
  onclose: ((this: WebSocket, ev: CloseEvent) => any) | null = null
  onerror: ((this: WebSocket, ev: Event) => any) | null = null
  onmessage: ((this: WebSocket, ev: MessageEvent) => any) | null = null
  onopen: ((this: WebSocket, ev: Event) => any) | null = null
  protocol = ""
  url: string

  public static readonly CONNECTING = 0
  public static readonly OPEN = 1
  public static readonly CLOSING = 2
  public static readonly CLOSED = 3

  readonly CONNECTING = 0
  readonly OPEN = 1
  readonly CLOSING = 2
  readonly CLOSED = 3

  constructor(
    url: string,
    protocols?: string | string[],
    config?: ConnectionConfig & { store: Store }
  ) {
    super()
    this.url = url
    this.tauriWebSocketConfig = config
    this.setup()
  }

  private async setup() {
    if (this.tauriWebSocketConfig?.store) {
      const headersStringified =
        this.tauriWebSocketConfig.headers || ("{}" as any)
      let headers = JSON.parse(headersStringified)
      headers = await addCookieToFetchHeaders(
        this.tauriWebSocketConfig.store,
        headers
      )
      this.tauriWebSocketConfig = {
        ...this.tauriWebSocketConfig,
        headers,
      }
    }
    this.client = await TauriWebSocket.connect(this.url, {
      headers: {
        "sec-websocket-protocol": "graphql-ws",
        ...this.tauriWebSocketConfig?.headers,
      },
    }).catch((error) => {
      this.isConnected = false
      if (this.onerror) {
        this.onerror(new Event("error"))
      }
      throw new Error(error)
    })

    this.isConnected = true

    this.client.addListener(this.handleMessage.bind(this))
    if (this.onopen) {
      this.onopen(new Event("open"))
    }
  }

  get readyState(): number {
    return this.client
      ? this.isConnected
        ? this.OPEN
        : this.CLOSED
      : this.CONNECTING
  }

  get bufferedAmount(): number {
    // TODO implement
    return 0
  }

  close(code?: number, reason?: string): void {
    this.client?.disconnect().then(() => {
      if (this.onclose) {
        this.onclose(new CloseEvent("close"))
      }
    })
  }

  send(data: string | ArrayBufferLike | Blob | ArrayBufferView) {
    if (
      typeof data === "string" ||
      data instanceof ArrayBuffer ||
      data instanceof Blob
    ) {
      this.client?.send(data as string).catch((error) => {
        console.error("error while sending data", data)
        if (this.onerror) {
          this.onerror(new Event("error"))
        }
      })
    } else {
      // TODO implement, drop the record for now
      console.warn(
        "WebSocketWrapper.send() not implemented for non-string data"
      )
    }
  }

  private handleMessage(message: Message): void {
    switch (message.type) {
      case "Close": {
        if (this.onclose) {
          this.onclose(new CloseEvent("close"))
        }
        return
      }
      case "Ping": {
        this.client?.send("Pong").catch((error) => {
          console.error("error while sending Pong data", message)
          if (this.onerror) {
            this.onerror(new Event("error"))
          }
        })
        return
      }
      default: {
        if (this.onmessage) {
          this.onmessage(
            new MessageEvent("message", {
              data: message.data,
              origin: this.url,
            })
          )
        }
      }
    }
  }
}
