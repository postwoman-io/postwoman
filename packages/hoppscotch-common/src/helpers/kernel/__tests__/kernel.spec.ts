import { describe, expect, it } from "vitest"
import { GQLResponse } from "../gql/response"
import { GQLRequest } from "../gql/request"
import { RESTResponse } from "../rest/response"
import { RESTRequest } from "../rest/request"
import { HoppRESTRequest } from "@hoppscotch/data"
import { RunQueryOptions } from "~/helpers/graphql/connection"
import { MediaType } from "@hoppscotch/kernel"
import { HoppGQLRequest } from "@hoppscotch/data"
import { EffectiveHoppRESTRequest } from "~/helpers/utils/EffectiveURL"
import { RelayResponse } from "@hoppscotch/kernel"

describe("GraphQL Response Transformation", () => {
  const baseOptions: RunQueryOptions = {
    url: "https://api.example.com/graphql",
    headers: [],
    query: "",
    variables: "",
    auth: { authType: "none", authActive: true },
    operationName: "TestQuery",
    operationType: "query",
  }

  it("successfully transforms a valid GraphQL response with data", async () => {
    const json = JSON.stringify({ data: { hello: "world" } })
    const mockResponse: RelayResponse = {
      status: 200,
      headers: {},
      body: {
        mediaType: "application/json",
        body: new Uint8Array(Buffer.from(json)),
      },
      meta: {
        timing: {
          start: 100,
          end: 200,
        },
      },
    }

    const options = {
      ...baseOptions,
      query: "query TestQuery { hello }",
    }

    const result = await GQLResponse.toResponse(
      mockResponse as RelayResponse,
      options
    )

    expect(result).toHaveProperty("type", "response")
    if (result.type === "response") {
      expect(result.operationName).toBe("TestQuery")
      expect(result.time).toBe(100)
      expect(JSON.parse(result.data)).toHaveProperty("data.hello", "world")
    }
  })

  it("successfully transforms a GraphQL response with errors", async () => {
    const mockResponse: RelayResponse = {
      status: 200,
      headers: {},
      body: {
        mediaType: "application/json",
        body: new Uint8Array(
          Buffer.from(
            JSON.stringify({
              errors: [
                { message: "Field 'invalid' does not exist" },
                { message: "Syntax error" },
              ],
            })
          )
        ),
      },
      meta: {
        timing: {
          start: 0,
          end: 150,
        },
      },
    }

    const options = {
      ...baseOptions,
      query: "query TestQuery { invalid }",
    }

    const result = await GQLResponse.toResponse(
      mockResponse as RelayResponse,
      options
    )

    expect(result).toHaveProperty("type", "response")
    if (result.type === "response") {
      const parsedData = JSON.parse(result.data)
      expect(parsedData.errors).toHaveLength(2)
      expect(parsedData.errors[0].message).toBe(
        "Field 'invalid' does not exist"
      )
    }
  })

  it("returns transform error for non-GraphQL JSON response", async () => {
    const mockResponse: RelayResponse = {
      status: 200,
      headers: {},
      body: {
        mediaType: "application/json",
        body: new Uint8Array(
          Buffer.from(
            JSON.stringify({
              someField: "not a graphql response",
            })
          )
        ),
      },
    }

    const options = {
      ...baseOptions,
      query: "query TestQuery { hello }",
    }

    const result = await GQLResponse.toResponse(
      mockResponse as RelayResponse,
      options
    )

    expect(result).toHaveProperty("type", "error")
    if (result.type === "error") {
      expect(result.error.message).toBe("Invalid GraphQL response structure")
    }
  })
})

describe("GraphQL Request Transformation", () => {
  const baseRequest: HoppGQLRequest = {
    v: 8,
    name: "Test Query",
    url: "https://api.example.com/graphql",
    headers: [],
    query: "",
    variables: "",
    auth: { authType: "none", authActive: true },
  }

  it("transforms a basic GraphQL request correctly", async () => {
    const request: HoppGQLRequest = {
      ...baseRequest,
      query: "query { hello }",
    }

    const result = await GQLRequest.toRequest(request)

    expect(result).toMatchObject({
      url: "https://api.example.com/graphql",
      method: "POST",
      version: "HTTP/1.1",
      headers: { "content-type": "application/json" },
      auth: { kind: "none" },
      content: {
        kind: "json",
        content: { query: "query { hello }", variables: undefined },
        mediaType: "application/json",
      },
    })

    expect(result.content?.mediaType).toBe(MediaType.APPLICATION_JSON)
    expect(result.content?.content).toBeDefined()
    if (result.content?.body) {
      const parsedBody =
        typeof result.content.body === "string"
          ? JSON.parse(result.content.body)
          : JSON.parse(new TextDecoder().decode(result.content.body))

      expect(parsedBody).toEqual({
        query: request.query,
        variables: undefined,
      })
    }
  })

  it("properly parses and includes variables when provided", async () => {
    const request: HoppGQLRequest = {
      ...baseRequest,
      query: "query($id: ID!) { item(id: $id) { name } }",
      variables: '{ "id": "123" }',
    }

    const result = await GQLRequest.toRequest(request)

    expect(result.content?.kind).toBe("json")
    expect(result.content?.content).toBeDefined()
    if (result.content?.content) {
      expect(result.content?.content).toEqual({
        query: request.query,
        variables: { id: "123" },
      })
    }
  })

  it("throws error for invalid JSON in variables", async () => {
    const request: HoppGQLRequest = {
      ...baseRequest,
      query: "query($id: ID!) { item(id: $id) { name } }",
      variables: "{ invalid json }",
    }

    await expect(GQLRequest.toRequest(request)).rejects.toThrow("Invalid JSON")
  })
})

describe("REST Response Transformation", () => {
  it("transforms a successful REST response", async () => {
    const mockResponse = {
      body: {
        body: new Uint8Array([72, 101, 108, 108, 111]),
      },
      headers: {
        "content-type": "text/plain",
        "x-custom": "test",
      },
      status: 200,
      statusText: "OK",
      meta: {
        timing: {
          start: 100,
          end: 200,
        },
        size: {
          total: 5,
        },
      },
    }

    const originalRequest: HoppRESTRequest = {
      v: "11",
      endpoint: "https://api.example.com",
      name: "Test Request",
      method: "GET",
      params: [],
      headers: [],
      preRequestScript: "",
      testScript: "",
      auth: { authType: "none", authActive: true },
      body: { contentmediaType: null, body: null },
      requestVariables: [],
      responses: {},
    }

    const result = await RESTResponse.toResponse(
      mockResponse as any,
      originalRequest
    )

    expect(result).toHaveProperty("type", "success")
    if (result.type === "success") {
      expect(result.statusCode).toBe(200)
      expect(result.meta.responseDuration).toBe(100)
      expect(result.meta.responseSize).toBe(5)
      expect(result.headers).toHaveLength(2)
    }
  })

  it("returns transform error for invalid response body", async () => {
    const mockResponse = {
      body: {
        body: "invalid body format",
      },
    }

    const originalRequest: HoppRESTRequest = {
      v: "11",
      endpoint: "https://api.example.com",
      name: "Test Request",
      method: "GET",
      params: [],
      headers: [],
      preRequestScript: "",
      testScript: "",
      auth: { authType: "none", authActive: true },
      body: { contentmediaType: null, body: null },
      requestVariables: [],
      responses: {},
    }

    const result = await RESTResponse.toResponse(
      mockResponse as any,
      originalRequest
    )

    expect(result).toHaveProperty("type", "fail")
    if (result.type === "fail") {
      expect(result.error.type).toBe("transform_error")
      expect(result.error.message).toBe("Invalid response body format")
    }
  })
})

describe("REST Request Transformation", () => {
  const baseEffectiveRequest: EffectiveHoppRESTRequest = {
    v: "11",
    name: "Test Request",
    method: "GET",
    endpoint: "https://api.example.com",
    effectiveFinalURL: "https://api.example.com",
    params: [],
    headers: [],
    preRequestScript: "",
    testScript: "",
    auth: { authType: "none", authActive: true },
    body: { contentmediaType: null, body: null },
    requestVariables: [],
    responses: {},
    effectiveFinalHeaders: [],
    effectiveFinalParams: [],
    effectiveFinalBody: null,
    effectiveFinalRequestVariables: [],
  }

  it("transforms a basic REST request correctly", async () => {
    const result = await RESTRequest.toRequest(baseEffectiveRequest)

    expect(result).toMatchObject({
      url: baseEffectiveRequest.effectiveFinalURL,
      method: "GET",
      headers: {},
      params: {},
      auth: { kind: "none" },
    })
  })

  it("includes auth parameters when basic auth is active", async () => {
    const request: EffectiveHoppRESTRequest = {
      ...baseEffectiveRequest,
      auth: {
        authType: "basic",
        authActive: true,
        username: "testuser",
        password: "testpass",
      },
    }

    const result = await RESTRequest.toRequest(request)

    expect(result.auth).toMatchObject({
      kind: "basic",
      username: "testuser",
      password: "testpass",
    })
  })
})
