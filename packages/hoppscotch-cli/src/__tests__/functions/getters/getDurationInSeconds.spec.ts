import { DEFAULT_DURATION_PRECISION } from "../../../utils/constants";
import { getDurationInSeconds } from "../../../utils/getters";
import { describe, it, expect } from "vitest"; // Importing from vitest

describe("getDurationInSeconds", () => {
  const testDurations = [
    { end: [1, 111111111], precision: 1, expected: 1.1 },
    { end: [2, 333333333], precision: 2, expected: 2.33 },
    {
      end: [3, 555555555],
      precision: DEFAULT_DURATION_PRECISION,
      expected: 3.556,
    },
    { end: [4, 777777777], precision: 4, expected: 4.7778 },
  ];

  it.each(testDurations)(
    "($end.0 s + $end.1 ns) rounded-off to $expected",
    ({ end, precision, expected }) => {
      expect(getDurationInSeconds(end as [number, number], precision)).toBe(
        expected
      );
    }
  );
});
