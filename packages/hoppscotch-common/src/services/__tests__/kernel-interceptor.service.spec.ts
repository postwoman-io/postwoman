import { describe, expect, it, vi } from "vitest"
import {
  KernelInterceptor,
  KernelInterceptorService,
} from "../kernel-interceptor.service"
import { TestContainer } from "dioc/testing"
import { RelayRequest } from "@hoppscotch/kernel"

describe("KernelInterceptorService", () => {
  it("initially has no interceptors defined", () => {
    const container = new TestContainer()
    const service = container.bind(KernelInterceptorService)

    expect(service.available.value).toEqual([])
  })

  it("current is null if no interceptors are defined", () => {
    const container = new TestContainer()
    const service = container.bind(KernelInterceptorService)

    expect(service.current.value).toBeNull()
  })

  it("current points to active interceptor after registration", () => {
    const container = new TestContainer()
    const service = container.bind(KernelInterceptorService)

    const interceptor: KernelInterceptor = {
      id: "test",
      name: () => "Test Interceptor",
      selectable: { type: "selectable" },
      capabilities: {},
      execute: () => {
        throw new Error("Not implemented")
      },
    }

    service.register(interceptor)
    expect(service.current.value).toBe(interceptor)
  })

  describe("register", () => {
    it("adds interceptor to available list", () => {
      const container = new TestContainer()
      const service = container.bind(KernelInterceptorService)

      const interceptor: KernelInterceptor = {
        id: "test",
        name: () => "Test Interceptor",
        selectable: { type: "selectable" },
        capabilities: {},
        execute: () => {
          throw new Error("Not implemented")
        },
      }

      service.register(interceptor)
      expect(service.available.value).toEqual([interceptor])
    })

    it("sets first registered interceptor as active", () => {
      const container = new TestContainer()
      const service = container.bind(KernelInterceptorService)

      const interceptor: KernelInterceptor = {
        id: "test",
        name: () => "Test Interceptor",
        selectable: { type: "selectable" },
        capabilities: {},
        execute: () => {
          throw new Error("Not implemented")
        },
      }

      service.register(interceptor)
      expect(service.current.value?.id).toBe("test")
    })
  })

  describe("setActive", () => {
    it("cannot set unknown interceptor as active", () => {
      const container = new TestContainer()
      const service = container.bind(KernelInterceptorService)

      service.register({
        id: "test",
        name: () => "Test Interceptor",
        selectable: { type: "selectable" },
        capabilities: {},
        execute: () => {
          throw new Error("Not implemented")
        },
      })

      service.setActive("unknown")
      expect(service.current.value?.id).toBe("test")
    })

    it("updates current when setting valid interceptor", () => {
      const container = new TestContainer()
      const service = container.bind(KernelInterceptorService)

      const interceptor1: KernelInterceptor = {
        id: "test1",
        name: () => "Test 1",
        selectable: { type: "selectable" },
        capabilities: {},
        execute: () => {
          throw new Error("Not implemented")
        },
      }

      const interceptor2: KernelInterceptor = {
        id: "test2",
        name: () => "Test 2",
        selectable: { type: "selectable" },
        capabilities: {},
        execute: () => {
          throw new Error("Not implemented")
        },
      }

      service.register(interceptor1)
      service.register(interceptor2)

      service.setActive("test2")
      expect(service.current.value).toBe(interceptor2)
    })
  })

  describe("execute", () => {
    it("throws error if no interceptor is active", () => {
      const container = new TestContainer()
      const service = container.bind(KernelInterceptorService)

      expect(() => service.execute({} as RelayRequest)).toThrow(
        "No active interceptor"
      )
    })

    it("calls execute on current interceptor", () => {
      const container = new TestContainer()
      const service = container.bind(KernelInterceptorService)

      const interceptor: KernelInterceptor = {
        id: "test",
        name: () => "Test Interceptor",
        selectable: { type: "selectable" },
        capabilities: {},
        execute: vi.fn(),
      }

      service.register(interceptor)

      const request = {} as RelayRequest
      service.execute(request)

      expect(interceptor.execute).toHaveBeenCalledWith(request)
    })
  })

  describe("validation", () => {
    it("resets to selectable interceptor if current becomes unselectable", async () => {
      const container = new TestContainer()
      const service = container.bind(KernelInterceptorService)

      const interceptor1: KernelInterceptor = {
        id: "test1",
        name: () => "Test 1",
        selectable: {
          type: "unselectable",
          reason: {
            type: "text",
            text: () => "Not available",
          },
        },
        capabilities: {},
        execute: () => {
          throw new Error("Not implemented")
        },
      }

      const interceptor2: KernelInterceptor = {
        id: "test2",
        name: () => "Test 2",
        selectable: { type: "selectable" },
        capabilities: {},
        execute: () => {
          throw new Error("Not implemented")
        },
      }

      service.register(interceptor2)
      service.register(interceptor1)

      await new Promise((resolve) => setTimeout(resolve, 0))

      expect(service.current.value?.id).toBe("test2")
    })
  })
})
