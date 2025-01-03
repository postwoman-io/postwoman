import { isHoppErrnoException } from "../../../utils/checks";
import { describe, it, expect } from "vitest"; // Importing from vitest

describe("isHoppErrnoException", () => {
  it("NULL exception value.", () => {
    expect(isHoppErrnoException(null)).toBeFalsy(); // No change
  });

  it("Non-existing name property.", () => {
    expect(isHoppErrnoException({ what: "what" })).toBeFalsy(); // No change
  });

  it("Invalid name value.", () => {
    expect(isHoppErrnoException({ name: 3 })).toBeFalsy(); // No change
  });

  it("Valid name value.", () => {
    expect(isHoppErrnoException({ name: "name" })).toBeTruthy(); // No change
  });
});
