import { Container, ServiceClassInstance } from "dioc"
import { KernelInterceptor } from "~/services/kernel-interceptor.service"

export type KernelInterceptorDef =
  | {
      type: "standalone"
      interceptor: KernelInterceptor
    }
  | {
      type: "service"
      service: ServiceClassInstance<unknown> & {
        new (container: Container): KernelInterceptor
      }
    }

export type KernelInterceptorsPlatformDef = {
  default: string
  interceptors: KernelInterceptorDef[]
}
