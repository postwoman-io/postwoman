import { execTestScript, TestResponse } from "../../test-runner"

const fakeResponse: TestResponse = {
  status: 200,
  body: "hoi",
  headers: []
}

describe("execTestScript function behavior", () => {
  test("returns a resolved promise for a valid test scripts with all green", () => {
    return expect(
      execTestScript(
        `
          pw.test("Arithmetic operations", () => {
            const size = 500 + 500;
            pw.expect(size).toBe(1000);
            pw.expect(size - 500).toBe(500);
            pw.expect(size * 4).toBe(4000);
            pw.expect(size / 4).toBe(250);
          });
        `,
        fakeResponse
      )()
    ).resolves.toBeRight();
  })

  test("resolves for tests with failed expectations", () => {
    return expect(
      execTestScript(
        `
          pw.test("Arithmetic operations", () => {
            const size = 500 + 500;
            pw.expect(size).toBe(1000);
            pw.expect(size - 500).not.toBe(500);
            pw.expect(size * 4).toBe(4000);
            pw.expect(size / 4).not.toBe(250);
          });
        `, fakeResponse
      )()
    ).resolves.toBeRight()
  })

  // TODO: We need a more concrete behavior for this
  test("rejects for invalid syntax on tests", () => {
    return expect(
      execTestScript(
        `
          pw.test("Arithmetic operations", () => {
            const size = 500 + 500;
            pw.expect(size).
            pw.expect(size - 500).not.toBe(500);
            pw.expect(size * 4).toBe(4000);
            pw.expect(size / 4).not.toBe(250);
          });
        `, fakeResponse
      )()
    ).resolves.toBeLeft()
  })
})
