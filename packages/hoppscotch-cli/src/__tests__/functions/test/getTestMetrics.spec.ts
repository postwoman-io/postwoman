import { TestMetrics } from "../../../types/response";
import { getTestMetrics } from "../../../utils/test";
import { describe, it, expect } from "vitest"; // Importing from vitest

describe("getTestMetrics", () => {
  it("With empty test-reports and errors.", () => {
    expect(getTestMetrics([], 1, [])).toMatchObject(<TestMetrics> {
      tests: { passed: 0, failed: 0 },
      testSuites: { failed: 0, passed: 0 },
      duration: 1,
      scripts: { failed: 0, passed: 1 },
    });
  });

  it("With non-empty test-reports and no test-script-error.", () => {
    expect(
      getTestMetrics(
        [
          {
            descriptor: "descriptor",
            expectResults: [],
            failed: 0,
            passed: 2,
          },
          {
            descriptor: "descriptor",
            expectResults: [],
            failed: 2,
            passed: 1,
          },
        ],
        5,
        []
      )
    ).toMatchObject(<TestMetrics> {
      tests: { failed: 2, passed: 3 },
      testSuites: { failed: 1, passed: 1 },
      scripts: { failed: 0, passed: 1 },
      duration: 5,
    });
  });

  it("With empty test-reports and some test-script-error.", () => {
    expect(
      getTestMetrics([], 5, [
        { code: "TEST_SCRIPT_ERROR", data: {} },
        { code: "PRE_REQUEST_SCRIPT_ERROR", data: {} },
      ])
    ).toMatchObject(<TestMetrics> {
      tests: { failed: 0, passed: 0 },
      testSuites: { failed: 0, passed: 0 },
      scripts: { failed: 1, passed: 0 },
      duration: 5,
    });
  });
});
