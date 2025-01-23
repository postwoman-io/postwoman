import { TestContainer } from "dioc/testing"
import { describe, expect, it, vi } from "vitest"
import { RequestInspectorService } from "../request.inspector"
import { InspectionService } from "../../index"
import { getDefaultRESTRequest } from "~/helpers/rest/default"
import { ref } from "vue"
import { KernelInterceptorService } from "~/services/kernel-interceptor.service"

vi.mock("~/modules/i18n", () => ({
  __esModule: true,
  getI18n: () => (x: string) => x,
}))

describe("RequestInspectorService", () => {
  it("registers with the inspection service upon initialization", () => {
    const container = new TestContainer()

    const registerInspectorFn = vi.fn()

    container.bindMock(InspectionService, {
      registerInspector: registerInspectorFn,
    })

    const requestInspector = container.bind(RequestInspectorService)

    expect(registerInspectorFn).toHaveBeenCalledOnce()
    expect(registerInspectorFn).toHaveBeenCalledWith(requestInspector)
  })

  describe("cookie header inspection", () => {
    it("should return an inspector result when headers contain cookies and interceptor doesn't support cookies", () => {
      const container = new TestContainer()

      container.bindMock(KernelInterceptorService, {
        current: ref({
          capabilities: {
            auth: new Set(),
            content: new Set(),
            advanced: new Set(),
          },
        }),
      })

      const requestInspector = container.bind(RequestInspectorService)

      const req = ref({
        ...getDefaultRESTRequest(),
        endpoint: "http://example.com/api/data",
        headers: [{ key: "Cookie", value: "some-cookie", active: true }],
      })

      const result = requestInspector.getInspections(req)

      expect(result.value).toContainEqual(
        expect.objectContaining({
          id: "cookie-header",
          isApplicable: true,
          locations: {
            type: "header",
            position: "key",
            key: "Cookie",
            index: 0,
          },
        })
      )
    })

    it("should return no inspector result when headers contain cookies and interceptor supports cookies", () => {
      const container = new TestContainer()

      container.bindMock(KernelInterceptorService, {
        current: ref({
          capabilities: {
            auth: new Set(),
            content: new Set(),
            advanced: new Set(["cookies"]),
          },
        }),
      })

      const requestInspector = container.bind(RequestInspectorService)

      const req = ref({
        ...getDefaultRESTRequest(),
        endpoint: "http://example.com/api/data",
        headers: [{ key: "Cookie", value: "some-cookie", active: true }],
      })

      const result = requestInspector.getInspections(req)

      expect(result.value).not.toContainEqual(
        expect.objectContaining({
          id: "cookie-header",
        })
      )
    })
  })

  describe("localhost access inspection", () => {
    it("should return an inspector result when URL contains localhost and interceptor doesn't support local access", () => {
      const container = new TestContainer()

      container.bindMock(KernelInterceptorService, {
        current: ref({
          capabilities: {
            auth: new Set(),
            content: new Set(),
            advanced: new Set(),
          },
        }),
      })

      const requestInspector = container.bind(RequestInspectorService)

      const req = ref({
        ...getDefaultRESTRequest(),
        endpoint: "http://localhost:3000/api",
      })

      const result = requestInspector.getInspections(req)

      expect(result.value).toContainEqual(
        expect.objectContaining({
          id: "localaccess",
          isApplicable: true,
          locations: {
            type: "url",
          },
        })
      )
    })

    it("should return no inspector result when URL contains localhost and interceptor supports local access", () => {
      const container = new TestContainer()

      container.bindMock(KernelInterceptorService, {
        current: ref({
          capabilities: {
            auth: new Set(),
            content: new Set(),
            advanced: new Set(["localaccess"]),
          },
        }),
      })

      const requestInspector = container.bind(RequestInspectorService)

      const req = ref({
        ...getDefaultRESTRequest(),
        endpoint: "http://localhost:3000/api",
      })

      const result = requestInspector.getInspections(req)

      expect(result.value).not.toContainEqual(
        expect.objectContaining({
          id: "localaccess",
        })
      )
    })
  })

  describe("digest auth inspection", () => {
    it("should return an inspector result when using digest auth and interceptor doesn't support it", () => {
      const container = new TestContainer()

      container.bindMock(KernelInterceptorService, {
        current: ref({
          capabilities: {
            auth: new Set(),
            content: new Set(),
            advanced: new Set(),
          },
        }),
      })

      const requestInspector = container.bind(RequestInspectorService)

      const req = ref({
        ...getDefaultRESTRequest(),
        auth: { authType: "digest", authActive: true },
      })

      const result = requestInspector.getInspections(req)

      expect(result.value).toContainEqual(
        expect.objectContaining({
          id: "digest-auth",
          isApplicable: true,
          locations: {
            type: "url",
          },
        })
      )
    })

    it("should return no inspector result when using digest auth and interceptor supports it", () => {
      const container = new TestContainer()

      container.bindMock(KernelInterceptorService, {
        current: ref({
          capabilities: {
            auth: new Set(["digest"]),
            content: new Set(),
            advanced: new Set(),
          },
        }),
      })

      const requestInspector = container.bind(RequestInspectorService)

      const req = ref({
        ...getDefaultRESTRequest(),
        auth: { authType: "digest", authActive: true },
      })

      const result = requestInspector.getInspections(req)

      expect(result.value).not.toContainEqual(
        expect.objectContaining({
          id: "digest-auth",
        })
      )
    })
  })

  describe("binary body inspection", () => {
    it("should return an inspector result when using binary body and interceptor doesn't support it", () => {
      const container = new TestContainer()

      container.bindMock(KernelInterceptorService, {
        current: ref({
          capabilities: {
            auth: new Set(),
            content: new Set(),
            advanced: new Set(),
          },
        }),
      })

      const requestInspector = container.bind(RequestInspectorService)

      const req = ref({
        ...getDefaultRESTRequest(),
        body: { contentType: "application/octet-stream", body: null },
      })

      const result = requestInspector.getInspections(req)

      expect(result.value).toContainEqual(
        expect.objectContaining({
          id: "binary-body",
          isApplicable: true,
          locations: {
            type: "body-content-type-header",
          },
        })
      )
    })

    it("should return no inspector result when using binary body and interceptor supports it", () => {
      const container = new TestContainer()

      container.bindMock(KernelInterceptorService, {
        current: ref({
          capabilities: {
            auth: new Set(),
            content: new Set(["binary"]),
            advanced: new Set(),
          },
        }),
      })

      const requestInspector = container.bind(RequestInspectorService)

      const req = ref({
        ...getDefaultRESTRequest(),
        body: { contentType: "application/octet-stream", body: null },
      })

      const result = requestInspector.getInspections(req)

      expect(result.value).not.toContainEqual(
        expect.objectContaining({
          id: "binary-body",
        })
      )
    })
  })
})
