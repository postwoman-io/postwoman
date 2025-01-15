import { Environment } from "@hoppscotch/data";
import { getEffectiveFinalMetaData } from "../../../utils/getters";

import { describe, it, expect } from "vitest";  // Importing from vitest

const DEFAULT_ENV = <Environment>{
  name: "name",
  variables: [{ key: "PARAM", value: "parsed_param" }],
};

describe("getEffectiveFinalMetaData", () => {
  it("Empty list of meta-data.", () => {
    expect(getEffectiveFinalMetaData([], DEFAULT_ENV)).toEqual([]); // Changed to toEqual
  });

  it("Non-empty active list of meta-data with unavailable ENV.", () => {
    expect(
      getEffectiveFinalMetaData(
        [{ active: true, key: "<<UNKNOWN_KEY>>", value: "<<UNKNOWN_VALUE>>" }],
        DEFAULT_ENV
      )
    ).toEqual([{ active: true, key: "", value: "" }]); // Changed to toEqual
  });

  it("Inactive list of meta-data.", () => {
    expect(
      getEffectiveFinalMetaData(
        [{ active: false, key: "KEY", value: "<<PARAM>>" }],
        DEFAULT_ENV
      )
    ).toEqual([]); // Changed to toEqual
  });

  it("Active list of meta-data.", () => {
    expect(
      getEffectiveFinalMetaData(
        [{ active: true, key: "PARAM", value: "<<PARAM>>" }],
        DEFAULT_ENV
      )
    ).toEqual([
      { active: true, key: "PARAM", value: "parsed_param" },
    ]); // Changed to toEqual
  });
});
