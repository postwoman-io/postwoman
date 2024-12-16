import * as E from "fp-ts/Either"
import { Service } from "dioc"
import { Component, computed, reactive, watchEffect, markRaw } from "vue"
import type { getI18n } from "~/modules/i18n"
import {
  RelayRequest,
  RelayResponse,
  RelayError,
  RelayCapabilities,
} from "@hoppscotch/kernel"

export function isCancellationError(
  error: KernelInterceptorError
): error is "cancellation" {
  return error === "cancellation"
}

export type SelectableStatus<Props = unknown> =
  | { type: "selectable" }
  | {
      type: "unselectable"
      reason:
        | {
            type: "text"
            text: (t: ReturnType<typeof getI18n>) => string
            action?: {
              text: (t: ReturnType<typeof getI18n>) => string
              onActionClick: () => void
            }
          }
        | {
            type: "custom"
            component: Component<Props>
            props: Props
          }
    }

export type KernelInterceptorError =
  | "cancellation"
  | {
      humanMessage: {
        heading: (t: ReturnType<typeof getI18n>) => string
        description: (t: ReturnType<typeof getI18n>) => string
      }
      error: RelayError
      component?: Component<RelayError>
    }

export type ExecutionResult<
  Err extends KernelInterceptorError = KernelInterceptorError,
> = {
  cancel: () => Promise<void>
  response: Promise<E.Either<Err, RelayResponse>>
}

export type KernelInterceptor<
  Err extends KernelInterceptorError = KernelInterceptorError,
> = {
  id: string
  name: (t: ReturnType<typeof getI18n>) => string
  settingsEntry?: {
    title: (t: ReturnType<typeof getI18n>) => string
    component: Component
  }
  subtitle?: Component
  selectable: SelectableStatus
  capabilities: RelayCapabilities
  execute: (request: RelayRequest) => ExecutionResult<Err>
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

  public execute(req: RelayRequest): ExecutionResult {
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
