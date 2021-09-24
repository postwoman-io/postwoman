import { execTestScript, TestResponse } from "../../../test-runner"
import "@relmify/jest-fp-ts"

const fakeResponse: TestResponse = {
  status: 200,
  body: "hoi",
  headers: []
}

describe("toBeLevel2xx", () => {
  test("assertion passes for 200 series with no negation", async () => {
    for (let i = 200; i < 300; i++) {
      await expect(
        execTestScript(`pw.expect(${i}).toBeLevel2xx()`, fakeResponse)()
      ).resolves.toEqualRight([
        expect.objectContaining({
          expectResults: [{
            status: "pass",
            message: `Expected '${i}' to be 200-level status`,
          }],
        }),
      ])
    }
  })

  test("assertion fails for non 200 series with no negation", async () => {
    for (let i = 300; i < 500; i++) {
      await expect(
        execTestScript(`pw.expect(${i}).toBeLevel2xx()`, fakeResponse)()
      ).resolves.toEqualRight([
        expect.objectContaining({
          expectResults: [{
            status: "fail",
            message: `Expected '${i}' to be 200-level status`,
          }],
        }),
      ])
    }
  })

  test("give error if the expect value was not a number with no negation", async () => {
    await expect(
      execTestScript(`pw.expect("foo").toBeLevel2xx()`, fakeResponse)()
    ).resolves.toEqualRight([
      expect.objectContaining({
        expectResults: [{
          status: "error",
          message: "Expected 200-level status but could not parse value 'foo'",
        }],
      })
    ])
  })

  test("assertion fails for 200 series with negation", async () => {
    for (let i = 200; i < 300; i++) {
      await expect(
        execTestScript(`pw.expect(${i}).not.toBeLevel2xx()`, fakeResponse)()
      ).resolves.toEqualRight([
        expect.objectContaining({
          expectResults: [{
            status: "fail",
            message: `Expected '${i}' to not be 200-level status`,
          }],
        }),
      ])
    }
  })

  test("assertion passes for non 200 series with negation", async () => {
    for (let i = 300; i < 500; i++) {
      await expect(
        execTestScript(`pw.expect(${i}).not.toBeLevel2xx()`, fakeResponse)()
      ).resolves.toEqualRight([
        expect.objectContaining({
          expectResults: [{
            status: "pass",
            message: `Expected '${i}' to not be 200-level status`,
          }],
        }),
      ])
    }
  })

  test("give error if the expect value was not a number with negation", async () => {
    await expect(
      execTestScript(`pw.expect("foo").not.toBeLevel2xx()`, fakeResponse)()
    ).resolves.toEqualRight([
      expect.objectContaining({
        expectResults: [{
          status: "error",
          message: "Expected 200-level status but could not parse value 'foo'",
        }],
      })
    ])
  })
})

describe("toBeLevel3xx", () => {
  test("assertion passes for 300 series with no negation", async () => {
    for (let i = 300; i < 400; i++) {
      await expect(
        execTestScript(`pw.expect(${i}).toBeLevel3xx()`, fakeResponse)()
      ).resolves.toEqualRight([
        expect.objectContaining({
          expectResults: [{
            status: "pass",
            message: `Expected '${i}' to be 300-level status`,
          }],
        }),
      ])
    }
  })

  test("assertion fails for non 300 series with no negation", async () => {
    for (let i = 400; i < 500; i++) {
      await expect(
        execTestScript(`pw.expect(${i}).toBeLevel3xx()`, fakeResponse)()
      ).resolves.toEqualRight([
        expect.objectContaining({
          expectResults: [{
            status: "fail",
            message: `Expected '${i}' to be 300-level status`,
          }],
        }),
      ])
    }
  })

  test("give error if the expect value is not a number without negation", () => {
    return expect(
      execTestScript(`pw.expect("foo").toBeLevel3xx()`, fakeResponse)()
    ).resolves.toEqualRight([
      expect.objectContaining({
        expectResults: [{
          status: "error",
          message: "Expected 300-level status but could not parse value 'foo'",
        }],
      })
    ])
  })

  test("assertion fails for 400 series with negation", async () => {
    for (let i = 300; i < 400; i++) {
      await expect(
        execTestScript(`pw.expect(${i}).not.toBeLevel3xx()`, fakeResponse)()
      ).resolves.toEqualRight([
        expect.objectContaining({
          expectResults: [{
            status: "fail",
            message: `Expected '${i}' to not be 300-level status`,
          }],
        }),
      ])
    }
  })

  test("assertion passes for non 200 series with negation", async () => {
    for (let i = 400; i < 500; i++) {
      await expect(
        execTestScript(`pw.expect(${i}).not.toBeLevel3xx()`, fakeResponse)()
      ).resolves.toEqualRight([
        expect.objectContaining({
          expectResults: [{
            status: "pass",
            message: `Expected '${i}' to not be 300-level status`,
          }],
        }),
      ])
    }
  })

  test("give error if the expect value is not a number with negation", () => {
    return expect(
      execTestScript(`pw.expect("foo").not.toBeLevel3xx()`, fakeResponse)()
    ).resolves.toEqualRight([
      expect.objectContaining({
        expectResults: [{
          status: "error",
          message: "Expected 300-level status but could not parse value 'foo'",
        }]
      })
    ])
  })

})

describe("toBeLevel4xx", () => {
  test("assertion passes for 400 series with no negation", async () => {
    for (let i = 400; i < 500; i++) {
      await expect(
        execTestScript(`pw.expect(${i}).toBeLevel4xx()`, fakeResponse)()
      ).resolves.toEqualRight([
        expect.objectContaining({
          expectResults: [{
            status: "pass",
            message: `Expected '${i}' to be 400-level status`,
          }],
        }),
      ])
    }
  })

  test("assertion fails for non 400 series with no negation", async () => {
    for (let i = 500; i < 600; i++) {
      await expect(
        execTestScript(`pw.expect(${i}).toBeLevel4xx()`, fakeResponse)()
      ).resolves.toEqualRight([
        expect.objectContaining({
          expectResults: [{
            status: "fail",
            message: `Expected '${i}' to be 400-level status`,
          }],
        }),
      ])
    }
  })

  test("give error if the expected value is not a number without negation", () => {
    return expect(
      execTestScript(`pw.expect("foo").toBeLevel4xx()`, fakeResponse)()
    ).resolves.toEqualRight([
      expect.objectContaining({
        expectResults: [{
          status: "error",
          message: "Expected 400-level status but could not parse value 'foo'",
        }],
      })
    ])
  })

  test("assertion fails for 400 series with negation", async () => {
    for (let i = 400; i < 500; i++) {
      await expect(
        execTestScript(`pw.expect(${i}).not.toBeLevel4xx()`, fakeResponse)()
      ).resolves.toEqualRight([
        expect.objectContaining({
          expectResults: [{
            status: "fail",
            message: `Expected '${i}' to not be 400-level status`,
          }],
        }),
      ])
    }
  })

  test("assertion passes for non 400 series with negation", async () => {
    for (let i = 500; i < 600; i++) {
      await expect(
        execTestScript(`pw.expect(${i}).not.toBeLevel4xx()`, fakeResponse)()
      ).resolves.toEqualRight([
        expect.objectContaining({
          expectResults: [{
            status: "pass",
            message: `Expected '${i}' to not be 400-level status`,
          }],
        }),
      ])
    }
  })

  test("give error if the expected value is not a number with negation", () => {
    return expect(
      execTestScript(`pw.expect("foo").not.toBeLevel4xx()`, fakeResponse)()
    ).resolves.toEqualRight([
      expect.objectContaining({
        expectResults: [{
          status: "error",
          message: "Expected 400-level status but could not parse value 'foo'",
        }],
      })
    ])
  })
})

describe("toBeLevel5xx", () => {
  test("assertion passes for 500 series with no negation", async () => {
    for (let i = 500; i < 600; i++) {
      await expect(
        execTestScript(`pw.expect(${i}).toBeLevel5xx()`, fakeResponse)()
      ).resolves.toEqualRight([
        expect.objectContaining({
          expectResults: [{
            status: "pass",
            message: `Expected '${i}' to be 500-level status`,
          }],
        }),
      ])
    }
  })

  test("assertion fails for non 500 series with no negation", async () => {
    for (let i = 200; i < 500; i++) {
      await expect(
        execTestScript(`pw.expect(${i}).toBeLevel5xx()`, fakeResponse)()
      ).resolves.toEqualRight([
        expect.objectContaining({
          expectResults: [{
            status: "fail",
            message: `Expected '${i}' to be 500-level status`,
          }],
        }),
      ])
    }
  })

  test("give error if the expect value is not a number with no negation", () => {
    return expect(
      execTestScript(`pw.expect("foo").toBeLevel5xx()`, fakeResponse)()
    ).resolves.toEqualRight([
      expect.objectContaining({
        expectResults: [{
          status: "error",
          message: "Expected 500-level status but could not parse value 'foo'",
        }],
      })
    ])
  })

  test("assertion fails for 500 series with negation", async () => {
    for (let i = 500; i < 600; i++) {
      await expect(
        execTestScript(`pw.expect(${i}).not.toBeLevel5xx()`, fakeResponse)()
      ).resolves.toEqualRight([
        expect.objectContaining({
          expectResults: [{
            status: "fail",
            message: `Expected '${i}' to not be 500-level status`,
          }],
        }),
      ])
    }
  })

  test("assertion passes for non 500 series with negation", async () => {
    for (let i = 200; i < 500; i++) {
      await expect(
        execTestScript(`pw.expect(${i}).not.toBeLevel5xx()`, fakeResponse)()
      ).resolves.toEqualRight([
        expect.objectContaining({
          expectResults: [{
            status: "pass",
            message: `Expected '${i}' to not be 500-level status`,
          }],
        }),
      ])
    }
  })

  test("give error if the expect value is not a number with negation", () => {
    return expect(
      execTestScript(`pw.expect("foo").not.toBeLevel5xx()`, fakeResponse)()
    ).resolves.toEqualRight([
      expect.objectContaining({
        expectResults: [{
          status: "error",
          message: "Expected 500-level status but could not parse value 'foo'",
        }],
      })
    ])
  })
})