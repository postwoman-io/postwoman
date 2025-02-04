import axios, { AxiosError, AxiosResponse } from "axios";
import { RequestConfig } from "../../../interfaces/request";
import { requestRunner } from "../../../utils/request";
import { RequestRunnerResponse } from "../../../interfaces/response";

import { vi } from "vitest";  // Use vi for mocking and spying

// Mock axios methods individually to ensure complete mock behavior
vi.mock("axios", () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    isAxiosError: vi.fn(),
  },
}));

describe("requestRunner", () => {
  let SAMPLE_REQUEST_CONFIG: RequestConfig = {
    url: "https://example.com",
    supported: false,
    method: "GET",
  };

  beforeEach(() => {
    SAMPLE_REQUEST_CONFIG.url = "https://example.com";
    SAMPLE_REQUEST_CONFIG.method = "GET";
    vi.clearAllMocks();
  });

  afterAll(() => {
    vi.clearAllMocks();
  });

  it("Should handle axios-error with response info.", async () => {
    const axiosError: AxiosError = {
      name: "name",
      message: "message",
      config: SAMPLE_REQUEST_CONFIG,
      isAxiosError: true,
      response: {
        data: "data",
        status: 404,
        statusText: "NOT FOUND",
        headers: [],
        config: SAMPLE_REQUEST_CONFIG,
      },
      toJSON: () => ({}),
    };

    (axios as any).mockRejectedValueOnce(axiosError);

    // Ensure you're awaiting the promise properly here
    await expect(requestRunner(SAMPLE_REQUEST_CONFIG)()).resolves.toMatchObject({
      body: "data",
      status: 404,
    });
  });

  it("Should handle axios-error for unsupported request.", async () => {
    const axiosError: AxiosError = {
      name: "name",
      message: "message",
      config: SAMPLE_REQUEST_CONFIG,
      isAxiosError: true,
      toJSON: () => ({}),
    };

    (axios as any).mockRejectedValueOnce(axiosError);

    // Ensure you're awaiting the promise properly here
    await expect(requestRunner(SAMPLE_REQUEST_CONFIG)()).resolves.toMatchObject({
      status: 501,
      body: {},
    });
  });

  it("Should handle axios-error with request info.", async () => {
    const axiosError: AxiosError = {
      name: "name",
      message: "message",
      config: SAMPLE_REQUEST_CONFIG,
      isAxiosError: true,
      request: {},
      toJSON: () => ({}),
    };

    (axios as any).mockRejectedValueOnce(axiosError);

    // Ensure you're awaiting the promise properly here
    await expect(requestRunner(SAMPLE_REQUEST_CONFIG)()).resolves.toBeLeft();
  });

  it("Should handle unknown error.", async () => {
    const unknownError = {};

    (axios as any).mockRejectedValueOnce(unknownError);

    // Ensure you're awaiting the promise properly here
    await expect(requestRunner(SAMPLE_REQUEST_CONFIG)()).resolves.toBeLeft();
  });

  it("Should successfully execute.", async () => {
    const axiosResponse: AxiosResponse = {
      data: "data",
      status: 200,
      config: SAMPLE_REQUEST_CONFIG,
      statusText: "OK",
      headers: [],
    };

    (axios as any).mockResolvedValueOnce(axiosResponse);

    // Ensure you're awaiting the promise properly here
    await expect(requestRunner(SAMPLE_REQUEST_CONFIG)()).resolves.toMatchObject({
      status: 200,
      body: "data",
      method: "GET",
    });
  });
});
