import type { KernelAPI } from "@hoppscotch/kernel"

declare global {
  interface Window {
    __KERNEL__?: KernelAPI
  }
}

export {}
