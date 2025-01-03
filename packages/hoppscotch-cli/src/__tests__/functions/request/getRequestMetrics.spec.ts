import { describe, test, expect } from "vitest"; // Import Vitest functions
import { RequestMetrics } from "../../../types/response";
import { getRequestMetrics } from "../../../utils/request";

describe("getRequestMetrics", () => {
  test("With empty errors.", () => {
    expect(getRequestMetrics([], 1)).toMatchObject(<RequestMetrics>{
      requests: { failed: 0, passed: 1 },
    });
  });

  test("With non-empty errors.", () => {
    expect(
      getRequestMetrics(
        [
          { code: "REQUEST_ERROR", data: {} },
          { code: "PARSING_ERROR", data: {} },
        ],
        1
      )
    ).toMatchObject(<RequestMetrics>{
      requests: { failed: 1, passed: 0 },
    });
  });
});
