import { match } from "fp-ts/lib/Either"
import { pipe } from "fp-ts/lib/function"
import * as QuickJS from "quickjs-emscripten"
import { marshalObjectToVM } from "../utils"

let vm: QuickJS.QuickJSVm

beforeAll(async () => {
  const qjs = await QuickJS.getQuickJS()
  vm = qjs.createVm()
})

afterAll(() => {
  vm.dispose()
})

describe("marshalObjectToVM", () => {

  test("successfully marshals simple object into the vm", () => {
    const testObj = {
      a: 1
    }

    const objVMHandle: QuickJS.QuickJSHandle | null = pipe(
      marshalObjectToVM(vm, testObj),
      match(
        (e) => null,
        (result) => result
      )
    )

    expect(objVMHandle).not.toBeNull()
    expect(vm.dump(objVMHandle!)).toEqual(testObj)

    objVMHandle!.dispose()
  })

  test("fails marshalling cyclic object into vm", () => {
    const testObj = {
      a: 1,
      b: null as any
    }

    testObj.b = testObj

    const objVMHandle: QuickJS.QuickJSHandle | null = pipe(
      marshalObjectToVM(vm, testObj),
      match(
        (e) => null,
        (result) => result
      )
    )

    expect(objVMHandle).toBeNull()
  })

})