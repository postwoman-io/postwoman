import { Environment, HoppCollection, HoppRESTRequest } from "@hoppscotch/data";
import { z } from "zod";

import { TestReport } from "../interfaces/response";
import { HoppCLIError } from "./errors";

export type FormDataEntry = {
  key: string;
  value: string | Blob;
  contentType?: string;
};

export type HoppEnvPair = Environment["variables"][number];

export const HoppEnvKeyPairObject = z.record(z.string(), z.string());

export type HoppEnvs = {
  global: HoppEnvPair[];
  selected: HoppEnvPair[];
};

export type CollectionQueue = {
  path: string;
  collection: HoppCollection;
};

export type RequestReport = {
  path: string;
  tests: TestReport[];
  errors: HoppCLIError[];
  result: boolean;
  duration: { test: number; request: number; preRequest: number };
};

export type ProcessRequestParams = {
  request: HoppRESTRequest;
  envs: HoppEnvs;
  path: string;
  delay: number;
};
