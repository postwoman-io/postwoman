import { execPreRequestScript } from "../preRequest"
import "@relmify/jest-fp-ts"

describe("execPreRequestScript", () => {
  test("returns the updated envirionment properly", () => {
    return expect(
      execPreRequestScript(
        `
          pw.env.set("bob", "newbob")
        `,
        [{ key: "bob", value: "oldbob" }, { key: "foo", value: "bar" }]
      )()
    ).resolves.toEqualRight([
      { key: "bob", value: "newbob" },
      { key: "foo", value: "bar" }
    ])
  })

  test("fails if the key is not a string", () => {
    return expect(
      execPreRequestScript(
        `
          pw.env.set(10, "newbob")
        `,
        [{ key: "bob", value: "oldbob" }, { key: "foo", value: "bar" }]
      )()
    ).resolves.toBeLeft()
  })

  test("fails if the value is not a string", () => {
    return expect(
      execPreRequestScript(
        `
          pw.env.set("bob", 10)
        `,
        [{ key: "bob", value: "oldbob" }, { key: "foo", value: "bar" }]
      )()
    ).resolves.toBeLeft()
  })

  test("fails for invalid syntax", () => {
    return expect(
      execPreRequestScript(
        `
          pw.env.set("bob", 
        `,
        [{ key: "bob", value: "oldbob" }, { key: "foo", value: "bar" }]
      )()
    ).resolves.toBeLeft()
  })

  test("creates new env variable if doesn't exist", () => {
    return expect(
      execPreRequestScript(
        `
          pw.env.set("foo", "bar")
        `,
        []
      )()
    ).resolves.toEqualRight(
      [{ key: "foo", value: "bar" }]
    )
  })
})