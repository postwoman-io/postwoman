import { PreRequestMetrics, RequestMetrics } from "../../../types/response";
import { getPreRequestMetrics } from "../../../utils/pre-request";

import { describe, it, expect } from "vitest";

describe("getPreRequestMetrics", () => {
  it("With empty errors.", () => {
    expect(getPreRequestMetrics([], 1)).toMatchObject(<PreRequestMetrics>{
      scripts: { failed: 0, passed: 1 },
    });
  });

  it("With non-empty errors.", () => {
    expect(
      getPreRequestMetrics(
        [
          { code: "REQUEST_ERROR", data: {} },
          { code: "PRE_REQUEST_SCRIPT_ERROR", data: {} },
        ],
        1
      )
    ).toMatchObject(<PreRequestMetrics>{
      scripts: { failed: 1, passed: 0 },
    });
  });
});
