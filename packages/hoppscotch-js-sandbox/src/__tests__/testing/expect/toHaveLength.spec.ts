import { execTestScript, TestResponse } from "../../../test-runner"

const fakeResponse: TestResponse = {
  status: 200,
  body: "hoi",
  headers: []
}

describe("toHaveLength", () => {
  test("asserts true for valid lengths with no negation", () => {
    return expect(
      execTestScript(
        `
          pw.expect([1, 2, 3, 4]).toHaveLength(4)
          pw.expect([]).toHaveLength(0)
        `,
        fakeResponse
      )()
    ).resolves.toEqualRight([
      expect.objectContaining({
        expectResults: [
          { status: "pass", message: "Expected the array to be of length '4'" },
          { status: "pass", message: "Expected the array to be of length '0'"  },
        ],
      }),
    ])
  })

  test("asserts false for invalid lengths with no negation", () => {
    return expect(
      execTestScript(
        `
          pw.expect([]).toHaveLength(4)
          pw.expect([1, 2, 3, 4]).toHaveLength(0)
        `,
        fakeResponse
      )()
    ).resolves.toEqualRight([
      expect.objectContaining({
        expectResults: [
          { status: "fail", message: "Expected the array to be of length '4'" },
          { status: "fail", message: "Expected the array to be of length '0'" },
        ],
      }),
    ])
  })

  test("asserts false for valid lengths with negation", () => {
    return expect(
      execTestScript(
        `
          pw.expect([1, 2, 3, 4]).not.toHaveLength(4)
          pw.expect([]).not.toHaveLength(0)
        `,
        fakeResponse
      )()
    ).resolves.toEqualRight([
      expect.objectContaining({
        expectResults: [
          { status: "fail", message: "Expected the array to not be of length '4'" },
          { status: "fail", message: "Expected the array to not be of length '0'" },
        ],
      }),
    ])
  })

  test("asserts true for invalid lengths with negation", () => {
    return expect(
      execTestScript(
        `
          pw.expect([]).not.toHaveLength(4)
          pw.expect([1, 2, 3, 4]).not.toHaveLength(0)
        `,
        fakeResponse
      )()
    ).resolves.toEqualRight([
      expect.objectContaining({
        expectResults: [
          { status: "pass", message: "Expected the array to not be of length '4'" },
          { status: "pass", message: "Expected the array to not be of length '0'" },
        ],
      }),
    ])
  })

  test("gives error if not called on an array or a string with no negation", () => {
    return expect(
      execTestScript(
        `
          pw.expect(5).toHaveLength(0)
          pw.expect(true).toHaveLength(0)
        `,
        fakeResponse
      )()
    ).resolves.toEqualRight([
      expect.objectContaining({
        expectResults: [
          { status: "error", message: "Expected toHaveLength to be called for an array or string" },
          { status: "error", message: "Expected toHaveLength to be called for an array or string" },
        ]
      })
    ])
  })

  test("gives error if not called on an array or a string with negation", () => {
    return expect(
      execTestScript(
        `
          pw.expect(5).not.toHaveLength(0)
          pw.expect(true).not.toHaveLength(0)
        `,
        fakeResponse
      )()
    ).resolves.toEqualRight([
      expect.objectContaining({
        expectResults: [
          { status: "error", message: "Expected toHaveLength to be called for an array or string" },
          { status: "error", message: "Expected toHaveLength to be called for an array or string" },
        ]
      })
    ])
  })

  test("gives an error if toHaveLength parameter is not a number without negation", () => {
    return expect(
      execTestScript(
        `
          pw.expect([1, 2, 3, 4]).toHaveLength("a")
        `,
        fakeResponse
      )()
    ).resolves.toEqualRight([
      expect.objectContaining({
        expectResults: [
          { status: "error", message: "Argument for toHaveLength should be a number" },
        ],
      })
    ])
  })

  test("gives an error if toHaveLength parameter is not a number with negation", () => {
    return expect(
      execTestScript(
        `
          pw.expect([1, 2, 3, 4]).not.toHaveLength("a")
        `,
        fakeResponse
      )()
    ).resolves.toEqualRight([
      expect.objectContaining({
        expectResults: [
          { status: "error", message: "Argument for toHaveLength should be a number" },
        ],
      })
    ])
  })
})
