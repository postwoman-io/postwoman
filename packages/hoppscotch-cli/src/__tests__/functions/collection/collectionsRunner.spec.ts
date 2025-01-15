import { collectionsRunner } from "../../../utils/collections";
import { HoppRESTRequest } from "@hoppscotch/data";
import axios, { AxiosResponse } from "axios";

import { describe, it, expect, vi, beforeEach, afterAll } from "vitest"; // Importing from vitest

vi.mock("axios"); // Mocking axios with vitest

const SAMPLE_HOPP_REQUEST = <HoppRESTRequest>{
  v: "1",
  name: "request",
  method: "GET",
  endpoint: "https://example.com",
  params: [],
  headers: [],
  preRequestScript: "",
  testScript: "",
  auth: {
    authActive: false,
    authType: "none",
  },
  body: {
    contentType: null,
    body: null,
  },
};

const SAMPLE_RESOLVED_RESPONSE = <AxiosResponse>{
  data: { body: 1 },
  status: 200,
  statusText: "OK",
  config: {
    url: "https://example.com",
    supported: true,
    method: "GET",
  },
  headers: [],
};

const SAMPLE_ENVS = { global: [], selected: [] };

describe("collectionsRunner", () => {
  beforeEach(() => {
    vi.clearAllMocks(); // Replacing jest.clearAllMocks with vi.clearAllMocks in vitest
  });

  afterAll(() => {
    vi.clearAllMocks(); // Replacing jest.clearAllMocks with vi.clearAllMocks in vitest
  });

  it("Empty HoppCollection.", () => {
    return expect(
      collectionsRunner({ collections: [], envs: SAMPLE_ENVS })
    ).resolves.toStrictEqual([]); // No change
  });

  it("Empty requests and folders in collection.", () => {
    return expect(
      collectionsRunner({
        collections: [
          {
            v: 1,
            name: "name",
            folders: [],
            requests: [],
          },
        ],
        envs: SAMPLE_ENVS,
      })
    ).resolves.toMatchObject([]); // No change
  });

  it("Non-empty requests in collection.", () => {
    (axios as unknown as vi.Mock).mockResolvedValue(SAMPLE_RESOLVED_RESPONSE); // Using vi.Mock instead of jest.Mock

    return expect(
      collectionsRunner({
        collections: [
          {
            v: 1,
            name: "collection",
            folders: [],
            requests: [SAMPLE_HOPP_REQUEST],
          },
        ],
        envs: SAMPLE_ENVS,
      })
    ).resolves.toMatchObject([
      {
        path: "collection/request",
        tests: [],
        errors: [],
        result: true,
      },
    ]);
  });

  it("Non-empty folders in collection.", () => {
    (axios as unknown as vi.Mock).mockResolvedValue(SAMPLE_RESOLVED_RESPONSE); // Using vi.Mock instead of jest.Mock

    return expect(
      collectionsRunner({
        collections: [
          {
            v: 1,
            name: "collection",
            folders: [
              {
                v: 1,
                name: "folder",
                folders: [],
                requests: [SAMPLE_HOPP_REQUEST],
              },
            ],
            requests: [],
          },
        ],
        envs: SAMPLE_ENVS,
      })
    ).resolves.toMatchObject([
      {
        path: "collection/folder/request",
        tests: [],
        errors: [],
        result: true,
      },
    ]);
  });
});
