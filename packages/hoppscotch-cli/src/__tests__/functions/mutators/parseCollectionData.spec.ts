import { describe, test, expect } from "vitest";
import { HoppCLIError } from "../../../types/errors";
import { parseCollectionData } from "../../../utils/mutators";

describe("parseCollectionData", () => {
  test("Reading non-existing file.", async () => {
    await expect(
      parseCollectionData("./src/__tests__/samples/notexist.json")
    ).rejects.toMatchObject(<HoppCLIError>{
      code: "FILE_NOT_FOUND",
    });
  });

  test("Unparseable JSON contents.", async () => {
    await expect(
      parseCollectionData("./src/__tests__/samples/malformed-collection.json")
    ).rejects.toMatchObject(<HoppCLIError>{
      code: "UNKNOWN_ERROR",
    });
  });

  test("Invalid HoppCollection.", async () => {
    await expect(
      parseCollectionData(
        "./src/__tests__/samples/malformed-collection2.json"
      )
    ).rejects.toMatchObject(<HoppCLIError>{
      code: "MALFORMED_COLLECTION",
    });
  });

  test("Valid HoppCollection.", async () => {
    await expect(
      parseCollectionData("./src/__tests__/samples/passes.json")
    ).resolves.toBeTruthy();
  });
});
