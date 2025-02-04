import { isHoppCLIError } from "../../../utils/checks";
import { describe, it, expect } from "vitest"; // Importing from vitest

describe("isHoppCLIError", () => {
  it("NULL error value.", () => {
    expect(isHoppCLIError(null)).toBeFalsy();
  });

  it("Non-existing code property.", () => {
    expect(isHoppCLIError({ name: "name" })).toBeFalsy();
  });

  it("Invalid code value.", () => {
    expect(isHoppCLIError({ code: 2 })).toBeFalsy();
  });

  it("Valid code value.", () => {
    expect(isHoppCLIError({ code: "TEST_SCRIPT_ERROR" })).toBeTruthy();
  });
});
