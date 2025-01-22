import { HoppCollection } from "@hoppscotch/data";
import { HoppEnvPair, HoppEnvs } from "./request";

export type CollectionRunnerParam = {
  collections: HoppCollection[];
  envs: HoppEnvs;
  delay?: number;
  iterationData?: IterationDataItem[][];
  iterationCount?: number;
};

export type HoppCollectionFileExt = "json";

// Indicates the shape each iteration data entry gets transformed into
export type IterationDataItem = Extract<HoppEnvPair, { value: string }>;
