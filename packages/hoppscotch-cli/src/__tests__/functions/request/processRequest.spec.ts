import { HoppRESTRequest } from "@hoppscotch/data";
import axios, { AxiosResponse } from "axios";
import { processRequest } from "../../../utils/request";
import { HoppEnvs } from "../../../types/request";

// Import Vitest mock functions
import { vi } from "vitest";

// Mock axios using Vitest's vi
vi.mock("axios");

const DEFAULT_REQUEST = <HoppRESTRequest> {
  v: "1",
  name: "name",
  method: "POST",
  endpoint: "https://example.com",
  params: [],
  headers: [],
  preRequestScript: "",
  testScript: "",
  auth: {
    authType: "none",
    authActive: false,
  },
  body: {
    contentType: null,
    body: null,
  },
};

const DEFAULT_RESPONSE = <AxiosResponse> {
  data: {},
  status: 200,
  config: {
    url: "https://example.com",
    supported: true,
    method: "POST",
  },
  statusText: "OK",
  headers: [],
};

const DEFAULT_ENVS = <HoppEnvs> {
  global: [],
  selected: [],
};

describe("processRequest", () => {
  let SAMPLE_REQUEST = DEFAULT_REQUEST;

  beforeEach(() => {
    // Use vi.clearAllMocks() instead of jest.clearAllMocks()
    vi.clearAllMocks();
  });

  afterEach(() => {
    SAMPLE_REQUEST = DEFAULT_REQUEST;
  });

  it("With empty envs for 'true' result.", async () => {
    // Mock resolved axios response
    vi.mocked(axios).mockResolvedValue(DEFAULT_RESPONSE);

    // Await the promise and check for resolved value
    await expect(
      processRequest({
        request: SAMPLE_REQUEST,
        envs: DEFAULT_ENVS,
        path: "fake/collection/path",
        delay: 0,
      })()
    ).resolves.toMatchObject({
      report: {
        result: true,
      },
    });
  });

  it("With non-empty envs, pre-request-script and test-script.", async () => {
    SAMPLE_REQUEST.preRequestScript = `
      pw.env.set("ENDPOINT", "https://example.com");
    `;
    SAMPLE_REQUEST.testScript = `
      pw.test("check status.", () => {
        pw.expect(pw.response.status).toBe(200);
      });
    `;

    // Mock resolved axios response
    vi.mocked(axios).mockResolvedValue(DEFAULT_RESPONSE);

    // Await the promise and check for resolved value
    await expect(
      processRequest({
        request: SAMPLE_REQUEST,
        envs: DEFAULT_ENVS,
        path: "fake/collection/path",
        delay: 0,
      })()
    ).resolves.toMatchObject({
      envs: {
        selected: [{ key: "ENDPOINT", value: "https://example.com" }],
      },
      report: {
        result: true,
      },
    });
  });

  it("With invalid-pre-request-script.", async () => {
    SAMPLE_REQUEST.preRequestScript = `invalid`;

    // Mock resolved axios response
    vi.mocked(axios).mockResolvedValue(DEFAULT_RESPONSE);

    // Await the promise and check for resolved value
    await expect(
      processRequest({
        request: SAMPLE_REQUEST,
        envs: DEFAULT_ENVS,
        path: "fake/request/path",
        delay: 0,
      })()
    ).resolves.toMatchObject({
      report: { result: false },
    });
  });
});
