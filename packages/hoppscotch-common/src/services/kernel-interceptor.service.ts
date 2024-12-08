import * as E from "fp-ts/Either"
import { Service } from "dioc"
import { Component, computed, reactive, watchEffect, markRaw } from "vue"
import type { getI18n } from "~/modules/i18n"
import { Request, Response, RelayError, Capabilities } from "@hoppscotch/kernel"
import { Relay } from "~/kernel/relay"

export type ExecutionResult<Err extends RelayError = RelayError> = {
  cancel: () => void
  response: Promise<E.Either<Err, Response>>
}

export type SelectableStatus<Props = unknown> =
  | { type: "selectable" }
  | {
      type: "unselectable"
      reason:
        | { type: "text"; text: (t: ReturnType<typeof getI18n>) => string }
        | { type: "component"; component: Component<Props>; props: Props }
      action?: {
        text: (t: ReturnType<typeof getI18n>) => string
        handler: () => void
      }
    }

export type KernelInterceptor<Err extends RelayError = RelayError> = {
  id: string
  name: (t: ReturnType<typeof getI18n>) => string
  settingsEntry?: {
    title: (t: ReturnType<typeof getI18n>) => string
    component: Component
  }
  subtitle?: Component
  selectable: SelectableStatus
  execute: (request: Request) => ExecutionResult<Err>
}

export class KernelInterceptorService extends Service {
  public static readonly ID = "KERNEL_INTERCEPTOR_SERVICE"

  private readonly state = reactive({
    interceptors: new Map<string, KernelInterceptor>(),
    currentId: null as string | null,
  })

  public readonly current = computed(() =>
    this.state.currentId
      ? this.state.interceptors.get(this.state.currentId)
      : null
  )

  public readonly available = computed(() =>
    Array.from(this.state.interceptors.values())
  )

  override onServiceInit(): void {
    this.setupInterceptorValidation()
  }

  public readonly capabilities = computed<Capabilities>(() =>
    Relay.capabilities()
  )

  private setupInterceptorValidation(): void {
    watchEffect(() => {
      if (!this.state.currentId) return

      const currentInterceptor = this.state.interceptors.get(
        this.state.currentId
      )

      if (!this.validateCurrentInterceptor(currentInterceptor)) {
        this.resetToSelectableInterceptor()
      }
    })
  }

  private validateCurrentInterceptor(
    interceptor: KernelInterceptor | undefined
  ): boolean {
    if (!interceptor) {
      this.state.currentId = null
      return false
    }

    return interceptor.selectable.type === "selectable"
  }

  private resetToSelectableInterceptor(): void {
    const selectableInterceptor = this.available.value.find(
      (int) => int.selectable.type === "selectable"
    )
    this.state.currentId = selectableInterceptor?.id ?? null
  }

  public register(interceptor: KernelInterceptor): void {
    this.state.interceptors.set(interceptor.id, markRaw(interceptor))

    if (!this.state.currentId) {
      this.state.currentId = interceptor.id
    }
  }

  public setActive(id: string | null): void {
    if (!id) {
      this.handleNullIdActivation()
      return
    }

    if (!this.state.interceptors.has(id)) {
      console.warn("Attempted to set unknown interceptor as active", id)
      return
    }

    this.state.currentId = id
  }

  private handleNullIdActivation(): void {
    this.state.currentId =
      this.available.value.length === 0 ? null : this.state.currentId
  }

  public execute(req: Request): ExecutionResult {
    const interceptor = this.validateAndGetActiveInterceptor()
    return interceptor.execute(req)
  }

  private validateAndGetActiveInterceptor(): KernelInterceptor {
    if (!this.state.currentId) {
      throw new Error("No active interceptor")
    }

    const interceptor = this.state.interceptors.get(this.state.currentId)
    if (!interceptor) {
      throw new Error("Active interceptor not found")
    }

    return interceptor
  }
}
