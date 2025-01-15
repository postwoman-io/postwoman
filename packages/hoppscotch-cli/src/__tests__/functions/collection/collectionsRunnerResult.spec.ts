import { collectionsRunnerResult } from "../../../utils/collections";

const FALSE_RESULT_REPORT = {
  path: "some_path",
  tests: [],
  errors: [],
  result: false,
  duration: { test: 1, request: 1, preRequest: 1 },
};

const TRUE_RESULT_REPORT = {
  path: "some_path",
  tests: [],
  errors: [],
  result: true,
  duration: { test: 1, request: 1, preRequest: 1 },
};

import { describe, it, expect } from "vitest";  // Importing from vitest

describe("collectionsRunnerResult", () => {
  it("Empty request-report.", () => {
    expect(collectionsRunnerResult([])).toBeTruthy(); // No change
  });

  it("Atleast 1 false result in request-report.", () => {
    expect(
      collectionsRunnerResult([FALSE_RESULT_REPORT, TRUE_RESULT_REPORT])
    ).toBeFalsy(); // No change
  });

  it("All true result(s) in request-report.", () => {
    expect(
      collectionsRunnerResult([TRUE_RESULT_REPORT, TRUE_RESULT_REPORT])
    ).toBeTruthy(); // No change
  });
});
